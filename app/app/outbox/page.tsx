import { prisma } from "@/lib/db";
import { runDueSends } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function OutboxPage() {
  const msgs = await prisma.outbox.findMany({
    orderBy: { sendAt: "asc" },
    take: 100,
    include: { lead: { select: { name: true, leadCode: true, phone: true, optedOut: true } } }
  });
  const due = msgs.filter((m) => !m.sentAt && m.sendAt <= new Date() && !m.lead.optedOut).length;
  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Messages</h1>
          <p className="mt-1 text-sm text-ink/50">
            Mocked SMS queue: visit confirmations plus reminders 1 day and 2 hours before.
            In production a scheduler sends these; here, run it by hand. Opted-out numbers never queue.
          </p>
        </div>
        <form action={runDueSends}>
          <button className="btn" disabled={due === 0}>Send {due} due now</button>
        </form>
      </div>
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-line">
            <tr><th className="th">To</th><th className="th">Type</th><th className="th">Send at</th><th className="th">Status</th><th className="th">Body</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {msgs.map((m) => (
              <tr key={m.id}>
                <td className="td">{m.lead.name} <span className="text-xs text-ink/40">{m.lead.phone.replace(/(\+91\d{2})\d{4}/, "$1XXXX")}</span></td>
                <td className="td"><span className="chip">{m.type.toLowerCase().replace("_", " ")}</span></td>
                <td className="td text-ink/70">{m.sendAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</td>
                <td className="td">{m.sentAt ? <span className="text-pine">sent</span> : <span className="text-ink/40">queued</span>}</td>
                <td className="td max-w-[220px] truncate text-ink/60" title={m.body}>{m.body}</td>
              </tr>
            ))}
            {msgs.length === 0 && (
              <tr><td colSpan={5} className="td py-10 text-center text-ink/50">Nothing queued. Book a visit from the chat to see confirmations and reminders appear.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
