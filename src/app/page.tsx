import Link from "next/link";
import { RecordCard } from "@/components/records";
import { Seal } from "@/components/seal";
import { fileNo, getFacets, getFeatured, getStats } from "@/lib/archive";
import { archivistConfigured } from "@/lib/archivist";
import { formatPrice, MEMBERSHIP } from "@/lib/config";
import { markedSnippet } from "@/lib/html";
import { retriever } from "@/lib/search/retriever";
import { toConcepts } from "@/lib/search/vocabulary";

export const dynamic = "force-dynamic";

const SAMPLE_QUESTION = "What did accused witches confess about the Devil's mark?";

export default async function Home() {
  const [stats, featured, facets, sample] = await Promise.all([
    getStats(),
    getFeatured(6),
    getFacets(),
    retriever.retrieve({ concepts: toConcepts(SAMPLE_QUESTION, true), limit: 3, perWorkCap: 1 }),
  ]);
  const llm = archivistConfigured();

  return (
    <>
      <section className="hero">
        <div className="wrap hero__grid">
          <div>
            <div className="hero__kicker">
              <span className="stamp stamp--accent stamp--large">The Archive</span>
              <span className="label">Restricted Press</span>
            </div>
            <h1 className="display">
              Forgotten knowledge.
              <br />
              <em style={{ fontStyle: "italic" }}>Restored access.</em>
            </h1>
            <p className="lede hero__lede">
              A curated archive of texts most people have forgotten exist — witch-trial confessions, alchemical
              allegory, Hermetic doctrine, the private diary of an Elizabethan magus — read in full, catalogued with
              care, and open to questioning by an Archivist that cites its sources.
            </p>
            <div className="hero__actions">
              <Link href="/archive" className="btn">
                Enter the Archive <span className="arrow">→</span>
              </Link>
              <Link href="/archivist" className="btn btn--ghost">
                Consult the Archivist
              </Link>
            </div>
          </div>
          <aside className="hero__panel" aria-label="Archive register">
            <div className="spread" style={{ position: "relative", paddingBottom: 8 }}>
              <span className="label label--ink">Archive register</span>
              <Seal className="wordmark__seal" />
            </div>
            <div className="hero__panel-row">
              <span className="label">Records</span>
              <span className="v">{stats.records}</span>
            </div>
            <div className="hero__panel-row">
              <span className="label">Full texts</span>
              <span className="v">{stats.texts}</span>
            </div>
            <div className="hero__panel-row">
              <span className="label">Passages indexed</span>
              <span className="v">{stats.passages.toLocaleString()}</span>
            </div>
            <div className="hero__panel-row">
              <span className="label">Words of source text</span>
              <span className="v">{stats.words.toLocaleString()}</span>
            </div>
            <div className="hero__panel-row">
              <span className="label">Earliest record</span>
              <span className="v">{stats.earliest}</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="section-head">
            <h2>From the stacks</h2>
            <Link href="/archive" className="link-arrow">
              All records →
            </Link>
          </div>
          <div className="card-grid" style={{ borderTop: 0 }}>
            {featured.map((w) => (
              <RecordCard key={w.id} item={w} />
            ))}
          </div>
          <div className="tags mt-4" aria-label="Shelves">
            {facets.categories.map((c) => (
              <Link key={c.slug} href={`/subjects/${c.slug}`} className="tag">
                {c.name} <span className="muted">· {c.n}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="band band--dark">
        <div className="wrap">
          <div className="band__head">
            <div>
              <span className="label">The Archivist</span>
              <h2 className="title-xl mt-2">A research librarian that has read every page.</h2>
            </div>
            <div className="stack" style={{ ["--stack" as string]: "14px" }}>
              <p className="lede">
                Ask a question in plain language. The Archivist searches the archive passage by passage, answers only
                from what it finds, and shows you the sentences behind every claim.
              </p>
              <p className="meta">
                Quotations are drawn directly from the archive and checked before they are shown. Where the texts are
                silent, it says so. Anything it adds from outside the archive is marked as such.
              </p>
            </div>
          </div>

          <div className="demo-exchange">
            <p className="label">Sample enquiry</p>
            <p className="exchange__q mt-1">“{SAMPLE_QUESTION}”</p>
            <p className="label" style={{ marginBottom: 6 }}>
              Passages the Archivist retrieves — live from the archive
            </p>
            <ol className="source-list">
              {sample.map((h, i) => (
                <li key={h.id} className="source-item">
                  <span className="source-item__n">[{i + 1}]</span>
                  <div>
                    <div className="source-item__file">
                      <span className="file-no">{fileNo(h.accession)}</span>
                      <Link href={`/p/${h.id}`} className="source-item__title">
                        {h.title}
                      </Link>
                      <span className="meta">{h.author}</span>
                    </div>
                    <p className="source-item__quote" dangerouslySetInnerHTML={{ __html: markedSnippet(h.snippet) }} />
                  </div>
                </li>
              ))}
            </ol>
            <div className="row mt-3">
              <Link href={`/archivist?q=${encodeURIComponent(SAMPLE_QUESTION)}`} className="btn btn--accent">
                Ask this question <span className="arrow">→</span>
              </Link>
              {!llm ? <span className="meta">The Archivist is currently running in retrieval-only mode.</span> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap split" style={{ alignItems: "start" }}>
          <div>
            <span className="label">Method</span>
            <h2 className="title-l mt-2">An institution, not a bookstore.</h2>
            <p className="lede mt-3">
              Every text enters the archive as a record: catalogued, sourced, its rights examined component by
              component, its text divided into addressable passages.
            </p>
          </div>
          <ol className="numbered">
            <li>
              <div>
                <strong>Every record is a dossier.</strong>
                <p className="meta mt-1">Bibliographic record, historical context, source and provenance, related records, and the full text.</p>
              </div>
            </li>
            <li>
              <div>
                <strong>Every passage has an address.</strong>
                <p className="meta mt-1">Passages carry permanent identifiers — FILE 0017 § 3 ¶ 12 — so citations lead to the exact words.</p>
              </div>
            </li>
            <li>
              <div>
                <strong>Every right is recorded, not assumed.</strong>
                <p className="meta mt-1">Text, translation, introduction and edition are assessed separately. Uncertain records are held for review.</p>
              </div>
            </li>
            <li>
              <div>
                <strong>The original is preserved.</strong>
                <p className="meta mt-1">Historical spelling and punctuation are kept as printed. Nothing is silently modernised.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="band__head">
            <div>
              <span className="label">Membership</span>
              <h2 className="title-xl mt-2">The Inner Archive.</h2>
            </div>
            <p className="lede">
              The archive is open to all. The Inner Archive is for those who intend to work in it — unlimited research
              with the Archivist, cross-text enquiry, and a private library of records and passages.
            </p>
          </div>
          <div className="tiers">
            <div className="tier">
              <span className="label">The Archive</span>
              <p className="tier__price">Free</p>
              <ul>
                <li>Browse and search every record</li>
                <li>Read the open collection in full</li>
                <li>Dossiers, provenance and related records</li>
                <li>A few Archivist questions each day</li>
              </ul>
              <div>
                <Link href="/archive" className="btn btn--ghost">
                  Enter the Archive
                </Link>
              </div>
            </div>
            <div className="tier tier--inner">
              <span className="label label--accent">Inner Archive</span>
              <p className="tier__price">
                {formatPrice(MEMBERSHIP.monthlyPriceCents)}
                <span className="meta" style={{ fontFamily: "var(--sans)" }}> / month</span>
              </p>
              <ul>
                <li>Unlimited Archivist research</li>
                <li>Deep research across texts, with comparison</li>
                <li>Conceptual search with historical vocabulary</li>
                <li>Personal library, saved passages and notes</li>
                <li>Inner Archive texts</li>
              </ul>
              <div>
                <Link href="/membership" className="btn btn--accent">
                  Unlock the deeper archive
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="band" style={{ borderBottom: 0 }}>
        <div className="wrap split">
          <div className="edition-object" aria-hidden="true">
            <span className="edition-object__foot">Restricted Edition</span>
            <span className="edition-object__title">
              A Treatise
              <br />
              of Witchcraft
            </span>
            <span className="edition-object__foot">{fileNo(1)} · 1616</span>
          </div>
          <div>
            <span className="label">Restricted Editions</span>
            <h2 className="title-l mt-2">The archive, made physical.</h2>
            <p className="lede mt-3">
              Selected records will be issued as Restricted Editions: newly typeset from the archive text, original
              spelling intact, sewn and bound to last. Each will carry an Archive Seal connecting the book to its
              dossier.
            </p>
            <div className="mt-4">
              <Link href="/editions" className="link-arrow">
                Editions in preparation →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
