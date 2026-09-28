import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { IndexHead } from "@/components/period";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { getFacets } from "@/lib/archive";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const [facets, all] = await Promise.all([getFacets(), db.select().from(subjects).orderBy(asc(subjects.name))]);
  const catCount = new Map(facets.categories.map((c) => [c.slug, c.n]));
  const subCount = new Map(facets.subjects.map((c) => [c.slug, c.n]));
  const categories = all.filter((s) => s.kind === "category" && catCount.get(s.slug));
  const headings = all.filter((s) => s.kind === "subject" && subCount.get(s.slug));

  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/archive">The Archive</Link> <span>/</span> <span>Collections</span>
        </nav>
        <h1 className="title-xl mt-3">Collections</h1>
        <p className="lede mt-3" style={{ maxWidth: "46ch" }}>
          The archive is shelved by intellectual discipline. Each file sits in one collection and carries any number of
          subject headings.
        </p>
      </header>

      <IndexHead no="A" title="Collections by discipline" />
      <ul className="collection-index">
        {categories.map((c, i) => (
          <li key={c.slug}>
            <Link href={`/subjects/${c.slug}`}>
              <span className="collection-index__no">Collection {String(i + 1).padStart(2, "0")}</span>
              <span className="collection-index__name">
                {c.name}
                {c.description ? <span className="collection-index__desc">{c.description}</span> : null}
              </span>
              <span className="collection-index__n">
                {catCount.get(c.slug)} {catCount.get(c.slug) === 1 ? "file" : "files"}
              </span>
              <span className="collection-index__arrow">→</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <IndexHead no="B" title="Subject headings" />
        <div className="tags">
          {headings.map((h) => (
            <Link key={h.slug} href={`/subjects/${h.slug}`} className="tag">
              {h.name} <span className="muted">· {subCount.get(h.slug)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
