// Generic driver for any OpenAI-compatible provider: Sarvam, Mistral, Groq,
// Gemini (OpenAI endpoint), OpenRouter, OpenAI itself. Which one runs is
// purely env config: AI_BASE_URL + AI_API_KEY + AI_MODEL. It uses the same
// shared tools, so booking and handoff behaviour is identical to the
// Anthropic path.
//
// Provider quirks handled here, learned the hard way:
// - Reasoning models (sarvam-105b and similar) can spend the whole token
//   budget thinking and return empty content: cap raised, and an empty final
//   answer gets ONE retry with tool_choice "none" before falling back.
// - Some models wrap thoughts in <think>...</think> inside content: stripped.
// - Older providers may use the legacy function_call field: converted.
import OpenAI from "openai";
import { executeTool, systemPrompt, toolSpecs, type FactT, type LeadT } from "./agentTools";
import type { AgentOutcome } from "./ai";

type Deps = {
  conversationId: string;
  lead: LeadT;
  facts: FactT[];
  history: { role: "user" | "assistant"; content: string }[];
  persistReply: (text: string) => Promise<void>;
  fallback: (note: string) => Promise<AgentOutcome>;
};

function cleanText(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<\/?think>/g, "")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractToolCalls(msg: any): { id: string; name: string; args: string }[] {
  if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return msg.tool_calls.map((tc: any, i: number) => ({
      id: tc.id || `call_${i}`,
      name: tc.function?.name ?? "",
      args: tc.function?.arguments ?? "{}"
    }));
  }
  if (msg?.function_call?.name) {
    return [{ id: "call_0", name: msg.function_call.name, args: msg.function_call.arguments ?? "{}" }];
  }
  return [];
}

export async function driveOpenAICompat(deps: Deps): Promise<AgentOutcome> {
  const { conversationId, facts, history, persistReply, fallback } = deps;
  let lead = deps.lead;

  const client = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1"
  });
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  const tools = toolSpecs.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters }
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "system", content: systemPrompt(facts, lead) }, ...history];

  let handedOff: AgentOutcome["handedOff"];
  let booked: AgentOutcome["booked"];
  let retriedForText = false;

  try {
    for (let turn = 0; turn < 8; turn++) {
      messages[0] = { role: "system", content: systemPrompt(facts, lead) };
      const forceText = retriedForText;
      const res = await client.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: forceText ? "none" : "auto",
        max_tokens: 1500
      });
      const choice = res.choices[0];
      const msg = choice?.message;
      if (!msg) return fallback("empty completion");

      const toolCalls = forceText ? [] : extractToolCalls(msg);
      const text = cleanText(msg.content);
      console.log(
        `[ai] model=${model} finish=${choice.finish_reason} tools=${toolCalls.length} textLen=${text.length}`
      );

      if (toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.args }
          }))
        });
        for (const tc of toolCalls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.args || "{}");
          } catch {
            input = {};
          }
          const out = await executeTool(tc.name, input, { lead, conversationId, facts });
          if (out.lead) lead = out.lead;
          if (out.handedOff) handedOff = out.handedOff;
          if (out.booked) booked = out.booked;
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out.result) });
        }
        continue;
      }

      if (!text) {
        // Reasoning ate the budget or the provider sent a blank turn. One
        // retry forcing a plain text answer; after that, a proper handoff
        // instead of an unhelpful line.
        if (!retriedForText) {
          retriedForText = true;
          continue;
        }
        return fallback(`empty answer from ${model} (finish: ${choice.finish_reason})`);
      }

      await persistReply(text);
      return { reply: text, handedOff, booked };
    }
    return fallback("agent loop limit reached");
  } catch (e) {
    return fallback(e instanceof Error ? e.message.slice(0, 120) : "API error");
  }
}
