import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { saveFactSheet } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function FactSheetsPage() {
  const session = getSession();
  if (session?.role !== "SALES_HEAD") redirect("/app/leads");
  const sheets = await prisma.factSheet.findMany({ orderBy: { project: "asc" } });
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl">Fact sheets</h1>
      <p className="mt-1 text-sm text-ink/50">
        The only things the assistant is allowed to say. Save, and the very next chat answer uses the new text.
      </p>
      {sheets.map((s) => (
        <form key={s.id} action={saveFactSheet} className="card mt-5 space-y-3 p-4">
          <input type="hidden" name="project" value={s.project} />
          <h2 className="font-display text-lg">{s.title}</h2>
          <label className="block text-xs text-ink/50">RERA registration number
            <input name="rera" defaultValue={s.rera} className="input mt-1" required />
          </label>
          <label className="block text-xs text-ink/50">Address
            <input name="address" defaultValue={s.address} className="input mt-1" required />
          </label>
          <label className="block text-xs text-ink/50">Fact sheet
            <textarea name="content" defaultValue={s.content} rows={12} className="input mt-1 font-mono text-xs" required />
          </label>
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink/40">Last saved {s.updatedAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</p>
            <button className="btn">Save fact sheet</button>
          </div>
        </form>
      ))}
    </div>
  );
}
