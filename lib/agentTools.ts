// The four agent tools, shared by every model provider (Anthropic path,
// OpenAI-compatible path). One implementation means the booking atomicity,
// consent rules and handoff logic are identical whichever model drives them.
import { prisma } from "./db";
import { bookVisit, freeSlots } from "./booking";
import { createHandoff } from "./handoff";
import { isValidIndianMobile, normalizePhone } from "./phone";

export type LeadT = NonNullable<Awaited<ReturnType<typeof prisma.lead.findUnique>>>;
export type FactT = NonNullable<Awaited<ReturnType<typeof prisma.factSheet.findUnique>>>;

export const toolSpecs = [
  {
    name: "save_lead_details",
    description:
      "Save details the buyer has shared: name, mobile number, which project, 2 or 3 BHK, budget band, preferred language, and whether they gave consent to be contacted. Call it as soon as you learn any of these.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string", description: "Indian mobile number as the buyer typed it" },
        project: { type: "string", enum: ["PROJECT_1", "PROJECT_2"] },
        wants: { type: "string", description: "e.g. 2 BHK or 3 BHK" },
        budget_band: { type: "string", description: "e.g. 65-80L, 80L-1Cr, 1Cr+" },
        language: { type: "string", enum: ["en", "hi", "gu"] },
        consent: { type: "boolean", description: "true only if the buyer explicitly agreed to be contacted on this number" }
      }
    }
  },
  {
    name: "get_free_slots",
    description: "List genuinely free site-visit slots for a project over the next 10 days.",
    parameters: {
      type: "object",
      properties: { project: { type: "string", enum: ["PROJECT_1", "PROJECT_2"] } },
      required: ["project"]
    }
  },
  {
    name: "book_visit",
    description:
      "Book a site visit into one slot_id returned by get_free_slots. Needs the buyer's name, a valid mobile number and consent saved first. The server re-checks availability; if the slot just filled, offer another.",
    parameters: {
      type: "object",
      properties: { slot_id: { type: "string" } },
      required: ["slot_id"]
    }
  },
  {
    name: "handoff_to_human",
    description:
      "Hand this chat to a named sales executive. Use when: the buyer asks for a person; a question is not answered by the fact sheet; the buyer asks about final price, discount or negotiation; or anything legal/payment related.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", enum: ["buyer_asked", "fact_missing", "price_negotiation", "other"] },
        summary: { type: "string", description: "3-4 line summary: who, what they want, budget, state of the conversation" }
      },
      required: ["reason", "summary"]
    }
  }
];

export type ToolOutcome = {
  result: unknown;
  handedOff?: { execName: string | null };
  booked?: { when: string; project: string };
  lead?: LeadT;
};

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { lead: LeadT; conversationId: string; facts: FactT[] }
): Promise<ToolOutcome> {
  const { lead, conversationId, facts } = ctx;

  if (name === "save_lead_details") {
    const data: Record<string, unknown> = {};
    let result: unknown;
    if (typeof input.name === "string" && input.name.trim()) data.name = input.name.trim();
    if (typeof input.phone === "string" && input.phone.trim()) {
      if (isValidIndianMobile(input.phone)) {
        const phone = normalizePhone(input.phone);
        data.phone = phone;
        const dup = await prisma.lead.findFirst({
          where: { phone, id: { not: lead.id } },
          orderBy: { createdAt: "asc" }
        });
        if (dup) {
          data.duplicateOfId = dup.id;
          data.duplicateNote = `Same number as ${dup.leadCode} (${dup.source})`;
        }
      } else {
        result = { error: "That does not look like a valid 10-digit Indian mobile number. Ask again politely." };
      }
    }
    if (typeof input.project === "string") data.project = input.project;
    if (typeof input.wants === "string") data.wants = input.wants;
    if (typeof input.budget_band === "string") data.budgetBand = input.budget_band;
    if (typeof input.language === "string") data.language = input.language;
    if (typeof input.consent === "boolean") data.consent = input.consent;
    let fresh = lead;
    if (Object.keys(data).length) {
      fresh = await prisma.lead.update({
        where: { id: lead.id },
        data: { ...data, status: lead.status === "NEW" ? "ENGAGED" : lead.status }
      });
    }
    return { result: result ?? { saved: true, known: { name: fresh.name, phone: fresh.phone, consent: fresh.consent } }, lead: fresh };
  }

  if (name === "get_free_slots") {
    const project = String(input.project || lead.project || "PROJECT_1");
    const slots = await freeSlots(project);
    return {
      result: {
        slots: slots.slice(0, 8).map((s) => ({
          slot_id: s.id,
          when: s.startsAt.toLocaleString("en-IN", {
            weekday: "short", day: "numeric", month: "short",
            hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata"
          }),
          seats_left: s.capacity - s.bookedCount
        }))
      }
    };
  }

  if (name === "book_visit") {
    const r = await bookVisit(lead.id, String(input.slot_id || ""));
    if (!r.ok) return { result: { booked: false, code: r.code } };
    const whenText = r.slotStartsAt.toLocaleString("en-IN", {
      weekday: "long", day: "numeric", month: "long",
      hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata"
    });
    const { exec } = await createHandoff(
      lead.id, "other",
      `Visit booked for ${whenText}. ${lead.name}, wants ${lead.wants ?? "?"}, budget ${lead.budgetBand ?? "?"}, project ${r.project}. Chat attached.`
    );
    const fs = facts.find((f) => f.project === r.project);
    return {
      result: {
        booked: true, when: whenText,
        location_pin: fs?.mapsUrl, rera: fs?.rera,
        your_contact: exec?.name ?? "our sales team",
        note: "Confirmation and reminders (1 day and 2 hours before) are queued to their number. Tell the buyer all of this."
      },
      booked: { when: whenText, project: r.project },
      handedOff: { execName: exec?.name ?? null }
    };
  }

  if (name === "handoff_to_human") {
    const { exec } = await createHandoff(lead.id, String(input.reason || "other"), String(input.summary || ""));
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { flagged: true, flagNote: String(input.reason || "other") }
    });
    return {
      result: { done: true, executive: exec?.name ?? "the sales team", note: "Tell the buyer who will contact them." },
      handedOff: { execName: exec?.name ?? null }
    };
  }

  return { result: { error: "unknown tool" } };
}

export function systemPrompt(facts: FactT[], lead: LeadT) {
  const sheets = facts
    .map((f) => `## ${f.title} (${f.project})\nRERA registration: ${f.rera}\nAddress: ${f.address}\n${f.content}`)
    .join("\n\n");
  const name = lead.name.startsWith("Website visitor") ? "" : lead.name;
  return `You are the site-visit assistant for a residential developer in Ahmedabad. You help home buyers over web chat and book site visits.

STRICT RULES
1. State facts ONLY from the fact sheets below. If something is not in them, say a team member will confirm it, then call handoff_to_human with reason fact_missing. Never guess.
2. Never quote a final price, a discount, or negotiate. Price ranges printed in the fact sheet may be read out as "starting from, as per registered details". Any negotiation request goes to handoff_to_human with reason price_negotiation.
3. Reply in the language the buyer writes in: English, Hindi or Gujarati. If they switch, switch.
4. If the buyer asks for a person at any point, call handoff_to_human immediately.
5. Before booking: you need their name, a 10-digit Indian mobile number, and a clear yes to "may we contact you on this number about your enquiry?" (DPDP consent). Save each with save_lead_details as you learn it.
6. Booking: call get_free_slots, offer at most 3 options, then book_visit with the chosen slot_id. If the server says the slot is full, apologise briefly and offer the next options.
7. Keep replies short: 1-3 sentences, warm and plain. One question at a time. No emojis, no exclamation marks.
8. When relevant, mention the RERA registration number once, naturally (e.g. in the first project answer or the booking confirmation).
9. Ask early, conversationally: which project interests them, 2 or 3 BHK, and a budget band. Do not interrogate; weave it in.

WHAT YOU KNOW ABOUT THIS BUYER SO FAR
Name: ${name || "not shared"} | Phone: ${lead.phone || "not shared"} | Consent: ${lead.consent ? "yes" : "no"} | Language: ${lead.language}

FACT SHEETS (the only source of truth)
${sheets}`;
}
