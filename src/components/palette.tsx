"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccountIcon,
  ArchivistIcon,
  ConnectionsIcon,
  DocIcon,
  HighlightIcon,
  LibraryIcon,
  SearchIcon,
  UploadIcon,
} from "./icons";

type Doc = { id: number; title: string; author: string | null };
type Option = { key: string; group: string; label: string; sub?: string; href: string; icon: (p: { className?: string }) => React.ReactElement };

const PLACES: Omit<Option, "group" | "key">[] = [
  { label: "Library", href: "/library", icon: LibraryIcon },
  { label: "Add documents", href: "/library/add", icon: UploadIcon },
  { label: "The Archivist", href: "/archivist", icon: ArchivistIcon },
  { label: "Connections", href: "/connections", icon: ConnectionsIcon },
  { label: "Highlights", href: "/highlights", icon: HighlightIcon },
  { label: "Search the text", href: "/search", icon: SearchIcon },
  { label: "Account", href: "/account", icon: AccountIcon },
];

/** ⌘K: jump to any document, search the text, or put a question to the Archivist. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/palette?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { documents: [] }))
        .then((d) => setDocs(d.documents ?? []))
        .catch(() => {});
    }, 110);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const options = useMemo(() => {
    const out: Option[] = [];
    const term = q.trim();
    if (term.length >= 2) {
      out.push({ key: "ask", group: "Ask", label: `Ask the Archivist: “${term}”`, href: `/archivist?q=${encodeURIComponent(term)}`, icon: ArchivistIcon });
      out.push({ key: "search", group: "Ask", label: `Search the text for “${term}”`, href: `/search?q=${encodeURIComponent(term)}`, icon: SearchIcon });
    }
    for (const d of docs) {
      out.push({ key: `d${d.id}`, group: term ? "Documents" : "Recently opened", label: d.title, sub: d.author ?? undefined, href: `/d/${d.id}`, icon: DocIcon });
    }
    const places = PLACES.filter((p) => !term || p.label.toLowerCase().includes(term.toLowerCase()));
    for (const p of places) out.push({ ...p, key: p.href, group: "Go to" });
    return out;
  }, [q, docs]);

  useEffect(() => setSel(0), [q, docs.length]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const go = (o?: Option) => {
    if (!o) return;
    onClose();
    router.push(o.href);
  };

  let lastGroup = "";
  return (
    <div
      className="palette"
      role="dialog"
      aria-modal="true"
      aria-label="Find or ask"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette__box">
        <div className="palette__input">
          <SearchIcon />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a document, search the text, or ask the Archivist…"
            aria-label="Find or ask"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(options.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(options[sel]);
              }
            }}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="palette__list" id="palette-list" role="listbox" ref={list}>
          {options.map((o, i) => {
            const head = o.group !== lastGroup ? <div className="palette__group">{o.group}</div> : null;
            lastGroup = o.group;
            const Icon = o.icon;
            return (
              <div key={o.key}>
                {head}
                <button
                  type="button"
                  role="option"
                  data-i={i}
                  aria-selected={i === sel}
                  className="palette__opt"
                  onMouseMove={() => setSel(i)}
                  onClick={() => go(o)}
                >
                  <Icon />
                  <span className="main">{o.label}</span>
                  {o.sub ? <span className="sub">{o.sub}</span> : null}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette__foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> to move
          </span>
          <span>
            <span className="kbd">↵</span> to open
          </span>
        </div>
      </div>
    </div>
  );
}
