import type { Metadata } from "next";
import Link from "next/link";
import { lifeDates, listAuthors } from "@/lib/archive";

export const metadata: Metadata = { title: "Authors" };

export default async function AuthorsPage() {
  const authors = await listAuthors();
  return (
    <div className="wrap narrow">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/archive">The Archive</Link> <span>/</span> <span>Authors</span>
        </nav>
        <h1 className="title-xl mt-2">Authors, editors &amp; translators</h1>
      </header>
      <ul className="related-list" style={{ borderTop: "1px solid var(--rule-strong)" }}>
        {authors.map((a) => (
          <li key={a.slug}>
            <Link href={`/authors/${a.slug}`} className="spread" style={{ display: "flex" }}>
              <span className="related-list__title">{a.name}</span>
              <span className="meta">
                {lifeDates(a.birth_year, a.death_year) ?? ""} · {a.n} record{a.n === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
