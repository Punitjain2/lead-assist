import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  price_negotiation: "Asked for discount / final price",
  fact_missing: "Question outside the fact sheet",
  buyer_asked: "Asked for a person",
  other: "Assistant unavailable / other"
};

export default async function FlaggedPage() {
  const session = getSession();
  if (session?.role !== "SALES_HEAD") redirect("/app/leads");

  const convs = await prisma.conversation.findMany({
    where: { flagged: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      lead: { select: { id: true, name: true, leadCode: true, assignedTo: { select: { name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 2 }
    }
  });

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl">Flagged chats</h1>
      <p className="mt-1 text-sm text-ink/50">
        The daily review: every conversation the assistant flagged, newest first. Open one to
        read the full chat on the lead page.
      </p>
      <div className="mt-5 space-y-3">
        {convs.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/app/leads/${c.lead.id}`} className="font-medium hover:text-pine">
                {c.lead.name} <span className="text-xs text-ink/40">{c.lead.leadCode}</span>
              </Link>
              <span className="chip">{REASON[c.flagNote ?? "other"] ?? c.flagNote}</span>
            </div>
            <div className="mt-2 space-y-1">
              {[...c.messages].reverse().map((m) => (
                <p key={m.id} className="truncate text-sm text-ink/60">
                  <span className="mr-2 text-xs text-ink/40">{m.role === "BUYER" ? "Buyer" : "Assistant"}</span>
                  {m.content}
                </p>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink/40">
              {c.lead.assignedTo ? `With ${c.lead.assignedTo.name}` : "Unassigned"} |{" "}
              {c.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
            </p>
          </div>
        ))}
        {convs.length === 0 && (
          <div className="card p-10 text-center text-sm text-ink/50">
            Nothing flagged yet. Chats land here when the assistant refuses a discount, hits a
            missing fact, or a buyer asks for a person.
          </div>
        )}
      </div>
    </div>
  );
}
