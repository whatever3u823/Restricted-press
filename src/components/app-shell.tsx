"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { createCollection } from "@/app/actions";
import { Mark, Wordmark } from "./brand";
import {
  ArchivistIcon,
  ConnectionsIcon,
  FolderIcon,
  HighlightIcon,
  LibraryIcon,
  MenuIcon,
  SearchIcon,
  UploadIcon,
} from "./icons";
import { CommandPalette } from "./palette";

type Props = {
  user: { name: string; email: string };
  plan: "member" | "fellow";
  collections: { id: number; name: string; n: number }[];
  documents: number;
  highlights: number;
  children: React.ReactNode;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "·";

export function AppShell({ user, plan, collections, documents, highlights, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const immersive = /^\/d\/\d+\/read\//.test(pathname);
  const paletteEl = palette ? <CommandPalette onClose={() => setPalette(false)} /> : null;
  if (immersive) {
    return (
      <>
        {children}
        {paletteEl}
      </>
    );
  }

  const nav = [
    { href: "/library", label: "Library", icon: LibraryIcon, n: documents, match: (p: string) => p === "/library" || p.startsWith("/d/") },
    { href: "/archivist", label: "The Archivist", icon: ArchivistIcon, match: (p: string) => p.startsWith("/archivist") },
    { href: "/connections", label: "Connections", icon: ConnectionsIcon, match: (p: string) => p.startsWith("/connections") },
    { href: "/highlights", label: "Highlights", icon: HighlightIcon, n: highlights, match: (p: string) => p.startsWith("/highlights") },
    { href: "/search", label: "Search the text", icon: SearchIcon, match: (p: string) => p.startsWith("/search") },
  ];

  return (
    <div className="app">
      <header className="appbar">
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="Open navigation">
          <MenuIcon />
        </button>
        <Wordmark href="/library" />
        <button type="button" className="icon-btn" onClick={() => setPalette(true)} aria-label="Search and commands">
          <SearchIcon />
        </button>
      </header>
      {open ? <button type="button" className="side-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <aside className="side" data-open={open} aria-label="Library navigation">
        <div className="side__brand">
          <Wordmark href="/library" />
        </div>
        <button type="button" className="side__cmd" onClick={() => setPalette(true)}>
          <SearchIcon />
          <span>Find or ask…</span>
          <span className="kbd">⌘K</span>
        </button>
        <div className="side__group">
          <nav className="side__nav" aria-label="Primary">
            {nav.map(({ href, label, icon: Icon, n, match }) => (
              <Link key={href} href={href} className="side__link" aria-current={match(pathname) ? "page" : undefined}>
                <Icon />
                <span className="label-text">{label}</span>
                {n ? <span className="n">{n}</span> : null}
              </Link>
            ))}
            <Link href="/library/add" className="side__link" aria-current={pathname === "/library/add" ? "page" : undefined}>
              <UploadIcon />
              <span className="label-text">Add documents</span>
            </Link>
          </nav>
        </div>
        <Suspense fallback={null}>
          <Collections collections={collections} />
        </Suspense>
        <div className="side__foot">
          {plan === "member" ? (
            <Link href="/membership" className="side__link" style={{ marginBottom: 6 }}>
              <Mark className="" />
              <span className="label-text brass" style={{ fontSize: 12.5 }}>
                Become a Fellow
              </span>
            </Link>
          ) : null}
          <Link href="/account" className="side__account" aria-current={pathname === "/account" ? "page" : undefined}>
            <span className="avatar">{initials(user.name)}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
              <span className={`plan-pill${plan === "fellow" ? " plan-pill--fellow" : ""}`}>{plan === "fellow" ? "Fellow" : "Member"}</span>
            </span>
            <span className="side__account-go" aria-hidden="true">
              ⋯
            </span>
          </Link>
        </div>
      </aside>
      <div className="main" id="main">
        {children}
      </div>
      {paletteEl}
    </div>
  );
}

function Collections({ collections }: { collections: Props["collections"] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const current = pathname === "/library" ? params.get("c") : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const r = await createCollection(name);
      if (r.ok) {
        setName("");
        setAdding(false);
        router.push(`/library?c=${r.id}`);
        router.refresh();
      }
    });
  };

  return (
    <div className="side__group">
      <div className="side__label">
        <span>Collections</span>
        <button type="button" onClick={() => setAdding((a) => !a)} aria-label="New collection" title="New collection">
          +
        </button>
      </div>
      <nav className="side__nav" aria-label="Collections">
        {collections.map((c) => (
          <Link key={c.id} href={`/library?c=${c.id}`} className="side__link" aria-current={current === String(c.id) ? "page" : undefined}>
            <FolderIcon />
            <span className="label-text">{c.name}</span>
            <span className="n">{c.n}</span>
          </Link>
        ))}
        {!collections.length && !adding ? (
          <button type="button" className="side__link" onClick={() => setAdding(true)} style={{ border: 0, background: "none", cursor: "pointer", color: "var(--fg-4)", fontSize: 13 }}>
            <FolderIcon />
            <span className="label-text">Create a collection</span>
          </button>
        ) : null}
      </nav>
      {adding ? (
        <form className="side__add" onSubmit={submit}>
          <input
            className="input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            maxLength={80}
            aria-label="Collection name"
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          />
          <button className="btn btn--sm" type="submit" disabled={pending || !name.trim()}>
            Add
          </button>
        </form>
      ) : null}
    </div>
  );
}
