import { prisma } from "./db";

export type SourceRow = {
  source: string; leads: number; booked: number; visited: number; noShow: number;
  showUpRate: number | null; medianFirstResponseMin: number | null;
  spend: number; costPerVisit: number | null;
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function sourceMetrics(): Promise<{ rows: SourceRow[]; totals: SourceRow }> {
  const [leads, bookings, spends] = await Promise.all([
    prisma.lead.findMany({ select: { id: true, source: true, createdAt: true, firstResponseAt: true } }),
    prisma.booking.findMany({ include: { lead: { select: { source: true } } } }),
    prisma.sourceSpend.findMany()
  ]);
  const sources = ["PORTAL", "SOCIAL", "WEBSITE", "HOARDING"];
  const rows = sources.map((source) => {
    const ls = leads.filter((l) => l.source === source);
    const bs = bookings.filter((b) => b.lead.source === source);
    const booked = bs.filter((b) => b.status !== "CANCELLED").length;
    const visited = bs.filter((b) => b.status === "VISITED").length;
    const noShow = bs.filter((b) => b.status === "NO_SHOW").length;
    const rts = ls
      .filter((l) => l.firstResponseAt)
      .map((l) => (l.firstResponseAt!.getTime() - l.createdAt.getTime()) / 60000);
    const spend = spends.find((s) => s.source === source)?.monthlySpend ?? 0;
    return {
      source, leads: ls.length, booked, visited, noShow,
      showUpRate: visited + noShow ? visited / (visited + noShow) : null,
      medianFirstResponseMin: median(rts),
      spend,
      costPerVisit: visited ? Math.round(spend / visited) : null
    };
  });
  const all = (f: (r: SourceRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const allRts = leads
    .filter((l) => l.firstResponseAt)
    .map((l) => (l.firstResponseAt!.getTime() - l.createdAt.getTime()) / 60000);
  const totals: SourceRow = {
    source: "ALL", leads: all((r) => r.leads), booked: all((r) => r.booked),
    visited: all((r) => r.visited), noShow: all((r) => r.noShow),
    showUpRate: all((r) => r.visited) + all((r) => r.noShow)
      ? all((r) => r.visited) / (all((r) => r.visited) + all((r) => r.noShow)) : null,
    medianFirstResponseMin: median(allRts),
    spend: all((r) => r.spend),
    costPerVisit: all((r) => r.visited) ? Math.round(all((r) => r.spend) / all((r) => r.visited)) : null
  };
  return { rows, totals };
}

export async function unreached48h(): Promise<{ pct: number; count: number; total: number }> {
  const leads = await prisma.lead.findMany({ select: { createdAt: true, firstResponseAt: true } });
  const old = leads.filter((l) => Date.now() - l.createdAt.getTime() > 48 * 3600 * 1000);
  const un = old.filter(
    (l) => !l.firstResponseAt || l.firstResponseAt.getTime() - l.createdAt.getTime() > 48 * 3600 * 1000
  );
  return { pct: old.length ? (un.length / old.length) * 100 : 0, count: un.length, total: old.length };
}
