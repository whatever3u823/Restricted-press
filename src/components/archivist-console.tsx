"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { AnswerSource, ArchivistMode, ArchivistResult, QuotaState } from "@/lib/archivist/types";

type Exchange = { key: number; question: string; mode: ArchivistMode } & (
  | { state: "working" }
  | { state: "done"; result: ArchivistResult }
  | { state: "error"; message: string; gate?: string }
);

/** "42.003.0012" → "§3 ¶12 · p. 41" (mirrors passageRef on the server). */
const ref = (id: string, page?: number | null) => {
  const [, sec, par] = id.split(".");
  return `§${Number(sec)} ¶${Number(par)}${page ? ` · p. ${page}` : ""}`;
};

export type ConsoleProps = {
  initialQuestion: string;
  autoRun: boolean;
  initialResult: ArchivistResult | null;
  scope: { id: number; title: string }[];
  passage: { id: string; title: string; page: number | null } | null;
  suggestions: string[];
  quota: QuotaState;
  canDeep: boolean;
  generative: boolean;
  libraryCount: number;
};

export function ArchivistConsole(props: ConsoleProps) {
  const router = useRouter();
  const [question, setQuestion] = useState(props.initialResult ? "" : props.initialQuestion);
  const [mode, setMode] = useState<ArchivistMode>("standard");
  const [scope, setScope] = useState(props.scope);
  const [passage, setPassage] = useState(props.passage);
  const [quota, setQuota] = useState(props.quota);
  const [exchanges, setExchanges] = useState<Exchange[]>(
    props.initialResult ? [{ key: 0, question: props.initialResult.question, mode: props.initialResult.mode, state: "done", result: props.initialResult }] : [],
  );
  const counter = useRef(1);
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
          body: JSON.stringify({ question: text, mode: m, documents: scope.map((s) => s.id), passage: passage?.id ?? null }),
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
        if (res.ok) router.refresh();
      } catch {
        setExchanges((xs) =>
          xs.map((x) => (x.key === key ? { key, question: text, mode: m, state: "error", message: "The library could not be reached. Check your connection and try again." } : x)),
        );
      }
    },
    [scope, passage, router],
  );

  useEffect(() => {
    if (props.autoRun && !ran.current && props.initialQuestion) {
      ran.current = true;
      void ask(props.initialQuestion, "standard");
    }
  }, [props.autoRun, props.initialQuestion, ask]);

  const exhausted = quota.remaining === 0;
  const submit = () => {
    if (busy || exhausted || question.trim().length < 3) return;
    void ask(question, mode);
    setQuestion("");
  };

  return (
    <>
      <div className="panel ticks terminal">
        <dl className="terminal__status">
          <div>
            <dt>Library</dt>
            <dd>
              {scope.length
                ? `${scope.length} document${scope.length === 1 ? "" : "s"} in scope`
                : `${props.libraryCount} document${props.libraryCount === 1 ? "" : "s"}`}
            </dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd className="on">Source-bound</dd>
          </div>
          <div>
            <dt>Output</dt>
            <dd>{props.generative ? "Cited answers" : "Sources only"}</dd>
          </div>
          <div>
            <dt>Today</dt>
            <dd>
              {quota.limit === null ? (
                "Unlimited"
              ) : exhausted ? (
                <Link href="/membership" className="signal" style={{ textDecoration: "none" }}>
                  No questions left
                </Link>
              ) : (
                `${quota.remaining} of ${quota.limit} questions left`
              )}
            </dd>
          </div>
        </dl>
        <form
          className="terminal__form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {scope.length || passage ? (
            <div className="scope-tags">
              {scope.map((s) => (
                <span key={s.id} className="chip" aria-current="true">
                  Within <em style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</em>
                  <button type="button" onClick={() => setScope((xs) => xs.filter((x) => x.id !== s.id))} aria-label={`Stop confining to ${s.title}`}>
                    ✕
                  </button>
                </span>
              ))}
              {passage ? (
                <span className="chip" aria-current="true">
                  About {ref(passage.id, passage.page)}
                  <button type="button" onClick={() => setPassage(null)} aria-label="Stop asking about this passage">
                    ✕
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}
          <label htmlFor="archivist-q" className="sr-only">
            Your question
          </label>
          <textarea
            id="archivist-q"
            className="query-input"
            rows={2}
            value={question}
            maxLength={1000}
            placeholder="Ask anything of your library…"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="terminal__controls">
            <div className="seg" role="group" aria-label="Research depth">
              <button type="button" aria-pressed={mode === "standard"} onClick={() => setMode("standard")}>
                Standard
              </button>
              <button
                type="button"
                aria-pressed={mode === "deep"}
                onClick={() => setMode("deep")}
                title={props.canDeep ? "Wider search, twice the sources, comparison across documents" : "Deep research is part of the Fellowship"}
              >
                Deep research {props.canDeep ? null : <span className="dim">· Fellows</span>}
              </button>
            </div>
            <div className="row" style={{ ["--gap" as string]: "14px" }}>
              <span className="hint">
                <span className="kbd">↵</span> to ask
              </span>
              <button className="btn btn--primary" type="submit" disabled={busy || exhausted || question.trim().length < 3 || (mode === "deep" && !props.canDeep)}>
                {busy ? "Consulting…" : "Consult"}
              </button>
            </div>
          </div>
          {mode === "deep" && !props.canDeep ? (
            <div className="notice mt-3">
              <strong>Deep research is part of the Fellowship.</strong> It widens the search, reads twice as many
              passages, and compares how different authors treat your question.{" "}
              <Link href="/membership" className="link">
                The Fellowship
              </Link>
            </div>
          ) : null}
        </form>
      </div>

      {exchanges.length === 0 ? (
        <section className="mt-5">
          <span className="eyebrow">Lines of enquiry</span>
          <ul className="suggest mt-2" role="list" style={{ borderTop: "1px solid var(--line)" }}>
            {props.suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(s);
                    if (!busy && !exhausted) void ask(s, mode === "deep" && !props.canDeep ? "standard" : mode);
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
          {!props.generative ? (
            <p className="notice mt-4">
              <strong>Sources-only mode.</strong> The Archivist’s language model is not enabled on this installation, so it
              returns the passages it would read — ranked, referenced and linked — without writing an answer.
            </p>
          ) : null}
        </section>
      ) : null}

      {exchanges.map((x) => (
        <ExchangeView key={x.key} exchange={x} />
      ))}
    </>
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
      <h2 className="exchange__q">{x.question}</h2>
      {x.state === "working" ? (
        <div className="working">
          <span className="working__bar" />
          {x.mode === "deep" ? "Planning the search · reading across your library" : "Searching your library · reading passages"}
        </div>
      ) : x.state === "error" ? (
        <div className="notice notice--signal mt-3">
          <strong>{x.message}</strong>{" "}
          {x.gate ? (
            <Link href="/membership" className="link">
              The Fellowship
            </Link>
          ) : null}
        </div>
      ) : (
        <ResultView result={x.result} active={active} onCite={focusSource} />
      )}
    </section>
  );
}

function ResultView({ result: r, active, onCite }: { result: ArchivistResult; active: number | null; onCite: (n: number) => void }) {
  const documents = new Set([...r.sources, ...r.consulted].map((s) => s.documentId)).size;
  const meta = (
    <p className="exchange__meta">
      <span>{r.mode === "deep" ? "Deep research" : "Standard"}</span>
      {r.sources.length + r.consulted.length ? (
        <span>
          {r.sources.length + r.consulted.length} passages from {documents} document{documents === 1 ? "" : "s"}
        </span>
      ) : null}
      {r.scope.length ? <span>Within {r.scope.map((s) => s.title).join(", ")}</span> : null}
      <span>{(r.elapsedMs / 1000).toFixed(1)}s</span>
    </p>
  );

  if (r.status === "no_results") {
    return (
      <>
        {meta}
        <div className="answer">
          <p className="answer__body">Your library holds nothing on this.</p>
          <p className="inference">
            Searched for: {r.searchedFor.join(", ") || "—"}. Try other words, widen the scope, or{" "}
            <Link href="/library/add" className="link">
              add documents
            </Link>{" "}
            that address it.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {meta}
      {r.status === "retrieval_only" ? (
        <div className="answer">
          <p className="answer__body">These are the passages in your library that bear most directly on your question, strongest first.</p>
          <p className="inference">Searched for: {r.searchedFor.join(", ")}.</p>
        </div>
      ) : (
        <div className="answer">
          {r.status === "insufficient" ? (
            <p className="notice" style={{ marginBottom: 18 }}>
              <strong>Your library does not directly answer this.</strong> The Archivist found no passage it could cite in support.
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
          <p className="inference">
            Underlined statements are supported by the numbered passages. Sentences beginning “Outside your library” are the
            Archivist’s own context, not evidence from your documents.
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
      )}

      {r.sources.length ? (
        <div className="sources">
          <div className="sources__head">
            <span className="eyebrow">Sources</span>
            <span className="hint">Cited sentences underlined</span>
          </div>
          <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {r.sources.map((s) => (
              <SourceItem key={s.passageId} s={s} id={`source-${r.id}-${s.n}`} active={active === s.n} />
            ))}
          </ol>
        </div>
      ) : null}

      {r.consulted.length ? (
        r.status === "retrieval_only" ? (
          <div className="sources">
            <div className="sources__head">
              <span className="eyebrow">Passages</span>
            </div>
            <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {r.consulted.map((s) => (
                <SourceItem key={s.passageId} s={s} id={`source-${r.id}-${s.n}`} active={false} />
              ))}
            </ol>
          </div>
        ) : (
          <details className="sources">
            <summary className="sources__head" style={{ cursor: "pointer" }}>
              <span className="eyebrow">
                Also read · {r.consulted.length} passage{r.consulted.length === 1 ? "" : "s"} consulted but not cited
              </span>
            </summary>
            <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {r.consulted.map((s) => (
                <SourceItem key={s.passageId} s={s} id={`source-${r.id}-${s.n}`} active={false} />
              ))}
            </ol>
          </details>
        )
      ) : null}
    </>
  );
}

function SourceItem({ s, id, active }: { s: AnswerSource; id: string; active: boolean }) {
  return (
    <li className="src" id={id} data-source={s.n} data-active={active}>
      <span className="src__n">{String(s.n).padStart(2, "0")}</span>
      <div style={{ minWidth: 0 }}>
        <div className="src__head">
          <Link href={`/d/${s.documentId}`} className="src__title">
            {s.title}
          </Link>
          <span className="small muted">{[s.author, s.year].filter(Boolean).join(", ")}</span>
          <span className="ref">
            {s.sectionTitle} · {ref(s.passageId, s.page)}
          </span>
        </div>
        <p className="src__quote">
          <Excerpt text={s.text} quoted={s.quoted} />
        </p>
        <Link href={`/p/${s.passageId}`} className="src__link arrow">
          Read in place
        </Link>
      </div>
    </li>
  );
}

/** Show the passage with the cited sentences marked, trimmed around them if long. */
function Excerpt({ text, quoted }: { text: string; quoted: string[] }) {
  const ranges: [number, number][] = [];
  for (const q of quoted) {
    const at = text.indexOf(q);
    if (at >= 0) ranges.push([at, at + q.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const LIMIT = 700;
  let start = 0;
  let end = text.length;
  if (text.length > LIMIT) {
    const anchor = ranges[0]?.[0] ?? 0;
    start = Math.max(0, anchor - 200);
    end = Math.min(text.length, Math.max(start + LIMIT, (ranges[ranges.length - 1]?.[1] ?? 0) + 120));
  }
  const parts: React.ReactNode[] = [];
  let cursor = start;
  for (const [a, b] of ranges) {
    if (b <= cursor || a >= end) continue;
    if (a > cursor) parts.push(text.slice(cursor, a));
    parts.push(<mark key={a}>{text.slice(Math.max(a, cursor), Math.min(b, end))}</mark>);
    cursor = Math.min(b, end);
  }
  if (cursor < end) parts.push(text.slice(cursor, end));
  return (
    <>
      {start > 0 ? "… " : ""}
      {parts}
      {end < text.length ? " …" : ""}
    </>
  );
}
