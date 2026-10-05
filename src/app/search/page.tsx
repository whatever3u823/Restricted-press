import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { markedSnippet } from "@/lib/html";
import { passageRef } from "@/lib/library";
import { toConcepts } from "@/lib/search/query";
import { retriever } from "@/lib/search/retriever";
import { requireReader } from "@/lib/viewer";

export const metadata: Metadata = { title: "Search the text" };

const PAGE = 25;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const viewer = await requireReader("/search");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 200) ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const hits = q
    ? await retriever.retrieve({ ownerId: viewer.user.id, concepts: toConcepts(q), limit: PAGE + 1, offset: (page - 1) * PAGE })
    : [];
  const more = hits.length > PAGE;
  const shown = hits.slice(0, PAGE);

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head__text">
          <span className="eyebrow eyebrow--rule">Search the text</span>
          <h1 className="h1">Every page you own.</h1>
          <p className="page-head__sub">
            Searches inside every document in your library, passage by passage. Put a phrase in “quotation marks” to
            find it exactly. For questions rather than words, ask the Archivist.
          </p>
        </div>
      </header>
      <form action="/search" role="search" className="toolbar" style={{ borderTop: "1px solid var(--line)" }}>
        <label className="search-inline">
          <SearchIcon />
          <span className="sr-only">Search the text of your library</span>
          <input className="input" name="q" defaultValue={q} placeholder="Words or a “phrase”" autoFocus={!q} autoComplete="off" style={{ fontSize: 15, padding: "11px 14px 11px 34px" }} />
        </label>
        <button className="btn btn--primary" type="submit">
          Search
        </button>
      </form>

      {q ? (
        shown.length ? (
          <>
            <p className="small dim mt-3">
              Passages {(page - 1) * PAGE + 1}–{(page - 1) * PAGE + shown.length} for “{q}”, strongest first
            </p>
            <ol className="hits" role="list">
              {shown.map((h) => (
                <li key={h.id} className="hit">
                  <p className="hit__text" dangerouslySetInnerHTML={{ __html: markedSnippet(h.snippet) }} />
                  <p className="hit__src">
                    <Link href={`/d/${h.documentId}`} className="t">
                      {h.title}
                    </Link>
                    <span>{h.author}</span>
                    <span>{h.sectionTitle}</span>
                    <span className="ref">{passageRef(h.id, h.page)}</span>
                    <Link href={`/p/${h.id}`} className="link small">
                      Read in place
                    </Link>
                  </p>
                </li>
              ))}
            </ol>
            <nav className="spread mt-4" aria-label="Pages">
              {page > 1 ? (
                <Link href={`/search?q=${encodeURIComponent(q)}&page=${page - 1}`} className="btn btn--sm">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              {more ? (
                <Link href={`/search?q=${encodeURIComponent(q)}&page=${page + 1}`} className="btn btn--sm">
                  Next →
                </Link>
              ) : null}
            </nav>
          </>
        ) : (
          <div className="empty mt-4">
            <p className="h2">No passage answers to “{q}”.</p>
            <p className="mt-2">The Archivist searches with a wider vocabulary than these exact words.</p>
          </div>
        )
      ) : null}

      {q ? (
        <div className="notice mt-5">
          <strong>Asking rather than searching?</strong> The Archivist reads these passages for you and answers with citations.{" "}
          <Link href={`/archivist?q=${encodeURIComponent(q)}`} className="link">
            Put “{q}” to the Archivist
          </Link>
        </div>
      ) : null}
    </div>
  );
}
