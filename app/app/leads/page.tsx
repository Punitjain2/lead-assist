import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  PORTAL: "Property portal", SOCIAL: "Social ad", WEBSITE: "Website", HOARDING: "Hoarding call"
};
const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-sand/60 text-ink/60", ENGAGED: "bg-pine-soft text-pine", BOOKED: "bg-pine text-white",
  VISITED: "bg-pine-dark text-white", NO_SHOW: "bg-danger/10 text-danger", HANDED_OFF: "bg-amber/10 text-amber"
};

export default async function LeadsPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q || "").trim();
  const leads = await prisma.lead.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { leadCode: { contains: q } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { assignedTo: { select: { name: true } } }
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Leads</h1>
          <p className="mt-1 text-sm text-ink/50">One list from every source, duplicates flagged by phone number.</p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search name, phone or LD code" className="input w-64" />
          <button className="btn-ghost">Search</button>
        </form>
      </div>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-line">
            <tr>
              <th className="th">Lead</th><th className="th">Source</th><th className="th">Project</th>
              <th className="th">Wants</th><th className="th">Status</th><th className="th">Assigned</th>
              <th className="th">First response</th><th className="th">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leads.map((l) => {
              const rt = l.firstResponseAt
                ? Math.round((l.firstResponseAt.getTime() - l.createdAt.getTime()) / 60000)
                : null;
              return (
                <tr key={l.id} className="hover:bg-paper">
                  <td className="td">
                    <Link href={`/app/leads/${l.id}`} className="font-medium hover:text-pine">{l.name}</Link>
                    <span className="ml-2 text-xs text-ink/40">{l.leadCode}</span>
                    {l.duplicateOfId && (
                      <span className="ml-2 rounded bg-amber/10 px-1.5 py-0.5 text-[10px] font-medium text-amber" title={l.duplicateNote ?? ""}>
                        duplicate
                      </span>
                    )}
                  </td>
                  <td className="td"><span className="chip">{SOURCE_LABEL[l.source] ?? l.source}</span></td>
                  <td className="td text-ink/70">{l.project === "PROJECT_1" ? "Vrindavan Greens" : l.project === "PROJECT_2" ? "Anandam Skyview" : "-"}</td>
                  <td className="td text-ink/70">{l.wants ?? "-"}</td>
                  <td className="td">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[l.status] ?? ""}`}>
                      {l.status.replace("_", " ").toLowerCase()}
                    </span>
                  </td>
                  <td className="td text-ink/70">{l.assignedTo?.name ?? "-"}</td>
                  <td className="td text-ink/70">
                    {rt === null ? <span className="text-danger">never</span> : rt < 60 ? `${rt} min` : `${Math.round(rt / 60)} h`}
                  </td>
                  <td className="td text-ink/50">{l.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr><td colSpan={8} className="td py-10 text-center text-ink/50">
                No leads match. Clear the search or run the seed script.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
