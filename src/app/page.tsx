import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { BookCover, FileCard, IndexHead } from "@/components/period";
import { RequestForm } from "@/components/request-form";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { getFacets, getFeatured, getStats, passageRef } from "@/lib/archive";
import { archivistConfigured } from "@/lib/archivist";
import { markedSnippet } from "@/lib/html";
import { retriever } from "@/lib/search/retriever";
import { toConcepts } from "@/lib/search/vocabulary";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const SAMPLE_QUESTION = "What did accused witches confess about the Devil's mark?";

export default async function Home() {
  const [stats, featured, facets, sample, viewer, categories] = await Promise.all([
    getStats(),
    getFeatured(8),
    getFacets(),
    retriever.retrieve({ concepts: toConcepts(SAMPLE_QUESTION, true), limit: 4, perWorkCap: 1 }),
    getViewer(),
    db.select().from(subjects).where(eq(subjects.kind, "category")).orderBy(asc(subjects.name)),
  ]);
  const llm = archivistConfigured();
  const counts = new Map(facets.categories.map((c) => [c.slug, c.n]));
  const collections = categories.filter((c) => counts.get(c.slug));
  const stack = featured.slice(0, 3);

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="wrap hero__grid">
          <div>
            <div className="hero__kicker reveal">
              <span className="file-no">Archive 01</span>
              <span className="label">Restricted Press — The Archive</span>
            </div>
            <h1 className="display reveal" style={{ ["--i" as string]: 1 }}>
              Restricted Books.
              <br />
              Available Again<span style={{ color: "var(--red)" }}>.</span>
            </h1>
            <p className="lede hero__lede reveal" style={{ ["--i" as string]: 2 }}>
              Forgotten texts on magic, witchcraft, alchemy and the hidden traditions — recovered from the printed
              record, catalogued as files, and open to research.
            </p>
            <div className="hero__actions reveal" style={{ ["--i" as string]: 3 }}>
              <Link href="/archive" className="btn">
                Enter the archive
              </Link>
              <Link href="/archivist" className="btn btn--ghost">
                Consult the Archivist
              </Link>
            </div>
          </div>
          <div className="hero__stack fade-in" aria-hidden="true">
            {stack.map((w) => (
              <BookCover key={w.id} item={w} />
            ))}
          </div>
        </div>
      </section>

      <section className="wrap" aria-label="Accession register">
        <div className="register">
          <div>
            <span className="label">Files held</span>
            <span className="register__v">{String(stats.records).padStart(4, "0")}</span>
          </div>
          <div>
            <span className="label">Full texts</span>
            <span className="register__v">{String(stats.texts).padStart(4, "0")}</span>
          </div>
          <div>
            <span className="label">Passages indexed</span>
            <span className="register__v">{stats.passages.toLocaleString()}</span>
          </div>
          <div>
            <span className="label">Words preserved</span>
            <span className="register__v">{stats.words.toLocaleString()}</span>
          </div>
          <div>
            <span className="label">Earliest file</span>
            <span className="register__v">{stats.earliest}</span>
          </div>
        </div>
      </section>

      {/* ── 01 The Archive ── */}
      <section className="band">
        <div className="wrap">
          <IndexHead no="01" title="The Archive" />
          <div className="split" style={{ alignItems: "start" }}>
            <p className="title-l" style={{ maxWidth: "20ch", fontFamily: "var(--display)" }}>
              An institution for texts that were printed, suppressed, or simply forgotten.
            </p>
            <ol className="numbered">
              <li>
                <div>
                  <strong>Every book is a file.</strong>
                  <p className="meta mt-1">Catalogued with its edition, imprint, provenance and rights — assessed part by part.</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Every passage has an address.</strong>
                  <p className="meta mt-1">Cited as FILE 0017 / §03 / ¶12, so a reference leads to the exact words.</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Nothing is modernised.</strong>
                  <p className="meta mt-1">Spelling and punctuation are preserved as printed.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* ── 02 Featured files ── */}
      <section className="band">
        <div className="wrap">
          <IndexHead
            no="02"
            title="Featured files"
            aside={
              <Link href="/archive" className="link-arrow">
                Full catalogue
              </Link>
            }
          />
          <div className="files">
            {featured.slice(0, 4).map((w, i) => (
              <FileCard key={w.id} item={w} i={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 The collection ── */}
      <section className="band">
        <div className="wrap">
          <IndexHead
            no="03"
            title="The collection"
            aside={
              <Link href="/collections" className="link-arrow">
                All collections
              </Link>
            }
          />
          <ul className="collection-index">
            {collections.map((c, i) => (
              <li key={c.slug}>
                <Link href={`/subjects/${c.slug}`}>
                  <span className="collection-index__no">Collection {String(i + 1).padStart(2, "0")}</span>
                  <span className="collection-index__name">
                    {c.name}
                    {c.description ? <span className="collection-index__desc">{c.description}</span> : null}
                  </span>
                  <span className="collection-index__n">
                    {counts.get(c.slug)} {counts.get(c.slug) === 1 ? "file" : "files"}
                  </span>
                  <span className="collection-index__arrow">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 04 The Archivist ── */}
      <section className="band">
        <div className="wrap">
          <IndexHead no="04" title="The Archivist" />
          <div className="split" style={{ alignItems: "start" }}>
            <div>
              <h2 className="title-xl">The Archivist</h2>
              <p className="label label--red mt-3">A research instrument for the restricted collection</p>
              <p className="lede mt-4" style={{ maxWidth: "36ch" }}>
                It reads the archive passage by passage and answers only from what it finds — citing file, section and
                paragraph for every claim.
              </p>
              <div className="row mt-4">
                <Link href={`/archivist?q=${encodeURIComponent(SAMPLE_QUESTION)}`} className="btn btn--accent">
                  Run this query
                </Link>
                <Link href="/archivist" className="link-arrow">
                  Open the terminal
                </Link>
              </div>
            </div>
            <div className="terminal">
              <dl className="terminal__status">
                <div>
                  <dt>Collection</dt>
                  <dd>Restricted Press</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd className="red">Source-bound</dd>
                </div>
                <div>
                  <dt>Files</dt>
                  <dd>{stats.texts}</dd>
                </div>
                <div>
                  <dt>Output</dt>
                  <dd>{llm ? "Cited answer" : "Sources only"}</dd>
                </div>
              </dl>
              <div style={{ position: "relative", padding: "22px 24px 8px" }}>
                <span className="label">Query</span>
                <p className="mt-1" style={{ fontFamily: "var(--serif)", fontSize: "1.3rem", lineHeight: 1.35 }}>
                  {SAMPLE_QUESTION}
                </p>
              </div>
              <div style={{ position: "relative", padding: "12px 24px 24px" }}>
                <span className="label">Sources retrieved</span>
                <ol className="retrieved mt-1">
                  {sample.map((h, i) => (
                    <li key={h.id}>
                      <span className="n">{String(i + 1).padStart(2, "0")}</span>
                      <Link href={`/p/${h.id}`}>{passageRef(h.id)}</Link>
                      <span className="t">{h.title}</span>
                      <span />
                    </li>
                  ))}
                </ol>
                {sample[0] ? (
                  <p className="source-item__quote mt-2" dangerouslySetInnerHTML={{ __html: markedSnippet(sample[0].snippet) }} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 05 Request a title ── */}
      <section className="band">
        <div className="wrap">
          <IndexHead no="05" title="Request a title" />
          <div className="split" style={{ alignItems: "start" }}>
            <div>
              <h2 className="title-l" style={{ maxWidth: "18ch" }}>
                A text the archive does not yet hold?
              </h2>
              <p className="lede mt-3" style={{ maxWidth: "38ch" }}>
                File a request. Each is entered in the accession register and assessed for provenance and rights
                before a file is opened.
              </p>
            </div>
            <div className="frame">
              <RequestForm kind="title" signedInEmail={viewer.user?.email ?? null} submitLabel="File request" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
