import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAgent } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  conversationId: z.string().cuid().optional(),
  message: z.string().min(1).max(1000),
  project: z.enum(["PROJECT_1", "PROJECT_2"]).optional()
});

async function nextLeadCode() {
  const last = await prisma.lead.findFirst({ orderBy: { leadCode: "desc" }, select: { leadCode: true } });
  const n = last ? parseInt(last.leadCode.replace("LD-", ""), 10) + 1 : 58210;
  return "LD-" + n;
}

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let conversationId = parsed.conversationId;
  if (!conversationId) {
    const lead = await prisma.lead.create({
      data: {
        leadCode: await nextLeadCode(),
        name: "Website visitor",
        source: "WEBSITE",
        project: parsed.project ?? null
      }
    });
    const conv = await prisma.conversation.create({ data: { leadId: lead.id } });
    conversationId = conv.id;
  } else {
    const exists = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!exists) return NextResponse.json({ error: "Chat not found. Refresh the page." }, { status: 404 });
    const count = await prisma.message.count({ where: { conversationId } });
    if (count > 80) return NextResponse.json({ error: "This chat is quite long. A team member will call you to continue." }, { status: 429 });
  }

  const out = await runAgent(conversationId, parsed.message);
  return NextResponse.json({ conversationId, ...out });
}
