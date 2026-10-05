import type { Metadata } from "next";
import Link from "next/link";
import { libraryConnections } from "@/lib/library";
import { requireReader } from "@/lib/viewer";

export const metadata: Metadata = { title: "Connections" };

const pct = (s: number) => `${Math.min(100, Math.round(s * 160))}%`;

export default async function ConnectionsPage() {
  const viewer = await requireReader("/connections");
  const { pairs, authorPairs, authors, considered } = await libraryConnections(viewer.user.id);

  return (
    <div className="page page--wide">
      <header className="page-head">
        <div className="page-head__text">
          <span className="eyebrow eyebrow--rule">Connections</span>
          <h1 className="h1">Where your authors meet.</h1>
          <p className="page-head__sub">
            Athenaeum compares the vocabulary of every document in your library and surfaces the pairs that share the
            most distinctive ground. Ask the Archivist to trace any connection through the text itself.
          </p>
        </div>
      </header>

      {considered < 2 ? (
        <div className="empty">
          <p className="h2">Connections need at least two documents.</p>
          <p className="mt-2">Add more to your library and the map will draw itself.</p>
          <Link href="/library/add" className="btn btn--primary mt-4">
            Add documents
          </Link>
        </div>
      ) : (
        <>
          <section>
            <div className="block__head">
              <h2>Documents in conversation</h2>
              <span className="small dim">Strongest first</span>
            </div>
            {pairs.length ? (
              <ul className="pairs" role="list">
                {pairs.map((p) => (
                  <li key={`${p.a.id}-${p.b.id}`} className="pair">
                    <div className="pair__doc">
                      <Link href={`/d/${p.a.id}`}>{p.a.title}</Link>
                      <p className="by">{p.a.author ?? "Author unknown"}</p>
                    </div>
                    <span className="pair__link" aria-hidden="true" />
                    <div className="pair__doc">
                      <Link href={`/d/${p.b.id}`}>{p.b.title}</Link>
                      <p className="by">{p.b.author ?? "Author unknown"}</p>
                    </div>
                    <Link
                      href={`/archivist?doc=${p.a.id},${p.b.id}&q=${encodeURIComponent(
                        `How do “${p.a.title}” and “${p.b.title}” treat ${p.shared.slice(0, 2).join(" and ")}? Where do they agree, and where do they part ways?`,
                      )}`}
                      className="btn btn--sm btn--brass"
                    >
                      Trace it
                    </Link>
                    <p className="pair__shared">
                      Shared ground: <b>{p.shared.join(", ")}</b>
                      <span className="score" title="Strength of connection">
                        <span style={{ width: pct(p.score) }} />
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No two documents by different authors share enough distinctive ground yet.</p>
            )}
          </section>

          {authors.length ? (
            <section className="mt-6">
              <div className="block__head">
                <h2>Authors</h2>
                <span className="small dim">{authors.length} in your library</span>
              </div>
              <div className="authors">
                {authors.map((a) => (
                  <article key={a.name} className="panel author-card">
                    <h3 className="author-card__name">
                      <Link href={`/library?author=${encodeURIComponent(a.name)}`} style={{ textDecoration: "none" }}>
                        {a.name}
                      </Link>
                    </h3>
                    <p className="author-card__docs clamp-2">
                      {a.documents.length} document{a.documents.length === 1 ? "" : "s"} · {a.documents.map((d) => d.title).join("; ")}
                    </p>
                    <div className="author-card__terms">
                      {a.terms.slice(0, 6).map((t) => (
                        <span key={t} className="term">
                          {t}
                        </span>
                      ))}
                    </div>
                    {a.closest ? (
                      <p className="author-card__near">
                        Closest to <span style={{ color: "var(--fg)" }}>{a.closest.name}</span> — {a.closest.shared.join(", ")}.{" "}
                        <Link
                          href={`/archivist?q=${encodeURIComponent(`Compare how ${a.name} and ${a.closest.name} treat ${a.closest.shared.slice(0, 2).join(" and ")}.`)}`}
                          className="link"
                        >
                          Compare
                        </Link>
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {authorPairs.length ? (
            <section className="mt-6">
              <div className="block__head">
                <h2>Author affinities</h2>
              </div>
              <ul className="pairs" role="list">
                {authorPairs.slice(0, 8).map((p) => (
                  <li key={`${p.a}-${p.b}`} className="pair">
                    <div className="pair__doc">
                      <Link href={`/library?author=${encodeURIComponent(p.a)}`}>{p.a}</Link>
                    </div>
                    <span className="pair__link" aria-hidden="true" />
                    <div className="pair__doc">
                      <Link href={`/library?author=${encodeURIComponent(p.b)}`}>{p.b}</Link>
                    </div>
                    <Link
                      href={`/archivist?q=${encodeURIComponent(`Where do ${p.a} and ${p.b} agree and disagree about ${p.shared.slice(0, 2).join(" and ")}?`)}`}
                      className="btn btn--sm btn--brass"
                    >
                      Trace it
                    </Link>
                    <p className="pair__shared">
                      Shared ground: <b>{p.shared.join(", ")}</b>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
