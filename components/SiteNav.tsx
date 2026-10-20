"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Заходи" },
  { href: "/tickets", label: "Мої квитки" },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex w-full max-w-5xl gap-6 px-4 pt-6 text-sm font-medium sm:px-6">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" || pathname.startsWith("/events") : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "text-foreground" : "text-muted transition-colors hover:text-foreground"}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
