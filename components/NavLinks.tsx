"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
            className={`nav-link ${active ? "nav-link-active" : ""}`}>
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
