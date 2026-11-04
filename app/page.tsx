import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sheets = await prisma.factSheet.findMany({ orderBy: { project: "asc" } });
  return (
    <main className="mx-auto max-w-3xl px-5 pb-16">
      <header className="flex items-center justify-between py-6">
        <span className="font-display text-lg">Company A</span>
        <Link href="/login" className="text-sm text-ink/50 hover:text-pine">Staff sign in</Link>
      </header>

      <section className="pt-10 pb-12">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-pine">Two RERA-registered projects, Ahmedabad</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Two addresses in Ahmedabad.<br />One honest conversation.
        </h1>
        <p className="mt-5 max-w-xl text-ink/60">
          Ask anything about our homes, in English, Hindi or Gujarati. Our assistant answers
          from registered project details only, and books your site visit into a real free slot.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/chat" className="btn">Chat with us</Link>
          <a href="#projects" className="btn-ghost">See the projects</a>
        </div>
        <p className="mt-4 text-xs text-ink/40">Replies in under two minutes, any hour.</p>
      </section>

      <section id="projects" className="grid gap-4 sm:grid-cols-2">
        {sheets.map((s) => (
          <div key={s.id} className="card p-5 hover:border-pine/40">
            <h2 className="font-display text-xl">{s.title}</h2>
            <p className="mt-1 text-sm text-ink/60">{s.address}</p>
            <p className="mt-3 text-sm whitespace-pre-line text-ink/80">
              {s.content.split("\n").slice(0, 3).join("\n")}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <Link href={`/chat?project=${s.project}`} className="text-sm font-medium text-pine hover:underline">
                Ask about {s.title}
              </Link>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-snug text-ink/40">
              RERA: {s.rera}
            </p>
          </div>
        ))}
        {sheets.length === 0 && (
          <div className="card p-8 text-center text-sm text-ink/50 sm:col-span-2">
            No projects yet. Run the seed script to load sample data.
          </div>
        )}
      </section>

      <footer className="mt-14 border-t border-line pt-5 text-[11px] leading-relaxed text-ink/40">
        All details as per registered RERA information. Prices shown are starting prices from
        registered details; final prices are confirmed by the sales team. We contact you only
        with your consent and you can opt out at any time (DPDP Act, 2023).
      </footer>
    </main>
  );
}
