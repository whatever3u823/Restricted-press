import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { physicalEditions, works } from "@/db/schema";
import { fileNo, listWorks } from "@/lib/archive";
import { BookCover } from "@/components/period";
import { formatPrice } from "@/lib/config";

export const metadata: Metadata = { title: "Restricted Editions" };

export default async function EditionsPage() {
  const editions = await db
    .select({ e: physicalEditions, w: works })
    .from(physicalEditions)
    .innerJoin(works, eq(works.id, physicalEditions.workId))
    .orderBy(asc(works.accession));
  const all = await listWorks();

  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Restricted Press</Link> <span>/</span> <span>Restricted Editions</span>
        </nav>
        <div className="split mt-4" style={{ alignItems: "end" }}>
          <div>
            <span className="label">Restricted Editions</span>
            <h1 className="title-xl mt-1">The archive, made physical.</h1>
          </div>
          <p className="lede">
            The digital archive is where texts are discovered. A Restricted Edition is for keeping: newly typeset from
            the archive text, original spelling intact, sewn and bound — the object, the restoration, and the
            completeness of the text.
          </p>
        </div>
      </header>

      <section className="mt-4">
        <div className="section-head">
          <h2>In preparation</h2>
          <span className="label">{editions.length}</span>
        </div>
        {editions.map(({ e, w }) => (
          <article key={e.id} className="split" style={{ padding: "40px 0", borderBottom: "1px solid var(--rule)" }}>
            <div style={{ maxWidth: 300, width: "100%", justifySelf: "center" }}>
              <BookCover item={all.find((x) => x.id === w.id) ?? { accession: w.accession, title: w.title, category: null, authors: [] }} size="lg" />
            </div>
            <div>
              <span className="file-no">{fileNo(w.accession)}</span>
              <h3 className="title-l mt-1">{e.name}</h3>
              {e.description ? <p className="lede mt-2">{e.description}</p> : null}
              <div className="row mt-3" style={{ gap: 16 }}>
                <span className="stamp stamp--brass">{e.status === "available" ? "Available" : "In preparation"}</span>
                {e.priceCents ? (
                  <span style={{ fontFamily: "var(--serif)", fontSize: "1.5rem" }}>
                    {formatPrice(e.priceCents, e.currency)} <span className="meta">{e.status === "available" ? "" : "indicative"}</span>
                  </span>
                ) : null}
              </div>
              <div className="row mt-3">
                <Link href={`/archive/${w.slug}`} className="btn btn--ghost">
                  Read the dossier
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="band" style={{ borderBottom: 0 }}>
        <div className="split" style={{ alignItems: "start" }}>
          <div>
            <span className="label">The Archive Seal</span>
            <h2 className="title-l mt-1">Every book opens back into the archive.</h2>
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
                  Each edition will carry an Archive Seal — an accession code that opens an enhanced dossier: source
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
