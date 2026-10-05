"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { markedSnippet } from "@/lib/html";
import { ArrowLeftIcon, CloseIcon, SearchIcon, TocIcon, TypeIcon } from "./icons";

type Theme = "night" | "dusk" | "paper";
const SIZES = [1.04, 1.12, 1.22, 1.34, 1.48, 1.64];
const WIDTHS = { standard: "40rem", wide: "48rem" } as const;
const KEY = "ath-reader";

type Props = {
  documentId: number;
  title: string;
  section: { ordinal: number; title: string; index: number; total: number };
  sections: { ordinal: number; title: string; level: number }[];
  prev: string | null;
  next: string | null;
  children: React.ReactNode;
};

type Found = { id: string; section_ordinal: number; section_title: string; page: number | null; snippet: string };

export function ReaderChrome({ documentId, title, section, sections, prev, next, children }: Props) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("night");
  const [size, setSize] = useState(2);
  const [width, setWidth] = useState<keyof typeof WIDTHS>("standard");
  const [panel, setPanel] = useState<null | "toc" | "find" | "type">(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [scrolled, setScrolled] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      if (s.theme) setTheme(s.theme);
      if (typeof s.size === "number" && s.size >= 0 && s.size < SIZES.length) setSize(s.size);
      if (s.width in WIDTHS) setWidth(s.width);
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme, size, width }));
    } catch {}
  }, [theme, size, width]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(max > 0 ? Math.min(1, window.scrollY / max) : 1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") setPanel(null);
      else if (e.key === "ArrowLeft" && prev) router.push(prev);
      else if (e.key === "ArrowRight" && next) router.push(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  useEffect(() => {
    if (panel !== "find" || q.trim().length < 2) {
      setFound(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/documents/${documentId}/find?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setFound(d.results ?? []))
        .catch(() => {});
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, panel, documentId]);

  // Overall position: sections finished plus progress through this one.
  const progress = ((section.index - 1 + scrolled) / Math.max(1, section.total)) * 100;

  return (
    <div className="reader" data-theme={theme} style={{ ["--reader-size" as string]: `${SIZES[size]}rem`, ["--reader-width" as string]: WIDTHS[width] }}>
      <header className="reader__bar">
        <div className="row" style={{ ["--gap" as string]: "2px", flexWrap: "nowrap" }}>
          <Link href={`/d/${documentId}`} className="icon-btn" aria-label="Back to the document">
            <ArrowLeftIcon />
          </Link>
          <button type="button" className="icon-btn" onClick={() => setPanel(panel === "toc" ? null : "toc")} aria-label="Contents" aria-expanded={panel === "toc"}>
            <TocIcon />
          </button>
        </div>
        <p className="reader__where">
          <b>{title}</b> <span>· § {section.index} of {section.total}</span>
        </p>
        <div className="row" style={{ ["--gap" as string]: "2px", flexWrap: "nowrap" }}>
          <button type="button" className="icon-btn" onClick={() => setPanel(panel === "find" ? null : "find")} aria-label="Find in this document" aria-expanded={panel === "find"}>
            <SearchIcon />
          </button>
          <button type="button" className="icon-btn" onClick={() => setPanel(panel === "type" ? null : "type")} aria-label="Reading settings" aria-expanded={panel === "type"}>
            <TypeIcon />
          </button>
        </div>
        <span className="reader__progress" style={{ width: `${progress}%` }} />
      </header>

      {children}

      {panel ? <button type="button" className="scrim" aria-label="Close panel" onClick={() => setPanel(null)} /> : null}

      <aside className="drawer" data-open={panel === "toc"} aria-label="Contents" aria-hidden={panel !== "toc"}>
        <div className="drawer__head">
          <span className="eyebrow">Contents</span>
          <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close contents">
            <CloseIcon />
          </button>
        </div>
        <div className="drawer__body">
          <ol className="toc" role="list">
            {sections.map((s) => (
              <li key={s.ordinal} data-level={s.level} data-current={s.ordinal === section.ordinal ? "true" : undefined}>
                <Link href={`/d/${documentId}/read/${s.ordinal}`} onClick={() => setPanel(null)} tabIndex={panel === "toc" ? 0 : -1}>
                  <span className="n">{String(s.ordinal).padStart(2, "0")}</span>
                  <span className="t">{s.title}</span>
                  <span />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </aside>

      <aside className="drawer drawer--right" data-open={panel === "find"} aria-label="Find in this document" aria-hidden={panel !== "find"}>
        <div className="drawer__head">
          <span className="eyebrow">Find in this document</span>
          <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close find">
            <CloseIcon />
          </button>
        </div>
        <div className="drawer__body">
          <input
            className="input mt-2"
            placeholder="Words or a “phrase”"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Find in this document"
            tabIndex={panel === "find" ? 0 : -1}
            ref={(el) => {
              if (el && panel === "find") el.focus();
            }}
          />
          {found ? (
            found.length ? (
              <>
                <p className="hint mt-2">
                  {found.length}
                  {found.length >= 80 ? "+" : ""} passage{found.length === 1 ? "" : "s"}
                </p>
                <ul className="find-results" role="list">
                  {found.map((f) => (
                    <li key={f.id}>
                      <Link href={`/d/${documentId}/read/${f.section_ordinal}#p-${f.id}`} onClick={() => setPanel(null)}>
                        <span className="ref">
                          § {f.section_ordinal} · {f.section_title}
                          {f.page ? ` · p. ${f.page}` : ""}
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: markedSnippet(f.snippet) }} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted small mt-3">Nothing in this document matches.</p>
            )
          ) : null}
        </div>
      </aside>

      <aside className="drawer drawer--right" data-open={panel === "type"} aria-label="Reading settings" aria-hidden={panel !== "type"}>
        <div className="drawer__head">
          <span className="eyebrow">Reading room</span>
          <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close settings">
            <CloseIcon />
          </button>
        </div>
        <div className="drawer__body">
          <div className="settings-row">
            <span>Light</span>
            <div className="seg" role="group" aria-label="Light">
              {(["night", "dusk", "paper"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)} tabIndex={panel === "type" ? 0 : -1}>
                  {t === "night" ? "Night" : t === "dusk" ? "Dusk" : "Paper"}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <span>Type size</span>
            <div className="seg" role="group" aria-label="Type size">
              <button type="button" onClick={() => setSize((s) => Math.max(0, s - 1))} disabled={size === 0} aria-label="Smaller" tabIndex={panel === "type" ? 0 : -1}>
                A−
              </button>
              <button type="button" onClick={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))} disabled={size === SIZES.length - 1} aria-label="Larger" tabIndex={panel === "type" ? 0 : -1}>
                A+
              </button>
            </div>
          </div>
          <div className="settings-row">
            <span>Measure</span>
            <div className="seg" role="group" aria-label="Line length">
              {(["standard", "wide"] as const).map((w) => (
                <button key={w} type="button" aria-pressed={width === w} onClick={() => setWidth(w)} tabIndex={panel === "type" ? 0 : -1}>
                  {w === "standard" ? "Standard" : "Wide"}
                </button>
              ))}
            </div>
          </div>
          <p className="hint mt-3">
            Use <span className="kbd">←</span> <span className="kbd">→</span> to move between sections, and <span className="kbd">⌘K</span> to find
            anything in your library.
          </p>
        </div>
      </aside>
    </div>
  );
}
