import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogRow } from "@/components/period";
import { getSubject } from "@/lib/archive";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s = await getSubject((await params).slug);
  return { title: s?.subject.name ?? "Subject" };
}

export default async function SubjectPage({ params }: { params: Params }) {
  const data = await getSubject((await params).slug);
  if (!data) notFound();
  const { subject, works, neighbours } = data;
  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/collections">Collections</Link> <span>/</span> <span>{subject.name}</span>
        </nav>
        <span className="file-no mt-4" style={{ display: "block" }}>
          {subject.kind === "category" ? "Collection" : "Subject heading"} · Index
        </span>
        <h1 className="title-xl mt-1">{subject.name}</h1>
        {subject.description ? <p className="lede mt-2" style={{ maxWidth: "54ch" }}>{subject.description}</p> : null}
        {neighbours.length ? (
          <div className="mt-4">
            <span className="label">Cross-references</span>
            <div className="tags mt-1">
              {neighbours.map((n) => (
                <Link key={n.slug} href={`/subjects/${n.slug}`} className="tag">
                  {n.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </header>
      <div className="section-head">
        <h2>Files</h2>
        <span className="label">{works.length}</span>
      </div>
      <ul className="records">
        {works.map((w) => (
          <CatalogRow key={w.id} item={w} />
        ))}
      </ul>
      <div className="notice mt-4">
        Researching {subject.name.toLowerCase()}?{" "}
        <Link href={`/archivist?q=${encodeURIComponent(`What does the archive say about ${subject.name.toLowerCase()}?`)}`}>
          Put it to the Archivist →
        </Link>
      </div>
    </div>
  );
}
