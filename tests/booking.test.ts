import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { bookVisit } from "../lib/booking";
import { normalizePhone, isValidIndianMobile } from "../lib/phone";

const prisma = new PrismaClient();
let slotId: string;
let slot2Id: string;
let leadIds: string[] = [];
let winnerId: string;

beforeAll(async () => {
  const mk = (offsetMin: number, capacity: number) =>
    prisma.slot.create({
      data: {
        project: "PROJECT_1",
        startsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000 + offsetMin * 60000),
        capacity
      }
    });
  slotId = (await mk(Math.floor(Math.random() * 10000), 2)).id;
  slot2Id = (await mk(20000 + Math.floor(Math.random() * 10000), 5)).id;
  for (let i = 0; i < 6; i++) {
    const l = await prisma.lead.create({
      data: {
        leadCode: "TEST-" + Date.now() + "-" + i,
        name: "Race Test " + i,
        phone: "+919999" + String(100000 + i),
        source: "WEBSITE",
        consent: true
      }
    });
    leadIds.push(l.id);
  }
});

afterAll(async () => {
  await prisma.outbox.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.booking.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  await prisma.slot.deleteMany({ where: { id: { in: [slotId, slot2Id] } } });
  await prisma.$disconnect();
});

describe("no double booking (the brief's hard part)", () => {
  it("six simultaneous requests for a 2-seat slot produce exactly 2 bookings", async () => {
    const results = await Promise.all(leadIds.map((id) => bookVisit(id, slotId)));
    const okResults = results.filter((r) => r.ok);
    const full = results.filter((r) => !r.ok && r.code === "SLOT_FULL").length;
    expect(okResults.length).toBe(2);
    expect(full).toBe(4);
    const slot = await prisma.slot.findUnique({ where: { id: slotId } });
    expect(slot?.bookedCount).toBe(2);
    expect(await prisma.booking.count({ where: { slotId } })).toBe(2);
    winnerId = leadIds[results.findIndex((r) => r.ok)];
  });

  it("a lead with an active booking cannot book a second visit", async () => {
    const again = await bookVisit(winnerId, slot2Id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe("ALREADY_BOOKED");
    const slot2 = await prisma.slot.findUnique({ where: { id: slot2Id } });
    expect(slot2?.bookedCount).toBe(0); // the seat was not leaked
  });

  it("booking without consent is refused before any seat is touched", async () => {
    const l = await prisma.lead.create({
      data: { leadCode: "TEST-NC-" + Date.now(), name: "No Consent", phone: "+919999000001", source: "WEBSITE", consent: false }
    });
    leadIds.push(l.id);
    const r = await bookVisit(l.id, slot2Id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NO_CONSENT");
  });

  it("an opted-out lead is never booked or messaged", async () => {
    const l = await prisma.lead.create({
      data: { leadCode: "TEST-OO-" + Date.now(), name: "Opted Out", phone: "+919999000002", source: "WEBSITE", consent: true, optedOut: true }
    });
    leadIds.push(l.id);
    const r = await bookVisit(l.id, slot2Id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("OPTED_OUT");
    expect(await prisma.outbox.count({ where: { leadId: l.id } })).toBe(0);
  });
});

describe("duplicate detection input", () => {
  it("normalises Indian numbers to one canonical form", () => {
    expect(normalizePhone("98250 11223")).toBe("+919825011223");
    expect(normalizePhone("098250-11223")).toBe("+919825011223");
    expect(normalizePhone("+91 9825011223")).toBe("+919825011223");
    expect(isValidIndianMobile("5555")).toBe(false);
    expect(isValidIndianMobile("9825011223")).toBe(true);
  });
});
