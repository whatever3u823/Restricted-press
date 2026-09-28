import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogRow } from "@/components/period";
import { db } from "@/db";
import { passages, savedPassages, savedWorks, sections, works } from "@/db/schema";
import { fileNo, listWorks, passageRef } from "@/lib/archive";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Your library" };

export default async function LibraryPage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/sign-in?next=/library");

  if (!viewer.can("library.save")) {
    return (
      <div className="wrap narrow">
        <header className="page-head">
          <span className="file-no">Inner Archive · Private register</span>
          <h1 className="title-xl mt-2">A private archive within the archive.</h1>
          <p className="lede mt-3">
            Inner Archive members keep a personal library of files, save passages with research notes, and return to
            them from anywhere.
          </p>
          <div className="mt-4">
            <Link href="/membership" className="btn btn--accent">
              Unlock the deeper archive
            </Link>
          </div>
        </header>
      </div>
    );
  }

  const savedW = await db
    .select({ workId: savedWorks.workId })
    .from(savedWorks)
    .where(eq(savedWorks.userId, viewer.user.id))
    .orderBy(desc(savedWorks.createdAt));
  const all = savedW.length ? await listWorks() : [];
  const records = savedW.map((s) => all.find((w) => w.id === s.workId)).filter((w): w is NonNullable<typeof w> => Boolean(w));

  const savedP = await db
    .select({
      id: passages.id,
      text: passages.text,
      note: savedPassages.note,
      savedAt: savedPassages.createdAt,
      title: works.title,
      accession: works.accession,
      slug: works.slug,
      section: sections.title,
    })
    .from(savedPassages)
    .innerJoin(passages, eq(passages.id, savedPassages.passageId))
    .innerJoin(works, eq(works.id, passages.workId))
    .innerJoin(sections, eq(sections.id, passages.sectionId))
    .where(eq(savedPassages.userId, viewer.user.id))
    .orderBy(desc(savedPassages.createdAt));

  return (
    <div className="wrap">
      <header className="page-head">
        <span className="file-no">Inner Archive · Private register</span>
        <h1 className="title-xl mt-2">Research library</h1>
      </header>

      <section>
        <div className="section-head">
          <h2>Saved files</h2>
          <span className="label">{records.length}</span>
        </div>
        {records.length ? (
          <ul className="records">
            {records.map((w) => (
              <CatalogRow key={w.id} item={w} />
            ))}
          </ul>
        ) : (
          <p className="empty">No saved files yet. Use “Add to your library” on any file.</p>
        )}
      </section>

      <section className="mt-8">
        <div className="section-head">
          <h2>Saved passages</h2>
          <span className="label">{savedP.length}</span>
        </div>
        {savedP.length ? (
          <div className="stack mt-2" style={{ ["--stack" as string]: "8px" }}>
            {savedP.map((p) => (
              <article key={p.id} className="excerpt">
                <p className="excerpt__text">{p.text.length > 600 ? p.text.slice(0, 600).replace(/_/g, "") + " …" : p.text.replace(/_/g, "")}</p>
                {p.note ? <p className="notice mt-2">{p.note}</p> : null}
                <p className="excerpt__source">
                  <span className="file-no">{fileNo(p.accession)}</span>
                  <Link href={`/archive/${p.slug}`}>
                    <em>{p.title}</em>
                  </Link>
                  <span>{p.section.replace(/_/g, "")}</span>
                  <Link href={`/p/${p.id}`} className="label" style={{ textDecoration: "none" }}>
                    {passageRef(p.id)} →
                  </Link>
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">No saved passages yet. In the reader, hover a paragraph and choose the bookmark.</p>
        )}
      </section>
    </div>
  );
}
