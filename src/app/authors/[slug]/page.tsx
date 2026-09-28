import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogRow } from "@/components/period";
import { DraftFlag } from "@/components/records";
import { getAuthor, lifeDates } from "@/lib/archive";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const a = await getAuthor((await params).slug);
  return { title: a?.author.name ?? "Author" };
}

const ROLE: Record<string, string> = { author: "Author", editor: "Editor", translator: "Translator", introducer: "Introduction" };

export default async function AuthorPage({ params }: { params: Params }) {
  const data = await getAuthor((await params).slug);
  if (!data) notFound();
  const { author, works, neighbours } = data;
  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/archive">The Archive</Link> <span>/</span> <Link href="/authors">Authors</Link> <span>/</span>
          <span>{author.sortName}</span>
        </nav>
        <span className="file-no mt-4" style={{ display: "block" }}>
          Name authority · Person
        </span>
        <h1 className="title-xl mt-1">{author.name}</h1>
        {lifeDates(author.birthYear, author.deathYear) ? <p className="lede mt-1">{lifeDates(author.birthYear, author.deathYear)}</p> : null}
        {author.note ? (
          <div className="mt-3" style={{ maxWidth: "62ch" }}>
            <p className="prose">{author.note}</p>
            {author.noteStatus !== "reviewed" ? (
              <p className="mt-2">
                <DraftFlag />
              </p>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="dossier">
        <section>
          <div className="section-head">
            <h2>Files held</h2>
            <span className="label">{works.length} file{works.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="records">
            {works.map((w) => (
              <CatalogRow key={w.id} item={w} note={w.role !== "author" ? `${ROLE[w.role] ?? w.role} — ${w.summary ?? ""}` : undefined} />
            ))}
          </ul>
        </section>
        <aside className="dossier__rail">
          {neighbours.length ? (
            <div className="rail-block">
              <h3>Writing on the same subjects</h3>
              <ul className="related-list">
                {neighbours.map((n) => (
                  <li key={n.slug}>
                    <Link href={`/authors/${n.slug}`}>
                      <span className="related-list__title">{n.name}</span>
                      <span className="related-list__note">
                        {n.overlap} shared subject{n.overlap === 1 ? "" : "s"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rail-block">
            <h3>Ask</h3>
            <Link href={`/archivist?q=${encodeURIComponent(`What are ${author.name}'s central ideas in the archive?`)}`} className="btn btn--ghost" style={{ width: "100%" }}>
              Ask the Archivist about {author.name.split(" ").slice(-1)[0]}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
