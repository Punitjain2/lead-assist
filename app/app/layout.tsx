import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/app/leads", label: "Leads" },
  { href: "/app/handoffs", label: "Handoffs" },
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/outbox", label: "Messages" }
];
const HEAD_NAV = [
  { href: "/app/flagged", label: "Flagged chats" },
  { href: "/app/admin/factsheets", label: "Fact sheets" },
  { href: "/app/admin/slots", label: "Visit slots" }
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect("/login");
  const nav = session.role === "SALES_HEAD" ? [...NAV, ...HEAD_NAV] : NAV;
  return (
    <div className="min-h-dvh sm:flex">
      <aside className="border-b border-line bg-white sm:w-52 sm:shrink-0 sm:border-b-0 sm:border-r">
        <div className="flex items-center justify-between px-4 py-4 sm:block">
          <Link href="/" className="font-display text-lg">Company A</Link>
          <p className="text-xs text-ink/50 sm:mt-1">{session.name}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 sm:flex-col sm:pb-4">
          <NavLinks items={nav} />
          <form action="/api/logout" method="post" className="sm:mt-2">
            <button className="rounded-md px-3 py-2 text-left text-sm text-ink/40 hover:text-ink">Sign out</button>
          </form>
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
