import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { BookCover, IndexHead, InkStamp } from "@/components/period";
import { db } from "@/db";
import { physicalEditions } from "@/db/schema";
import { fileNo, listWorks, yearLabel } from "@/lib/archive";
import { formatPrice } from "@/lib/config";

export const metadata: Metadata = { title: "Restricted Editions" };

export default async function EditionsPage() {
  const [editions, all] = await Promise.all([
    db.select().from(physicalEditions).orderBy(asc(physicalEditions.id)),
    listWorks(),
  ]);
  const byId = new Map(all.map((w) => [w.id, w]));
  const issued = editions
    .map((e, i) => ({ e, w: byId.get(e.workId), no: String(i + 1).padStart(3, "0") }))
    .filter((x): x is { e: typeof x.e; w: NonNullable<typeof x.w>; no: string } => Boolean(x.w));

  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Restricted Press</Link> <span>/</span> <span>Restricted Editions</span>
        </nav>
        <div className="page-head__row mt-3" style={{ alignItems: "end" }}>
          <div>
            <span className="file-no">Instrument 04 · Physical editions</span>
            <h1 className="title-xl mt-2">Restricted Editions</h1>
            <p className="lede mt-3" style={{ maxWidth: "44ch" }}>
              The archive is where texts are discovered. A Restricted Edition is for keeping — restored from the
              historical source, newly typeset with the original spelling intact, and printed to order.
            </p>
          </div>
          <p className="class-mark" style={{ whiteSpace: "normal", textAlign: "right" }}>
            {issued.length} {issued.length === 1 ? "edition" : "editions"} registered
          </p>
        </div>
      </header>

      <section>
        <IndexHead no="01" title="Register of editions" />
        {issued.map(({ e, w, no }) => (
          <article key={e.id} className="split" style={{ padding: "40px 0", borderBottom: "1px solid var(--rule)", alignItems: "center" }}>
            <Link href={`/editions/${w.slug}`} className="cover-link" style={{ maxWidth: 280, width: "100%", justifySelf: "center", position: "relative" }}>
              <BookCover item={w} />
            </Link>
            <div>
              <span className="file-no">
                RP / {no} · {fileNo(w.accession)}
              </span>
              <h2 className="title-l mt-2">
                <Link href={`/editions/${w.slug}`} style={{ textDecoration: "none" }}>
                  {e.name.replace(/^Restricted Edition\s*[—–-]\s*/i, "")}
                </Link>
              </h2>
              {e.description ? <p className="lede mt-2">{e.description}</p> : null}
              <dl className="edition-spec mt-4">
                <div>
                  <dt>Status</dt>
                  <dd className="red">{e.status === "available" ? "Available" : e.status === "sold_out" ? "Out of print" : "In preparation"}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>
                    Archive copy · {yearLabel(w.originalYear, w.originalYearBasis)}
                  </dd>
                </div>
                {e.priceCents ? (
                  <div>
                    <dt>Price</dt>
                    <dd>
                      {formatPrice(e.priceCents, e.currency)}
                      {e.status === "available" ? "" : " · indicative"}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="row mt-4">
                <Link href={`/editions/${w.slug}`} className="btn">
                  View the edition
                </Link>
                <Link href={`/archive/${w.slug}`} className="link-arrow">
                  Archive file
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="band" style={{ borderBottom: 0 }}>
        <IndexHead no="02" title="The Archive Seal" />
        <div className="split" style={{ alignItems: "start" }}>
          <div style={{ position: "relative" }}>
            <h2 className="title-l">Every book opens back into the archive.</h2>
            <div className="mt-4">
              <InkStamp tone="ivory" sub="Planned" tilt={-4}>
                Archive seal
              </InkStamp>
            </div>
          </div>
          <ol className="numbered">
            <li>
              <div>
                <strong>Discovery</strong>
                <p className="meta mt-1">A text is found and read in the digital archive.</p>
              </div>
            </li>
            <li>
              <div>
                <strong>Exploration</strong>
                <p className="meta mt-1">The Archivist connects it to the rest of the collection.</p>
              </div>
            </li>
            <li>
              <div>
                <strong>Ownership</strong>
                <p className="meta mt-1">The Restricted Edition preserves it as an object.</p>
              </div>
            </li>
            <li>
              <div>
                <strong>Deepening</strong>
                <p className="meta mt-1">
                  Each edition will carry an Archive Seal — an accession code that opens an enhanced file: source
                  scans, restoration notes and related material. Planned; not yet active.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
