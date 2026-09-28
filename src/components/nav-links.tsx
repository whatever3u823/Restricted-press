"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { n: "01", href: "/archive", label: "Archive" },
  { n: "02", href: "/collections", label: "Collections" },
  { n: "03", href: "/archivist", label: "Archivist" },
  { n: "04", href: "/membership", label: "Access" },
];

export function NavLinks({ account }: { account: { label: string; href: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const current = (href: string) =>
    pathname === href || pathname.startsWith(href + "/") || (href === "/collections" && pathname.startsWith("/subjects"))
      ? "page"
      : undefined;

  return (
    <>
      <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : "Index"}
      </button>
      <nav id="site-nav" className="site-nav" data-open={open} aria-label="Primary">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={current(l.href)}>
            <span className="n">{l.n}</span>
            {l.label}
          </Link>
        ))}
        <form action="/archive" role="search" className="nav-search">
          <label htmlFor="nav-q" className="visually-hidden">
            Search the archive
          </label>
          <input id="nav-q" name="q" placeholder="Search files" autoComplete="off" />
        </form>
        <span className="site-nav__account">
          <Link href={account.href} aria-current={current(account.href)}>
            {account.label}
          </Link>
        </span>
      </nav>
    </>
  );
}
