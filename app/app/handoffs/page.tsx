import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { claimHandoff } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function HandoffsPage() {
  const session = getSession();
  const handoffs = await prisma.handoff.findMany({
    orderBy: [{ claimed: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { lead: true, toUser: true }
  });
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl">Handoffs</h1>
      <p className="mt-1 text-sm text-ink/50">
        Serious buyers the assistant has passed over, each with a chat summary. Claim one to own it.
      </p>
      <div className="mt-5 space-y-3">
        {handoffs.map((h) => (
          <div key={h.id} className={`card p-4 ${h.claimed ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/app/leads/${h.lead.id}`} className="font-medium hover:text-pine">
                {h.lead.name} <span className="text-xs text-ink/40">{h.lead.leadCode}</span>
              </Link>
              <span className="chip">{h.reason.replace("_", " ")}</span>
            </div>
            <p className="mt-2 text-sm text-ink/80">{h.summary}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/40">
              <span>
                {h.toUser ? `Assigned to ${h.toUser.name}` : "Unassigned"} |{" "}
                {h.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
              </span>
              {!h.claimed && (
                <form action={claimHandoff.bind(null, h.id)}>
                  <button className="btn-ghost text-xs">
                    {h.toUser?.name === session?.name ? "Accept" : "Claim for me"}
                  </button>
                </form>
              )}
              {h.claimed && <span>Claimed</span>}
            </div>
          </div>
        ))}
        {handoffs.length === 0 && (
          <div className="card p-10 text-center text-sm text-ink/50">
            No handoffs yet. They appear when the assistant passes a buyer to the team.
          </div>
        )}
      </div>
    </div>
  );
}
