import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { createHandoff } from "./handoff";
import { executeTool, systemPrompt, toolSpecs, type FactT, type LeadT } from "./agentTools";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

export type AgentOutcome = {
  reply: string;
  handedOff?: { execName: string | null };
  booked?: { when: string; project: string };
  error?: boolean;
  mock?: boolean;
};

// Orchestrator: persists the buyer message, then routes to whichever brain is
// configured. Priority: MOCK_AI=1 (scripted demo) > ANTHROPIC_API_KEY (Claude)
// > AI_API_KEY (any OpenAI-compatible provider: Sarvam, Mistral, Groq, Gemini,
// OpenRouter, OpenAI) > safe fallback (named-executive handoff).
export async function runAgent(conversationId: string, userText: string): Promise<AgentOutcome> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: true, messages: { orderBy: { createdAt: "asc" } } }
  });
  if (!conv) return { reply: "This chat has expired. Please refresh the page.", error: true };
  const lead = conv.lead;

  await prisma.message.create({ data: { conversationId, role: "BUYER", content: userText } });

  const persistReply = async (text: string) => {
    await prisma.message.create({ data: { conversationId, role: "ASSISTANT", content: text } });
    if (!lead.firstResponseAt)
      await prisma.lead.update({ where: { id: lead.id }, data: { firstResponseAt: new Date() } });
  };

  const fallback = async (note: string): Promise<AgentOutcome> => {
    const { exec } = await createHandoff(
      lead.id,
      "other",
      `Assistant unavailable (${note}). Buyer wrote: "${userText.slice(0, 200)}"`
    );
    const reply =
      "Sorry, our assistant is briefly unavailable. " +
      (exec ? `${exec.name} from our sales team will reach out shortly.` : "Our sales team will reach out shortly.");
    await persistReply(reply);
    await prisma.conversation.update({ where: { id: conversationId }, data: { flagged: true, flagNote: note } });
    return { reply, handedOff: { execName: exec?.name ?? null }, error: true };
  };

  if (process.env.MOCK_AI === "1") {
    const { runMockAgent } = await import("./mockAgent");
    return runMockAgent(conversationId, userText);
  }

  const facts = await prisma.factSheet.findMany();
  const history: { role: "user" | "assistant"; content: string }[] = conv.messages.map((m) => ({
    role: m.role === "BUYER" ? ("user" as const) : ("assistant" as const),
    content: m.content
  }));
  history.push({ role: "user", content: userText });

  if (process.env.ANTHROPIC_API_KEY) {
    return driveAnthropic({ conversationId, lead, facts, history, persistReply, fallback });
  }
  if (process.env.AI_API_KEY) {
    const { driveOpenAICompat } = await import("./aiOpenAI");
    return driveOpenAICompat({ conversationId, lead, facts, history, persistReply, fallback });
  }
  return fallback("no API key configured");
}

type DriverDeps = {
  conversationId: string;
  lead: LeadT;
  facts: FactT[];
  history: { role: "user" | "assistant"; content: string }[];
  persistReply: (text: string) => Promise<void>;
  fallback: (note: string) => Promise<AgentOutcome>;
};

async function driveAnthropic(deps: DriverDeps): Promise<AgentOutcome> {
  const { conversationId, facts, persistReply, fallback } = deps;
  let lead = deps.lead;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = toolSpecs.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters
  })) as Anthropic.Tool[];

  const history: Anthropic.MessageParam[] = deps.history.map((m) => ({
    role: m.role,
    content: m.content
  }));

  let handedOff: AgentOutcome["handedOff"];
  let booked: AgentOutcome["booked"];

  try {
    for (let turn = 0; turn < 6; turn++) {
      const res = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 700,
        system: systemPrompt(facts, lead),
        messages: history,
        tools
      });

      const toolUses = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      const text = res.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();

      if (toolUses.length === 0) {
        const reply = text || "Could you say that again?";
        await persistReply(reply);
        return { reply, handedOff, booked };
      }

      history.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const out = await executeTool(tu.name, tu.input as Record<string, unknown>, {
          lead, conversationId, facts
        });
        if (out.lead) lead = out.lead;
        if (out.handedOff) handedOff = out.handedOff;
        if (out.booked) booked = out.booked;
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out.result) });
      }
      history.push({ role: "user", content: results });
    }
    return fallback("agent loop limit reached");
  } catch (e) {
    return fallback(e instanceof Error ? e.message.slice(0, 120) : "API error");
  }
}
