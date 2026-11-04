import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { markBooking, cancelBookingAction, toggleOptOut } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: { id: string } }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: true,
      bookings: { include: { slot: true }, orderBy: { createdAt: "desc" } },
      handoffs: { include: { toUser: true }, orderBy: { createdAt: "desc" } },
      conversations: { include: { messages: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } },
      outbox: { orderBy: { sendAt: "asc" } }
    }
  });
  if (!lead) notFound();
  const dup = lead.duplicateOfId ? await prisma.lead.findUnique({ where: { id: lead.duplicateOfId } }) : null;

  return (
    <div className="max-w-3xl">
      <Link href="/app/leads" className="text-sm text-ink/50 hover:text-pine">Back to leads</Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-2xl">{lead.name}</h1>
        <span className="text-sm text-ink/50">{lead.leadCode}</span>
        {lead.optedOut && <span className="rounded bg-danger/10 px-2 py-0.5 text-xs text-danger">opted out</span>}
      </div>
      {dup && (
        <p className="mt-2 rounded-md bg-amber/10 px-3 py-2 text-sm text-amber">
          {lead.duplicateNote}. Original: <Link className="underline" href={`/app/leads/${dup.id}`}>{dup.leadCode}</Link>
        </p>
      )}

      <dl className="card mt-4 grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-ink/40">Phone</dt><dd>{lead.phone || "-"}</dd></div>
        <div><dt className="text-ink/40">Source</dt><dd>{lead.source}</dd></div>
        <div><dt className="text-ink/40">Project</dt><dd>{lead.project ?? "-"}</dd></div>
        <div><dt className="text-ink/40">Wants</dt><dd>{lead.wants ?? "-"}</dd></div>
        <div><dt className="text-ink/40">Budget</dt><dd>{lead.budgetBand ?? "-"}</dd></div>
        <div><dt className="text-ink/40">Language</dt><dd>{({ en: "English", hi: "Hindi", gu: "Gujarati" } as Record<string,string>)[lead.language]}</dd></div>
        <div><dt className="text-ink/40">Consent</dt><dd>{lead.consent ? "Yes" : "No"}</dd></div>
        <div><dt className="text-ink/40">Assigned</dt><dd>{lead.assignedTo?.name ?? "-"}</dd></div>
        <div>
          <dt className="text-ink/40">Contact preference</dt>
          <dd>
            <form action={toggleOptOut.bind(null, lead.id)}>
              <button className="text-pine underline">{lead.optedOut ? "Re-enable contact" : "Mark opted out"}</button>
            </form>
          </dd>
        </div>
      </dl>

      <section className="mt-6">
        <h2 className="font-display text-lg">Site visits</h2>
        {lead.bookings.length === 0 && <p className="mt-2 text-sm text-ink/50">No visit booked yet.</p>}
        <div className="mt-2 space-y-2">
          {lead.bookings.map((b) => (
            <div key={b.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>
                {b.slot.startsAt.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                <span className="ml-2 text-ink/50">{b.slot.project === "PROJECT_1" ? "Vrindavan Greens" : "Anandam Skyview"}</span>
                <span className="ml-2 chip">{b.status.toLowerCase().replace("_", " ")}</span>
              </span>
              {b.status === "BOOKED" && (
                <span className="flex gap-2">
                  <form action={markBooking.bind(null, b.id, "VISITED")}><button className="btn-ghost text-xs">Mark visited</button></form>
                  <form action={markBooking.bind(null, b.id, "NO_SHOW")}><button className="btn-ghost text-xs">No-show</button></form>
                  <form action={cancelBookingAction.bind(null, b.id)}><button className="btn-ghost text-xs text-danger">Cancel</button></form>
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {lead.handoffs.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-lg">Handoff summary</h2>
          {lead.handoffs.map((h) => (
            <div key={h.id} className="card mt-2 p-3 text-sm">
              <p className="text-ink/80">{h.summary}</p>
              <p className="mt-1 text-xs text-ink/40">
                Reason: {h.reason.replace("_", " ")} | To: {h.toUser?.name ?? "unassigned"} |{" "}
                {h.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-display text-lg">Chat history</h2>
        {lead.conversations.length === 0 && <p className="mt-2 text-sm text-ink/50">No chat yet for this lead.</p>}
        {lead.conversations.map((c) => (
          <div key={c.id} className="card mt-2 space-y-3 p-4">
            {c.flagged && <p className="text-xs text-amber">Flagged for review: {c.flagNote?.replace("_", " ")}</p>}
            {c.messages.map((m) => (
              <p key={m.id} className={`text-sm leading-relaxed ${m.role === "BUYER" ? "text-ink" : "border-l-2 border-pine pl-3 text-ink/70"}`}>
                <span className="mr-2 text-xs text-ink/40">{m.role === "BUYER" ? "Buyer" : "Assistant"}</span>
                {m.content}
              </p>
            ))}
          </div>
        ))}
      </section>

      {lead.outbox.length > 0 && (
        <section className="mt-6 mb-10">
          <h2 className="font-display text-lg">Queued messages</h2>
          <div className="mt-2 space-y-1 text-sm">
            {lead.outbox.map((o) => (
              <p key={o.id} className="text-ink/60">
                <span className="chip mr-2">{o.type.toLowerCase().replace("_", " ")}</span>
                {o.sendAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                {o.sentAt ? " - sent" : " - queued"}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
