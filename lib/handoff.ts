import { prisma } from "./db";

// Round-robin: the executive with the fewest open handoffs gets the next lead.
export async function assignExecutive() {
  const execs = await prisma.user.findMany({
    where: { role: "SALES_EXEC" },
    include: { _count: { select: { handoffs: { where: { claimed: false } } } } }
  });
  if (execs.length === 0) return null;
  execs.sort((a, b) => a._count.handoffs - b._count.handoffs);
  return execs[0];
}

export async function createHandoff(leadId: string, reason: string, summary: string) {
  const exec = await assignExecutive();
  const h = await prisma.handoff.create({
    data: { leadId, reason, summary, toUserId: exec?.id ?? null }
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "HANDED_OFF", assignedToId: exec?.id ?? null }
  });
  return { handoff: h, exec };
}
