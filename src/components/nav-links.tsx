"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/archive", label: "The Archive" },
  { href: "/archivist", label: "The Archivist" },
  { href: "/membership", label: "Inner Archive" },
  { href: "/editions", label: "Restricted Editions" },
];

export function NavLinks({ account }: { account: { label: string; href: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const current = (href: string) => (pathname === href || pathname.startsWith(href + "/") ? "page" : undefined);

  return (
    <>
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Close" : "Menu"}
      </button>
      <nav id="site-nav" className="site-nav" data-open={open} aria-label="Primary">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={current(l.href)}>
            {l.label}
          </Link>
        ))}
        <span className="site-nav__account">
          <Link href={account.href} aria-current={current(account.href)}>
            {account.label}
          </Link>
        </span>
      </nav>
    </>
  );
}
