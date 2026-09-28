import { and, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PassageTools } from "@/components/passage-tools";
import { ReaderSize } from "@/components/reader-size";
import { Emph, SectionTitle } from "@/components/records";
import { db } from "@/db";
import { savedPassages } from "@/db/schema";
import { fileNo, getDossier, getSectionText, searchWithinWork } from "@/lib/archive";
import { markedSnippet } from "@/lib/html";
import { getViewer } from "@/lib/viewer";

type Params = Promise<{ slug: string; section: string }>;
type SP = Promise<{ find?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, section } = await params;
  const d = await getDossier(slug);
  const sec = d?.sections.find((s) => s.ordinal === Number(section));
  return { title: d && sec ? `${sec.title.replace(/_/g, "")} · ${d.work.title}` : "Reader" };
}

export default async function ReaderPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { slug, section } = await params;
  const { find } = await searchParams;
  const d = await getDossier(slug);
  if (!d) notFound();
  if (d.work.publicationStatus !== "published") redirect(`/archive/${slug}#text`);
  const viewer = await getViewer();
  if (d.work.accessLevel === "inner" && !viewer.can("text.inner")) redirect("/membership?from=" + slug);

  const ordinal = Number(section);
  const text = Number.isInteger(ordinal) ? await getSectionText(d.work.id, ordinal) : null;
  if (!text) notFound();

  const idx = d.sections.findIndex((s) => s.ordinal === ordinal);
  const prev = d.sections[idx - 1];
  const next = d.sections[idx + 1];
  const matches = find?.trim() ? await searchWithinWork(d.work.id, find.trim()) : null;

  const saved = new Set(
    viewer.user && viewer.can("passages.save") && text.passages.length
      ? (
          await db
            .select({ id: savedPassages.passageId })
            .from(savedPassages)
            .where(and(eq(savedPassages.userId, viewer.user.id), inArray(savedPassages.passageId, text.passages.map((p) => p.id))))
        ).map((r) => r.id)
      : [],
  );

  let firstParagraphSeen = false;

  return (
    <>
      <div className="reader-toolbar">
        <div className="wrap reader-toolbar__inner">
          <Link href={`/archive/${slug}`} className="file-no" style={{ textDecoration: "none" }}>
            ← {fileNo(d.work.accession)}
          </Link>
          <span className="reader-toolbar__title">{d.work.title}</span>
          <div className="reader-toolbar__tools">
            <form action={`/archive/${slug}/read/${ordinal}`} role="search" className="row" style={{ gap: 6 }}>
              <label htmlFor="find" className="visually-hidden">
                Search within this text
              </label>
              <input
                id="find"
                name="find"
                className="input"
                defaultValue={find ?? ""}
                placeholder="Search this text"
                style={{ minHeight: 34, width: "min(200px, 36vw)", padding: "4px 10px", fontSize: 14 }}
              />
            </form>
            <ReaderSize />
          </div>
        </div>
      </div>

      <div className="wrap reader-shell">
        <nav className="reader-nav" aria-label="Contents">
          <span className="label label--ink">Contents · {fileNo(d.work.accession)}</span>
          <ol>
            {d.sections.map((s) => (
              <li key={s.id} className={s.level === 2 ? "level-2" : undefined}>
                <Link href={`/archive/${slug}/read/${s.ordinal}`} aria-current={s.ordinal === ordinal ? "page" : undefined}>
                  <SectionTitle title={s.title} />
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="reader-main">
          <details className="reader-mobile-nav">
            <summary className="label label--ink" style={{ cursor: "pointer" }}>
              Contents · {idx + 1} of {d.sections.length}
            </summary>
            <ol className="contents mt-2">
              {d.sections.map((s) => (
                <li key={s.id} className={s.level === 2 ? "level-2" : undefined}>
                  <Link href={`/archive/${slug}/read/${s.ordinal}`}>
                    <span>
                      <SectionTitle title={s.title} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </details>

          {matches ? (
            <section className="notice" style={{ maxWidth: "var(--measure)", margin: "0 auto 40px" }} aria-label="Search results">
              <div className="spread">
                <strong>
                  {matches.length === 60 ? "60+" : matches.length} passage{matches.length === 1 ? "" : "s"} match “{find}”
                </strong>
                <Link href={`/archive/${slug}/read/${ordinal}`}>Clear</Link>
              </div>
              <ol className="source-list mt-1" style={{ maxHeight: 340, overflow: "auto" }}>
                {matches.map((m) => (
                  <li key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--rule)" }}>
                    <Link href={`/archive/${slug}/read/${m.section}?find=${encodeURIComponent(find ?? "")}#p-${m.id}`} style={{ textDecoration: "none" }}>
                      <span className="label">
                        <SectionTitle title={m.section_title} /> · ¶ {m.id}
                      </span>
                      <span style={{ display: "block", fontFamily: "var(--serif)", fontSize: "1.02rem" }} dangerouslySetInnerHTML={{ __html: markedSnippet(m.snippet) }} />
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <div className="reader-paper">
          <div className="reader-paper__head" aria-label="Running head">
            <span>
              <b>{fileNo(d.work.accession)}</b> · {d.work.title}
            </span>
            <span>
              § {String(ordinal).padStart(2, "0")} of {String(d.sections.length).padStart(2, "0")}
              {d.edition?.year ? ` · Printed ${d.edition.year}` : ""}
            </span>
          </div>
          <article className="reader" lang="en">
            <header className="reader__heading">
              <span className="label">
                § {String(ordinal).padStart(2, "0")}
              </span>
              <h1>
                <SectionTitle title={text.section.title} />
              </h1>
            </header>

            {text.passages.map((p) => {
              const first = p.kind === "paragraph" && !firstParagraphSeen;
              if (p.kind === "paragraph") firstParagraphSeen = true;
              return (
                <p key={p.id} id={`p-${p.id}`} className={`passage passage--${p.kind}${first ? " passage--first" : ""}`}>
                  <a href={`#p-${p.id}`} className="passage__id" aria-label={`Passage ${p.id}`}>
                    {p.id}
                  </a>
                  <Emph text={p.text} />
                  {p.kind !== "rule" && p.kind !== "illustration" ? <PassageTools passageId={p.id} slug={slug} saved={saved.has(p.id)} /> : null}
                </p>
              );
            })}
            {text.passages.length === 0 ? <p className="empty">This division has no text of its own; continue to the next section.</p> : null}
          </article>

          <nav className="reader-pager" aria-label="Sections">
            {prev ? (
              <Link href={`/archive/${slug}/read/${prev.ordinal}`}>
                <span className="label">← Previous</span>
                <span className="reader-pager__title">
                  <SectionTitle title={prev.title} />
                </span>
              </Link>
            ) : (
              <Link href={`/archive/${slug}`}>
                <span className="label">← Dossier</span>
                <span className="reader-pager__title">{d.work.title}</span>
              </Link>
            )}
            {next ? (
              <Link href={`/archive/${slug}/read/${next.ordinal}`} className="next">
                <span className="label">Next →</span>
                <span className="reader-pager__title">
                  <SectionTitle title={next.title} />
                </span>
              </Link>
            ) : (
              <Link href={`/archive/${slug}#related`} className="next">
                <span className="label">End of file →</span>
                <span className="reader-pager__title">Related files</span>
              </Link>
            )}
          </nav>
          </div>

          <div className="source-bar" aria-label="Source">
            <span>
              Source: {d.edition?.label ?? "Archive copy"}
              {d.source ? ` · ${d.source.provider} #${d.source.identifier}` : ""}
            </span>
            <span>Transcribed as printed · spelling preserved</span>
            <Link href={`/archive/${slug}#provenance`}>Source record →</Link>
          </div>
        </div>
      </div>
    </>
  );
}
