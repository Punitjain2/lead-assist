import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { addSlot, blockSlot } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SlotsPage() {
  const session = getSession();
  if (session?.role !== "SALES_HEAD") redirect("/app/leads");
  const slots = await prisma.slot.findMany({
    where: { startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
    take: 60
  });
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl">Visit slots</h1>
      <p className="mt-1 text-sm text-ink/50">The assistant books only into these. Block a slot to stop new bookings.</p>

      <form action={addSlot} className="card mt-5 flex flex-wrap items-end gap-3 p-4">
        <label className="text-xs text-ink/50">Project
          <select name="project" className="input mt-1">
            <option value="PROJECT_1">Vrindavan Greens</option>
            <option value="PROJECT_2">Anandam Skyview</option>
          </select>
        </label>
        <label className="text-xs text-ink/50">Date and time
          <input type="datetime-local" name="startsAt" className="input mt-1" required />
        </label>
        <label className="text-xs text-ink/50">Capacity
          <input type="number" name="capacity" defaultValue={3} min={1} max={20} className="input mt-1 w-20" />
        </label>
        <button className="btn">Add slot</button>
      </form>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="border-b border-line">
            <tr><th className="th">When</th><th className="th">Project</th><th className="th">Booked</th><th className="th">Status</th><th className="th"></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {slots.map((s) => {
              const full = s.bookedCount >= s.capacity;
              return (
                <tr key={s.id}>
                  <td className="td">{s.startsAt.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</td>
                  <td className="td text-ink/70">{s.project === "PROJECT_1" ? "Vrindavan Greens" : "Anandam Skyview"}</td>
                  <td className="td">{s.bookedCount} / {s.capacity}</td>
                  <td className="td">{full ? <span className="text-danger">full</span> : <span className="text-pine">open</span>}</td>
                  <td className="td text-right">
                    {!full && (
                      <form action={blockSlot.bind(null, s.id)}>
                        <button className="text-xs text-ink/40 underline hover:text-danger">Block</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {slots.length === 0 && (
              <tr><td colSpan={5} className="td py-10 text-center text-ink/50">No upcoming slots. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
