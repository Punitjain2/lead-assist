import { sourceMetrics, unreached48h } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  PORTAL: "Property portals", SOCIAL: "Social ads", WEBSITE: "Website", HOARDING: "Hoarding"
};
const inr = (n: number) => "Rs " + n.toLocaleString("en-IN");

function fmtMin(m: number | null) {
  if (m === null) return "-";
  if (m < 60) return Math.round(m) + " min";
  if (m < 48 * 60) return (m / 60).toFixed(1) + " h";
  return Math.round(m / 1440) + " d";
}

export default async function Dashboard() {
  const [{ rows, totals }, u48] = await Promise.all([sourceMetrics(), unreached48h()]);
  const maxVisits = Math.max(1, ...rows.map((r) => r.visited));

  const cards = [
    { label: "Median first response", value: fmtMin(totals.medianFirstResponseMin), note: "target under 5 min" },
    { label: "Not reached in 48 h", value: u48.pct.toFixed(0) + "%", note: `${u48.count} of ${u48.total} leads, target under 5%` },
    { label: "Visits completed", value: String(totals.visited), note: `${totals.booked} booked, show-up ${totals.showUpRate !== null ? Math.round(totals.showUpRate * 100) + "%" : "-"}` },
    { label: "Cost per visit", value: totals.costPerVisit !== null ? inr(totals.costPerVisit) : "-", note: `on ${inr(totals.spend)} monthly spend` }
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl">Source dashboard</h1>
      <p className="mt-1 text-sm text-ink/50">Where the ad money turns into footfall, and where it leaks.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs text-ink/50">{c.label}</p>
            <p className="mt-1 font-display text-2xl">{c.value}</p>
            <p className="mt-1 text-[11px] text-ink/40">{c.note}</p>
          </div>
        ))}
      </div>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="border-b border-line">
            <tr>
              <th className="th">Source</th><th className="th">Leads</th><th className="th">Booked</th>
              <th className="th">Visited</th><th className="th">Show-up</th>
              <th className="th">Median response</th><th className="th">Spend</th><th className="th">Cost / visit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.source}>
                <td className="td font-medium">{LABEL[r.source]}</td>
                <td className="td">{r.leads}</td>
                <td className="td">{r.booked}</td>
                <td className="td">
                  <span className="mr-2 inline-block h-2 rounded-sm bg-pine align-middle"
                    style={{ width: `${(r.visited / maxVisits) * 72}px` }} />
                  {r.visited}
                </td>
                <td className="td">{r.showUpRate !== null ? Math.round(r.showUpRate * 100) + "%" : "-"}</td>
                <td className="td">{fmtMin(r.medianFirstResponseMin)}</td>
                <td className="td text-ink/70">{inr(r.spend)}</td>
                <td className="td font-medium">{r.costPerVisit !== null ? inr(r.costPerVisit) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink/40">
        Seeded history mirrors the brief: slow responses and unreached leads before the assistant;
        new website chats get answered in seconds and pull the medians down.
      </p>
    </div>
  );
}
