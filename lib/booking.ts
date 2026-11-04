import { prisma } from "./db";

export type BookResult =
  | { ok: true; bookingId: string; slotStartsAt: Date; project: string }
  | { ok: false; code: "SLOT_FULL" | "SLOT_PAST" | "ALREADY_BOOKED" | "NOT_FOUND" | "NO_CONSENT" | "OPTED_OUT" };

async function releaseSeat(slotId: string) {
  await prisma.$executeRaw`UPDATE "Slot" SET "bookedCount" = "bookedCount" - 1 WHERE "id" = ${slotId} AND "bookedCount" > 0`;
}

// The brief's hard part: never double-book a slot. The capacity check and the
// seat claim are ONE atomic UPDATE, so two simultaneous requests for the last
// seat cannot both pass; the database decides, not the AI. Works identically
// on SQLite (demo) and Postgres (production) with no long-held transaction.
export async function bookVisit(leadId: string, slotId: string): Promise<BookResult> {
  const [lead, slot] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.slot.findUnique({ where: { id: slotId } })
  ]);
  if (!lead || !slot) return { ok: false, code: "NOT_FOUND" };
  if (lead.optedOut) return { ok: false, code: "OPTED_OUT" };
  if (!lead.consent || !lead.phone) return { ok: false, code: "NO_CONSENT" };
  if (slot.startsAt.getTime() < Date.now()) return { ok: false, code: "SLOT_PAST" };

  const existing = await prisma.booking.findFirst({ where: { leadId, status: "BOOKED" } });
  if (existing) return { ok: false, code: "ALREADY_BOOKED" };

  // Atomic seat claim.
  const claimed = await prisma.$executeRaw`
    UPDATE "Slot" SET "bookedCount" = "bookedCount" + 1
    WHERE "id" = ${slotId} AND "bookedCount" < "capacity"`;
  if (claimed === 0) return { ok: false, code: "SLOT_FULL" };

  let bookingId: string;
  try {
    bookingId = (await prisma.booking.create({ data: { leadId, slotId } })).id;
  } catch {
    await releaseSeat(slotId); // unique(leadId, slotId) tripped: give the seat back
    return { ok: false, code: "ALREADY_BOOKED" };
  }

  // Same-lead race guard: if this lead slipped two bookings through in
  // parallel, keep the earliest (deterministic tie-break on id) and roll back
  // this one with a compensating decrement.
  const oldest = await prisma.booking.findFirst({
    where: { leadId, status: "BOOKED" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  if (oldest && oldest.id !== bookingId) {
    await prisma.booking.delete({ where: { id: bookingId } });
    await releaseSeat(slotId);
    return { ok: false, code: "ALREADY_BOOKED" };
  }

  await prisma.lead.update({ where: { id: leadId }, data: { status: "BOOKED" } });

  const fs = await prisma.factSheet.findUnique({ where: { project: slot.project } });
  const when = slot.startsAt;
  const whenText = when.toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric",
    minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata"
  });
  const base = `${fs?.title ?? slot.project} site visit ${whenText}. Location: ${fs?.mapsUrl ?? ""}${fs ? " | RERA " + fs.rera : ""}`;
  await prisma.outbox.createMany({
    data: [
      { leadId, bookingId, type: "CONFIRMATION", sendAt: new Date(), body: `Confirmed: ${base}` },
      { leadId, bookingId, type: "REMINDER_1D", sendAt: new Date(when.getTime() - 24 * 3600 * 1000), body: `Reminder (tomorrow): ${base}` },
      { leadId, bookingId, type: "REMINDER_2H", sendAt: new Date(when.getTime() - 2 * 3600 * 1000), body: `Reminder (in 2 hours): ${base}` }
    ]
  });

  return { ok: true, bookingId, slotStartsAt: when, project: slot.project };
}

export async function cancelBooking(bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.status !== "BOOKED") return false;
  await prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
  await releaseSeat(b.slotId);
  await prisma.outbox.deleteMany({ where: { bookingId, sentAt: null, type: { not: "CONFIRMATION" } } });
  return true;
}

export async function freeSlots(project: string, days = 10) {
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 3600 * 1000);
  const slots = await prisma.slot.findMany({
    where: { project, startsAt: { gt: now, lt: until } },
    orderBy: { startsAt: "asc" }
  });
  return slots.filter((s) => s.bookedCount < s.capacity);
}
