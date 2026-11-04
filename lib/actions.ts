"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./auth";
import { cancelBooking } from "./booking";

function requireStaff() {
  const s = getSession();
  if (!s) throw new Error("Not signed in");
  return s;
}

function requireHead() {
  const s = requireStaff();
  if (s.role !== "SALES_HEAD") throw new Error("Sales head only");
  return s;
}

export async function markBooking(bookingId: string, status: "VISITED" | "NO_SHOW") {
  requireStaff();
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.status !== "BOOKED") return;
  await prisma.booking.update({ where: { id: bookingId }, data: { status } });
  await prisma.lead.update({ where: { id: b.leadId }, data: { status } });
  revalidatePath("/app/leads");
}

export async function cancelBookingAction(bookingId: string) {
  requireStaff();
  await cancelBooking(bookingId);
  revalidatePath("/app/leads");
}

export async function claimHandoff(handoffId: string) {
  const s = requireStaff();
  const h = await prisma.handoff.update({ where: { id: handoffId }, data: { claimed: true, toUserId: s.uid } });
  await prisma.lead.update({ where: { id: h.leadId }, data: { assignedToId: s.uid } });
  revalidatePath("/app/handoffs");
}

export async function saveFactSheet(formData: FormData) {
  requireHead();
  const project = String(formData.get("project"));
  const content = String(formData.get("content") || "").slice(0, 8000);
  const rera = String(formData.get("rera") || "").slice(0, 200);
  const address = String(formData.get("address") || "").slice(0, 300);
  if (!content.trim()) return;
  await prisma.factSheet.update({ where: { project }, data: { content, rera, address } });
  revalidatePath("/app/admin/factsheets");
  revalidatePath("/");
}

export async function addSlot(formData: FormData) {
  requireHead();
  const project = String(formData.get("project"));
  const startsAt = new Date(String(formData.get("startsAt")));
  const capacity = Math.min(20, Math.max(1, parseInt(String(formData.get("capacity") || "3"), 10) || 3));
  if (!["PROJECT_1", "PROJECT_2"].includes(project) || isNaN(startsAt.getTime())) return;
  await prisma.slot.upsert({
    where: { project_startsAt: { project, startsAt } },
    update: { capacity },
    create: { project, startsAt, capacity }
  });
  revalidatePath("/app/admin/slots");
}

export async function blockSlot(slotId: string) {
  requireHead();
  const s = await prisma.slot.findUnique({ where: { id: slotId } });
  if (!s) return;
  await prisma.slot.update({ where: { id: slotId }, data: { capacity: s.bookedCount } });
  revalidatePath("/app/admin/slots");
}

export async function runDueSends() {
  requireStaff();
  await prisma.outbox.updateMany({
    where: { sentAt: null, sendAt: { lte: new Date() }, lead: { optedOut: false } },
    data: { sentAt: new Date() }
  });
  revalidatePath("/app/outbox");
}

export async function toggleOptOut(leadId: string) {
  requireStaff();
  const l = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!l) return;
  const optedOut = !l.optedOut;
  await prisma.lead.update({ where: { id: leadId }, data: { optedOut } });
  if (optedOut) await prisma.outbox.deleteMany({ where: { leadId, sentAt: null } });
  revalidatePath("/app/leads/" + leadId);
}
