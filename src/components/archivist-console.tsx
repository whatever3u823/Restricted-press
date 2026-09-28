"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { AnswerSource, ArchivistMode, ArchivistResult, QuotaState } from "@/lib/archivist/types";

type Exchange = { key: number; question: string; mode: ArchivistMode } & (
  | { state: "working" }
  | { state: "done"; result: ArchivistResult }
  | { state: "error"; message: string; gate?: string }
);

const fileNo = (n: number) => `FILE ${String(n).padStart(4, "0")}`;

export function ArchivistConsole(props: {
  initialQuestion: string;
  autoRun: boolean;
  scope: { slug: string; title: string; file: string } | null;
  passage: string | null;
  suggestions: string[];
  quota: QuotaState;
  canDeep: boolean;
  signedIn: boolean;
  generative: boolean;
}) {
  const [question, setQuestion] = useState(props.initialQuestion);
  const [mode, setMode] = useState<ArchivistMode>("standard");
  const [scope, setScope] = useState(props.scope);
  const [passage, setPassage] = useState(props.passage);
  const [quota, setQuota] = useState(props.quota);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const counter = useRef(0);
  const ran = useRef(false);
  const busy = exchanges.some((e) => e.state === "working");

  const ask = useCallback(
    async (q: string, m: ArchivistMode) => {
      const text = q.trim();
      if (text.length < 3) return;
      const key = ++counter.current;
      setExchanges((xs) => [{ key, question: text, mode: m, state: "working" }, ...xs]);
      try {
        const res = await fetch("/api/archivist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: text, mode: m, scope: scope?.slug ?? null, passage }),
        });
        const data = await res.json();
        if (data.quota) setQuota(data.quota);
        setExchanges((xs) =>
          xs.map((x) =>
            x.key !== key
              ? x
              : res.ok
                ? { key, question: text, mode: m, state: "done", result: data.result as ArchivistResult }
                : { key, question: text, mode: m, state: "error", message: data.error ?? "Something went wrong.", gate: data.gate },
          ),
        );
      } catch {
        setExchanges((xs) =>
          xs.map((x) => (x.key === key ? { key, question: text, mode: m, state: "error", message: "The archive could not be reached. Check your connection and try again." } : x)),
        );
      }
    },
    [scope, passage],
  );

  useEffect(() => {
    if (props.autoRun && !ran.current && props.initialQuestion) {
      ran.current = true;
      void ask(props.initialQuestion, "standard");
    }
  }, [props.autoRun, props.initialQuestion, ask]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!busy) void ask(question, mode);
  };

  const exhausted = quota.remaining === 0;

  return (
    <>
      <form className="archivist-form mt-4" onSubmit={submit}>
        {scope || passage ? (
          <div className="row" style={{ gap: 8 }}>
            {scope ? (
              <span className="tag" style={{ borderColor: "var(--ink)" }}>
                Within {scope.file} · <em>{scope.title}</em>{" "}
                <button type="button" onClick={() => setScope(null)} aria-label="Search the whole archive instead" style={{ border: 0, background: "none", cursor: "pointer", padding: "0 0 0 4px" }}>
                  ✕
                </button>
              </span>
            ) : null}
            {passage ? (
              <span className="tag" style={{ borderColor: "var(--ink)" }}>
                About ¶ {passage}{" "}
                <button type="button" onClick={() => setPassage(null)} aria-label="Stop asking about this passage" style={{ border: 0, background: "none", cursor: "pointer", padding: "0 0 0 4px" }}>
                  ✕
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
        <label htmlFor="archivist-q" className="visually-hidden">
          Your question
        </label>
        <textarea
          id="archivist-q"
          className="archivist-input"
          rows={2}
          value={question}
          maxLength={600}
          placeholder="e.g. Find texts discussing ritual purification before invocation"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!busy) void ask(question, mode);
            }
          }}
        />
        <div className="archivist-controls">
          <div className="mode-switch" role="group" aria-label="Research depth">
            <button type="button" aria-pressed={mode === "standard"} onClick={() => setMode("standard")}>
              Standard
            </button>
            <button
              type="button"
              aria-pressed={mode === "deep"}
              onClick={() => setMode("deep")}
              title={props.canDeep ? "Wider search, more sources, comparison across texts" : "Deep research is part of the Inner Archive"}
            >
              Deep research {props.canDeep ? null : <LockIcon />}
            </button>
          </div>
          <div className="row">
            <QuotaNote quota={quota} signedIn={props.signedIn} />
            <button className="btn" type="submit" disabled={busy || exhausted || question.trim().length < 3}>
              {busy ? "Consulting…" : "Ask the Archivist"}
            </button>
          </div>
        </div>
        {mode === "deep" && !props.canDeep ? (
          <div className="notice">
            <strong>Deep research is part of the Inner Archive.</strong> It widens the search with historical vocabulary,
            reads twice as many passages, and compares how different texts treat your question.{" "}
            <Link href="/membership">Unlock the deeper archive →</Link>
          </div>
        ) : null}
      </form>

      {exchanges.length === 0 ? (
        <div className="mt-6">
          <span className="label">Lines of enquiry</span>
          <div className="suggestions mt-2">
            {props.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuestion(s);
                  if (!busy && !exhausted) void ask(s, mode === "deep" && !props.canDeep ? "standard" : mode);
                }}
              >
                {s}
              </button>
            ))}
          </div>
          {!props.generative ? (
            <p className="notice mt-6">
              <strong>Retrieval-only mode.</strong> The Archivist’s interpretive layer is not enabled on this
              installation, so it will return the passages it would read — ranked, cited and linked — without a
              written answer.
            </p>
          ) : null}
        </div>
      ) : null}

      {exchanges.map((x) => (
        <ExchangeView key={x.key} exchange={x} />
      ))}
    </>
  );
}

function QuotaNote({ quota, signedIn }: { quota: QuotaState; signedIn: boolean }) {
  if (quota.limit === null) return <span className="meta">Inner Archive · unlimited</span>;
  if (quota.remaining === 0) {
    return (
      <span className="meta">
        No questions left today ·{" "}
        {signedIn ? <Link href="/membership">go unlimited</Link> : <Link href="/sign-up">create an account</Link>}
      </span>
    );
  }
  return (
    <span className="meta">
      {quota.remaining} of {quota.limit} questions left today
    </span>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-label="Inner Archive">
      <rect x="2" y="5.5" width="8" height="5.5" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
    </svg>
  );
}

function ExchangeView({ exchange: x }: { exchange: Exchange }) {
  const [active, setActive] = useState<number | null>(null);
  const root = useRef<HTMLElement>(null);

  const focusSource = (n: number) => {
    setActive(n);
    root.current?.querySelector(`[data-source="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="exchange" ref={root} aria-live="polite" aria-busy={x.state === "working"}>
      <p className="exchange__q">{x.question}</p>
      {x.state === "working" ? (
        <div className="working">
          <span className="working__bar" />
          {x.mode === "deep" ? "Planning the search · reading across the archive" : "Searching the archive · reading passages"}
        </div>
      ) : x.state === "error" ? (
        <div className="notice">
          <strong>{x.message}</strong>{" "}
          {x.gate ? <Link href={x.gate === "archivist.unlimited" && !x.message.includes("Inner") ? "/sign-up" : "/membership"}>Continue →</Link> : null}
        </div>
      ) : (
        <ResultView result={x.result} active={active} onCite={focusSource} />
      )}
    </section>
  );
}

function ResultView({ result: r, active, onCite }: { result: ArchivistResult; active: number | null; onCite: (n: number) => void }) {
  const records = new Set([...r.sources, ...r.consulted].map((s) => s.accession)).size;

  if (r.status === "no_results") {
    return (
      <div className="answer">
        <span className="label">Answer</span>
        <div className="answer__body">
          <p>I can find nothing in the archive on this. The collection is still small, and the question may lie outside it.</p>
          <p className="meta mt-2">
            Searched for: {r.searchedFor.join(", ") || "—"}. Try other terms, or <Link href="/archive">browse the records</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {r.status === "retrieval_only" ? (
        <div className="answer">
          <span className="label">Answer</span>
          <div>
            <p className="answer__body">
              These are the passages the archive holds that bear most directly on your question, strongest first.
            </p>
            <p className="meta mt-2">
              Retrieval-only mode — no written answer is generated on this installation. Searched for:{" "}
              {r.searchedFor.join(", ")}.
            </p>
          </div>
        </div>
      ) : (
        <div className="answer">
          <div>
            <span className="label">{r.status === "insufficient" ? "Finding" : "Answer"}</span>
            <p className="meta mt-1" style={{ fontSize: 12 }}>
              {r.mode === "deep" ? "Deep research" : "Standard"}
            </p>
          </div>
          <div>
            {r.status === "insufficient" ? (
              <p className="notice" style={{ marginBottom: 16 }}>
                <strong>The archive does not directly answer this.</strong> The Archivist found no passage it could cite in support.
              </p>
            ) : null}
            <div className="answer__body">
              {r.paragraphs.map((para, i) => (
                <p key={i}>
                  {para.map((span, j) => (
                    <Fragment key={j}>
                      <span className={span.cites.length ? "cited" : undefined}>{span.text}</span>
                      {span.cites.map((n) => (
                        <a
                          key={n}
                          href={`#source-${r.id}-${n}`}
                          className="cite"
                          data-active={active === n}
                          onClick={(e) => {
                            e.preventDefault();
                            onCite(n);
                          }}
                          aria-label={`Source ${n}`}
                        >
                          {n}
                        </a>
                      ))}
                    </Fragment>
                  ))}
                </p>
              ))}
            </div>
            <p className="inference-note">
              <span className="cited" style={{ padding: "0 4px" }}>Underlined</span> text is supported by the cited
              passages. Sentences beginning “Outside the archive” are the Archivist’s own context, not archive evidence.
            </p>
            {r.notes.length ? (
              <div className="notice mt-2">
                <strong>Integrity notes</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {r.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {r.sources.length ? (
        <div className="sources">
          <div>
            <span className="label">Sources</span>
            <p className="meta mt-1" style={{ fontSize: 12 }}>
              Cited sentences marked
            </p>
          </div>
          <ol className="source-list">
            {r.sources.map((s) => (
              <SourceItem key={s.passageId} s={s} id={`source-${r.id}-${s.n}`} active={active === s.n} />
            ))}
          </ol>
        </div>
      ) : null}

      {r.consulted.length ? (
        r.status === "retrieval_only" ? (
          <div className="sources">
            <span className="label">Passages</span>
            <ol className="source-list">
              {r.consulted.map((s) => (
                <SourceItem key={s.passageId} s={s} id={`source-${r.id}-${s.n}`} active={false} />
              ))}
            </ol>
          </div>
        ) : (
          <details className="sources" style={{ display: "block" }}>
            <summary className="label" style={{ cursor: "pointer" }}>
              Also consulted · {r.consulted.length} passage{r.consulted.length === 1 ? "" : "s"} read but not cited
            </summary>
            <ol className="source-list mt-2">
              {r.consulted.map((s) => (
                <SourceItem key={s.passageId} s={s} id={`source-${r.id}-${s.n}`} active={false} />
              ))}
            </ol>
          </details>
        )
      ) : null}

      <p className="meta" style={{ padding: "8px 0 0" }}>
        {r.sources.length + r.consulted.length} passages from {records} record{records === 1 ? "" : "s"} ·{" "}
        {(r.elapsedMs / 1000).toFixed(1)}s{r.scope ? ` · within ${r.scope.title}` : ""}
      </p>
    </>
  );
}

function SourceItem({ s, id, active }: { s: AnswerSource; id: string; active: boolean }) {
  return (
    <li className="source-item" id={id} data-source={s.n} data-active={active}>
      <span className="source-item__n">[{s.n}]</span>
      <div>
        <div className="source-item__file">
          <span className="file-no">{fileNo(s.accession)}</span>
          <Link href={`/archive/${s.slug}`} className="source-item__title">
            <em>{s.title}</em>
          </Link>
          <span className="meta">
            {[s.author, s.year].filter(Boolean).join(", ")} · {s.sectionTitle.replace(/_/g, "")}
          </span>
        </div>
        <p className="source-item__quote">
          <Excerpt text={s.text} quoted={s.quoted} />
        </p>
        <Link href={`/p/${s.passageId}`} className="label" style={{ textDecoration: "none", display: "inline-block", marginTop: 8 }}>
          ¶ {s.passageId} — read in context →
        </Link>
      </div>
    </li>
  );
}

/** Show the passage with the cited sentences marked, trimmed around them if long. */
function Excerpt({ text, quoted }: { text: string; quoted: string[] }) {
  const clean = (t: string) => t.replace(/_/g, "");
  const body = clean(text);
  const ranges: [number, number][] = [];
  for (const q of quoted.map(clean)) {
    const at = body.indexOf(q);
    if (at >= 0) ranges.push([at, at + q.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const LIMIT = 700;
  let start = 0;
  let end = body.length;
  if (body.length > LIMIT) {
    const anchor = ranges[0]?.[0] ?? 0;
    start = Math.max(0, anchor - 200);
    end = Math.min(body.length, Math.max(start + LIMIT, (ranges[ranges.length - 1]?.[1] ?? 0) + 120));
  }
  const parts: React.ReactNode[] = [];
  let cursor = start;
  for (const [a, b] of ranges) {
    if (b <= cursor || a >= end) continue;
    if (a > cursor) parts.push(body.slice(cursor, a));
    parts.push(<mark key={a}>{body.slice(Math.max(a, cursor), Math.min(b, end))}</mark>);
    cursor = Math.min(b, end);
  }
  if (cursor < end) parts.push(body.slice(cursor, end));
  return (
    <>
      {start > 0 ? "… " : ""}
      {parts}
      {end < body.length ? " …" : ""}
    </>
  );
}
