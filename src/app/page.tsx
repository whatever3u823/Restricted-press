import Link from "next/link";
import { BookCover, ClassMark, InkStamp, Ornament, Plate, Redact } from "@/components/period";
import { Byline } from "@/components/records";
import { Seal } from "@/components/seal";
import { fileNo, getFacets, getFeatured, getStats, yearLabel } from "@/lib/archive";
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
      <section className="hero" style={{ borderBottom: 0 }}>
        <div className="wrap hero__grid" style={{ alignItems: "center" }}>
          <div>
            <div className="hero__kicker">
              <span className="label label--ink">Restricted Press</span>
              <span className="label">— The Archive</span>
            </div>
            <h1 className="display">
              Forgotten knowledge.
              <br />
              <em style={{ fontStyle: "italic" }}>Restored access.</em>
            </h1>
            <p className="lede hero__lede" style={{ maxWidth: "36ch" }}>
              A curated archive of texts most people have forgotten exist — witch-trial confessions, alchemical
              allegory, Hermetic doctrine, the private diary of an <Redact>Elizabethan magus</Redact> — read in full,
              catalogued with care, and open to questioning by an Archivist that cites its sources.
            </p>
            <div className="hero__actions">
              <Link href="/archive" className="btn">
                Enter the Archive <span className="arrow">→</span>
              </Link>
              <Link href="/archivist" className="btn btn--ghost">
                Consult the Archivist
              </Link>
            </div>
            <blockquote className="epigraph mt-6" style={{ margin: "56px 0 0", maxWidth: "34ch" }}>
              “It is neither religious nor wise to judge that of which you know nothing.”
              <cite>
                Philalethes, <em>A Brief Guide to the Celestial Ruby</em> —{" "}
                <Link href="/p/0011.001.0009" style={{ color: "inherit" }}>
                  as quoted in {fileNo(11)}
                </Link>
              </cite>
            </blockquote>
          </div>
          <div className="hero-plate">
            <Plate
              src="/plates/hidden-symbolism-of-alchemy/figure-2.jpg"
              caption="REBIS, “an hermetic hermaphrodite”. From Silberer, Hidden Symbolism of Alchemy."
              n={0}
              href="/archive/hidden-symbolism-of-alchemy"
            />
            <InkStamp sub={fileNo(4)} tilt={-7}>
              Access
              <br />
              restored
            </InkStamp>
          </div>
        </div>
      </section>

      <section className="wrap" aria-label="Archive register">
        <div className="register">
          <div>
            <span className="label">Records</span>
            <span className="register__v">{stats.records}</span>
          </div>
          <div>
            <span className="label">Full texts</span>
            <span className="register__v">{stats.texts}</span>
          </div>
          <div>
            <span className="label">Passages indexed</span>
            <span className="register__v">{stats.passages.toLocaleString()}</span>
          </div>
          <div>
            <span className="label">Words of source text</span>
            <span className="register__v">{stats.words.toLocaleString()}</span>
          </div>
          <div>
            <span className="label">Earliest record</span>
            <span className="register__v">{stats.earliest}</span>
          </div>
        </div>
      </section>

      <section className="band" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <h2>From the stacks</h2>
            <Link href="/archive" className="link-arrow">
              All records →
            </Link>
          </div>
          <div className="shelf mt-4">
            {featured.map((w) => (
              <Link key={w.id} href={`/archive/${w.slug}`} className="shelf__item">
                <BookCover item={w} size="sm" />
                <span className="shelf__meta">
                  <span className="file-no" style={{ fontSize: 11 }}>
                    {fileNo(w.accession)}
                  </span>
                  <span className="shelf__title">{w.title}</span>
                  <span className="meta" style={{ fontSize: 13 }}>
                    <Byline authors={w.authors.filter((a) => a.role === "author" || a.role === "editor")} linked={false} /> ·{" "}
                    {yearLabel(w.originalYear, w.originalYearBasis)}
                  </span>
                  <ClassMark item={w} />
                </span>
              </Link>
            ))}
          </div>
          <div className="tags mt-6" aria-label="Shelves">
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
              <span className="label" style={{ color: "var(--brass)" }}>
                The Archivist
              </span>
              <h2 className="title-xl mt-2">A research librarian that has read every page.</h2>
            </div>
            <div className="stack" style={{ ["--stack" as string]: "18px" }}>
              <p className="lede">
                Ask a question in plain language. The Archivist searches the archive passage by passage, answers only
                from what it finds, and shows you the sentences behind every claim.
              </p>
              <p className="marginalia">
                Quotations are drawn from the archive itself and checked before they are shown. Where the texts are
                silent, it says so.
              </p>
            </div>
          </div>

          <div className="demo-exchange">
            <p className="label">Enquiry on file</p>
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
            <div className="row mt-4">
              <Link href={`/archivist?q=${encodeURIComponent(SAMPLE_QUESTION)}`} className="btn btn--accent">
                Put this question <span className="arrow">→</span>
              </Link>
              {!llm ? <span className="meta">The Archivist is currently running in retrieval-only mode.</span> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap split" style={{ alignItems: "center" }}>
          <Plate
            src="/plates/the-superstitions-of-witchcraft/title-page.jpg"
            caption="Title page, London, 1865, photographed from the copy used for the archive text — library stamp and all."
            photo
            mounted
            href="/archive/the-superstitions-of-witchcraft"
          />
          <div>
            <span className="label">From the reading room</span>
            <h2 className="title-l mt-2">Every text is traced to a physical book.</h2>
            <p className="lede mt-3">
              Behind each record stands a printed edition: its imprint transcribed, its date and how it is known, the
              hands that transcribed it, and the rights in every part of it assessed separately.
            </p>
            <p className="marginalia mt-4">
              The stamp on this title page belongs to the library whose copy was photographed. The archive keeps such
              marks of provenance, and changes nothing in the text.
            </p>
            <div className="mt-4">
              <Link href="/archive/the-superstitions-of-witchcraft" className="link-arrow">
                {fileNo(12)} — open the dossier →
              </Link>
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
            <p className="class-mark mt-4" style={{ display: "block" }}>
              e.g. WIT 1616 .R64 · {fileNo(1)} · ¶ 0001.004.0012
            </p>
          </div>
          <ol className="numbered">
            <li>
              <div>
                <strong>Every record is a dossier.</strong>
                <p className="meta mt-1">Bibliographic record, historical context, source and provenance, plates, related records, and the full text.</p>
              </div>
            </li>
            <li>
              <div>
                <strong>Every passage has an address.</strong>
                <p className="meta mt-1">Permanent identifiers — {fileNo(17)} § 3 ¶ 12 — so citations lead to the exact words.</p>
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
                <li>Dossiers, provenance, plates and related records</li>
                <li>A few Archivist questions each day</li>
              </ul>
              <div>
                <Link href="/archive" className="btn btn--ghost">
                  Enter the Archive
                </Link>
              </div>
            </div>
            <div className="tier tier--inner">
              <span className="label" style={{ color: "var(--brass)" }}>
                Inner Archive
              </span>
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
          <div style={{ maxWidth: 300, justifySelf: "center", width: "100%" }}>
            <BookCover
              item={{
                accession: 1,
                title: "A Treatise of Witchcraft",
                category: { slug: "witchcraft", name: "Witchcraft & Demonology" },
                authors: [{ slug: "alexander-roberts", name: "Alexander Roberts", role: "author" }],
              }}
              size="lg"
            />
          </div>
          <div>
            <span className="label">Restricted Editions</span>
            <h2 className="title-l mt-2">The archive, made physical.</h2>
            <p className="lede mt-3">
              Selected records will be issued as Restricted Editions: newly typeset from the archive text, original
              spelling intact, sewn and bound to last. Each will carry an Archive Seal connecting the book to its
              dossier.
            </p>
            <div className="row mt-4" style={{ gap: 20 }}>
              <Seal lettered className="footer-seal" />
              <Link href="/editions" className="link-arrow">
                Editions in preparation →
              </Link>
            </div>
          </div>
        </div>
      </section>
      <Ornament />
    </>
  );
}
