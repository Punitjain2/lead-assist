// Demo mode: a scripted assistant used when MOCK_AI=1, so the whole flow
// (fact-sheet answers, detail capture, consent, slot listing, booking,
// handoff) can be exercised with no Anthropic key. It calls the SAME server
// functions as the real agent: bookVisit, freeSlots, createHandoff. It is
// English-only and keyword-driven; it is NOT the AI, and the TDD says so.
import { prisma } from "./db";
import { freeSlots, bookVisit } from "./booking";
import { createHandoff } from "./handoff";
import { isValidIndianMobile, normalizePhone } from "./phone";
import type { AgentOutcome } from "./ai";

type Lead = NonNullable<Awaited<ReturnType<typeof prisma.lead.findUnique>>>;

const fmt = (d: Date) =>
  d.toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata"
  });

function detectProject(text: string): string | null {
  const t = text.toLowerCase();
  if (/anandam|skyview|project\s*2/.test(t)) return "PROJECT_2";
  if (/vrindavan|greens|project\s*1/.test(t)) return "PROJECT_1";
  return null;
}

async function doHandoff(lead: Lead, convId: string, reason: string, summary: string) {
  const { exec } = await createHandoff(lead.id, reason, summary);
  await prisma.conversation.update({ where: { id: convId }, data: { flagged: true, flagNote: reason } });
  return exec;
}

async function nextBookingStep(lead: Lead): Promise<string> {
  if (!lead.project) return "Happy to book a visit. Which project shall we visit: Vrindavan Greens or Anandam Skyview?";
  if (!lead.name || lead.name.startsWith("Website visitor")) return "May I have your name, please?";
  if (!lead.phone) return "Thanks. And a 10-digit mobile number we can confirm the visit on?";
  if (!lead.consent) return "May we contact you on this number about your enquiry? (yes/no)";
  const slots = (await freeSlots(lead.project)).slice(0, 3);
  if (slots.length === 0) {
    return "__NO_SLOTS__";
  }
  return (
    "Here are the next free slots:\n" +
    slots.map((s, i) => `${i + 1}) ${fmt(s.startsAt)}`).join("\n") +
    "\nWhich time works for you? Reply 1, 2 or 3."
  );
}

export async function runMockAgent(conversationId: string, userText: string): Promise<AgentOutcome> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: true, messages: { orderBy: { createdAt: "asc" } } }
  });
  if (!conv) return { reply: "This chat has expired. Please refresh the page.", error: true };
  let lead = conv.lead;
  const facts = await prisma.factSheet.findMany({ orderBy: { project: "asc" } });
  const m = userText.toLowerCase().trim();
  const la = [...conv.messages].reverse().find((x) => x.role === "ASSISTANT")?.content ?? "";

  let reply = "";
  let handedOff: AgentOutcome["handedOff"];
  let booked: AgentOutcome["booked"];

  const persist = async (): Promise<AgentOutcome> => {
    await prisma.message.create({ data: { conversationId, role: "ASSISTANT", content: reply } });
    if (!lead.firstResponseAt)
      await prisma.lead.update({ where: { id: lead.id }, data: { firstResponseAt: new Date() } });
    return { reply, handedOff, booked, mock: true };
  };

  const refresh = async () => {
    lead = (await prisma.lead.findUnique({ where: { id: lead.id } }))!;
  };

  // Guardrails first, exactly like the real agent's rules.
  if (/discount|offer price|cash deal|negoti|best price|kam (kar|ho)|less price|final price/.test(m)) {
    const exec = await doHandoff(lead, conversationId, "price_negotiation",
      `${lead.name}, ${lead.wants ?? "config not stated"}, asked about discount/final price. Demo-mode chat attached.`);
    handedOff = { execName: exec?.name ?? null };
    reply = `Final prices and offers are discussed by our sales team only. ${exec ? exec.name : "A team member"} will call you to take this forward. Would you like to book a site visit meanwhile?`;
    return persist();
  }
  if (/\b(human|person|agent|executive|someone|call me|talk to)\b/.test(m)) {
    const exec = await doHandoff(lead, conversationId, "buyer_asked",
      `${lead.name} asked to speak to a person. Demo-mode chat attached.`);
    handedOff = { execName: exec?.name ?? null };
    reply = `Of course. ${exec ? exec.name : "A team member"} from our sales team will reach out to you shortly with this chat.`;
    return persist();
  }

  // Mid-flow steps, inferred from our own last question.
  if (la.includes("Which project shall we visit")) {
    const p = detectProject(m);
    if (p) {
      await prisma.lead.update({ where: { id: lead.id }, data: { project: p, status: "ENGAGED" } });
      await refresh();
      reply = await nextBookingStep(lead);
    } else {
      reply = "Which project shall we visit: Vrindavan Greens or Anandam Skyview?";
    }
  } else if (la.includes("your name")) {
    const name = userText.replace(/^(i am|i'm|my name is|this is)\s*/i, "").trim().slice(0, 60);
    if (name.length >= 2) {
      await prisma.lead.update({ where: { id: lead.id }, data: { name, status: "ENGAGED" } });
      await refresh();
      reply = await nextBookingStep(lead);
    } else {
      reply = "Sorry, I did not catch that. May I have your name, please?";
    }
  } else if (la.includes("10-digit mobile")) {
    if (isValidIndianMobile(userText)) {
      const phone = normalizePhone(userText);
      const dup = await prisma.lead.findFirst({
        where: { phone, id: { not: lead.id } }, orderBy: { createdAt: "asc" }
      });
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          phone,
          duplicateOfId: dup?.id ?? null,
          duplicateNote: dup ? `Same number as ${dup.leadCode} (${dup.source})` : null
        }
      });
      await refresh();
      reply = await nextBookingStep(lead);
    } else {
      reply = "That does not look like a valid Indian mobile number. Could you share the 10-digit number again?";
    }
  } else if (la.includes("May we contact you")) {
    if (/^(y|yes|ok|okay|sure|haan|ha\b)/.test(m)) {
      await prisma.lead.update({ where: { id: lead.id }, data: { consent: true } });
      await refresh();
      reply = await nextBookingStep(lead);
    } else {
      reply = "No problem, we will not contact you. I can still answer questions here whenever you like.";
    }
  } else if (la.includes("Reply 1, 2 or 3") && /^[1-3]\b/.test(m)) {
    const idx = parseInt(m[0], 10) - 1;
    const slots = (await freeSlots(lead.project ?? "PROJECT_1")).slice(0, 3);
    const chosen = slots[idx];
    if (!chosen) {
      reply = "That option is no longer available. " + (await nextBookingStep(lead));
    } else {
      const r = await bookVisit(lead.id, chosen.id);
      if (r.ok) {
        const fs = facts.find((f) => f.project === r.project);
        const whenText = fmt(r.slotStartsAt);
        const exec = (await createHandoff(lead.id, "other",
          `Visit booked for ${whenText}. ${lead.name}, wants ${lead.wants ?? "?"}, project ${r.project}. Demo-mode chat attached.`)).exec;
        handedOff = { execName: exec?.name ?? null };
        booked = { when: whenText, project: r.project };
        reply =
          `Done. Your site visit at ${fs?.title ?? r.project} is confirmed for ${whenText}.\n` +
          `Location: ${fs?.mapsUrl ?? ""}\nRERA: ${fs?.rera ?? ""}\n` +
          `${exec ? exec.name : "A sales executive"} will meet you there. A confirmation and reminders (1 day and 2 hours before) are queued to your number.`;
      } else if (r.code === "SLOT_FULL") {
        reply = "Sorry, that slot just filled up. " + (await nextBookingStep(lead));
      } else if (r.code === "ALREADY_BOOKED") {
        reply = "You already have a visit booked. Our team can reschedule it when they call you.";
      } else {
        reply = "I could not complete that booking. " + (await nextBookingStep(lead));
      }
    }
  } else if (/\b(book|visit|slot|site|come|dekh)/.test(m)) {
    const p = detectProject(m);
    if (p && !lead.project) {
      await prisma.lead.update({ where: { id: lead.id }, data: { project: p } });
      await refresh();
    }
    reply = await nextBookingStep(lead);
  } else if (/price|cost|rate|kitna|lakh|crore|budget|bhk|₹|rs\b/.test(m)) {
    const detected = detectProject(m);
    if (detected && !lead.project) {
      await prisma.lead.update({ where: { id: lead.id }, data: { project: detected, status: "ENGAGED" } });
      await refresh();
    }
    const p = detected ?? lead.project;
    const chosen = p ? facts.filter((f) => f.project === p) : facts;
    if (/2\s*bhk/.test(m) && !lead.wants)
      await prisma.lead.update({ where: { id: lead.id }, data: { wants: "2 BHK" } });
    if (/3\s*bhk/.test(m) && !lead.wants)
      await prisma.lead.update({ where: { id: lead.id }, data: { wants: "3 BHK" } });
    await refresh();
    reply =
      chosen
        .map((f) => {
          const price = f.content.split("\n").find((l) => l.startsWith("Price:")) ?? "";
          const cfg = f.content.split("\n").find((l) => l.startsWith("Configuration:")) ?? "";
          return `${f.title}: ${cfg.replace("Configuration: ", "")} ${price.replace("Price: ", "")} (RERA ${f.rera})`;
        })
        .join("\n") + "\nAre you looking at 2 or 3 BHK? I can also book a site visit for you.";
  } else {
    // Fact lookup: return fact-sheet lines containing a keyword, else hand off.
    const STOP = new Set(["available","tower","towers","project","price","visit","details","sales","team","apartment","apartments","floor","floors","there","about","have","this","that","what","which","please","tell"]);
    const keywords = (m.match(/[a-z]{4,}/g) ?? []).filter((k) => !STOP.has(k));
    const p = detectProject(m) ?? lead.project;
    const sheets = p ? facts.filter((f) => f.project === p) : facts;
    const hits: string[] = [];
    for (const f of sheets) {
      for (const line of f.content.split("\n")) {
        if (keywords.some((k) => line.toLowerCase().includes(k))) hits.push(`${f.title}: ${line}`);
      }
    }
    const questionLike = /[?]|what|which|when|where|how|is there|can i|do you|kya|kab|kaha/.test(m);
    if (hits.length > 0) {
      reply = hits.slice(0, 4).join("\n") + "\nAnything else, or shall I book you a site visit?";
    } else if (!questionLike && conv.messages.filter((x) => x.role === "BUYER").length <= 1) {
      reply =
        "Namaste. I can share registered details of Vrindavan Greens (3 BHK) and Anandam Skyview (2 and 3 BHK), and book your site visit. Which project interests you?";
    } else if (!questionLike) {
      reply = "I can share registered project details or book you a site visit. What would you like to know?";
    } else {
      const exec = await doHandoff(lead, conversationId, "fact_missing",
        `Question not covered by the fact sheet: "${userText.slice(0, 160)}". Demo-mode chat attached.`);
      handedOff = { execName: exec?.name ?? null };
      reply = `I do not have that in our registered details, so I would rather not guess. ${exec ? exec.name : "A team member"} will confirm it for you. Meanwhile, shall I book you a site visit?`;
    }
  }

  if (reply === "__NO_SLOTS__") {
    const exec = await doHandoff(lead, conversationId, "other",
      `${lead.name} wants a visit but no free slots are open in the next 10 days. Demo-mode chat attached.`);
    handedOff = { execName: exec?.name ?? null };
    reply = `All visit slots in the next few days are taken. ${exec ? exec.name : "A team member"} will call you to fix a time personally.`;
  }
  return persist();
}
