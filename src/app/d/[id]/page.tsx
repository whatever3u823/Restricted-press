import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { shortDate, Spine } from "@/components/doc-bits";
import { CollectionsMenu, DeleteDocument, EditDetails, NotesEditor, StatusSwitch } from "@/components/document-controls";
import { ArchivistIcon } from "@/components/icons";
import { archivistConfigured } from "@/lib/archivist";
import {
  authorNames,
  getDocument,
  KIND_LABEL,
  listCollections,
  listHighlights,
  passageRef,
  readingTime,
  relatedDocuments,
} from "@/lib/library";
import { getViewer, requireReader } from "@/lib/viewer";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const viewer = await getViewer();
  const d = viewer.user ? await getDocument(viewer.user.id, Number((await params).id)) : null;
  return { title: d?.doc.title ?? "Document" };
}

const FORMAT: Record<string, string> = { pdf: "PDF", epub: "EPUB", docx: "Word", txt: "Text", md: "Markdown", html: "HTML" };

export default async function DocumentPage({ params }: { params: Params }) {
  const { id: raw } = await params;
  const viewer = await requireReader(`/d/${raw}`);
  const id = Number(raw);
  const data = await getDocument(viewer.user.id, id);
  if (!data || data.doc.status !== "ready") notFound();
  const { doc, sections, collections } = data;
  const [related, marks, allCollections] = await Promise.all([
    relatedDocuments(viewer.user.id, id),
    listHighlights(viewer.user.id, id),
    listCollections(viewer.user.id),
  ]);
  const names = authorNames(doc.author);
  const resumeAt = doc.lastSection ?? sections[0]?.ordinal ?? 1;
  const started = Boolean(doc.lastSection);
  const cataloguing = !doc.abstract && archivistConfigured() && Date.now() - new Date(doc.updatedAt).getTime() < 3 * 60_000;
  const ask = (q: string, scoped = true) => `/archivist?${scoped ? `doc=${id}&` : ""}q=${encodeURIComponent(q)}`;
  const short = doc.title.length > 60 ? `${doc.title.slice(0, 57)}…` : doc.title;

  return (
    <div className="page page--wide">
      <nav className="crumbs" aria-label="Breadcrumb" style={{ marginBottom: 28 }}>
        <Link href="/library">Library</Link> <span>/</span> <span>{short}</span>
      </nav>

      <header className="doc-hero">
        <Spine title={doc.title} format={doc.format} kind={doc.kind} large />
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">
            {KIND_LABEL[doc.kind]} · {FORMAT[doc.format] ?? doc.format} · {doc.wordCount.toLocaleString("en-US")} words · {readingTime(doc.wordCount)}
          </span>
          <h1 className="doc-hero__title">{doc.title}</h1>
          <p className="doc-hero__by">
            {names.length
              ? names.map((n, i) => (
                  <span key={n}>
                    {i ? " · " : ""}
                    <Link href={`/library?author=${encodeURIComponent(n)}`}>{n}</Link>
                  </span>
                ))
              : <span className="muted">Author unknown</span>}
            {doc.year ? <span className="muted"> — {doc.year}</span> : null}
          </p>
          <div className="doc-hero__actions">
            <Link href={`/d/${id}/read/${resumeAt}`} className="btn btn--primary">
              {started ? `Resume · section ${resumeAt}` : "Begin reading"}
            </Link>
            <Link href={`/archivist?doc=${id}`} className="btn btn--brass">
              <ArchivistIcon className="" />
              Ask the Archivist
            </Link>
            <StatusSwitch id={id} status={doc.readingStatus} />
          </div>
          <div className="row mt-3" style={{ ["--gap" as string]: "6px" }}>
            <CollectionsMenu id={id} all={allCollections.map((c) => ({ id: c.id, name: c.name }))} member={collections.map((c) => c.id)} />
            <EditDetails id={id} initial={{ title: doc.title, author: doc.author, year: doc.year, kind: doc.kind }} />
            <DeleteDocument id={id} title={doc.title} />
          </div>
        </div>
      </header>

      <div className="doc-grid mt-3">
        <div>
          <section className="block">
            <div className="block__head">
              <h2>Catalogue entry</h2>
              {doc.abstract ? <span className="eyebrow eyebrow--brass">By the Archivist</span> : null}
            </div>
            {doc.abstract ? (
              <>
                <p className="lede" style={{ color: "var(--fg)" }}>
                  {doc.abstract}
                </p>
                {doc.subjects.length ? (
                  <div className="chips mt-3">
                    {doc.subjects.map((s) => (
                      <Link key={s} href={`/library?q=${encodeURIComponent(s)}`} className="chip">
                        {s}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </>
            ) : cataloguing ? (
              <p className="muted">The Archivist is reading this document and will write its catalogue entry shortly.</p>
            ) : (
              <p className="muted">
                {archivistConfigured()
                  ? "No catalogue entry was written for this document."
                  : "Catalogue entries are written by the Archivist when its language model is enabled."}{" "}
                {doc.keyTerms.length ? "Its most characteristic words are below." : null}
              </p>
            )}
            {doc.keyTerms.length ? (
              <div className="row mt-3" style={{ ["--gap" as string]: "6px" }}>
                <span className="eyebrow" style={{ marginRight: 6 }}>
                  Key terms
                </span>
                {doc.keyTerms.slice(0, 16).map((t) => (
                  <span key={t.term} className="term">
                    {t.term}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="block">
            <div className="block__head">
              <h2>Contents</h2>
              <span className="small dim">
                {sections.length} section{sections.length === 1 ? "" : "s"}
              </span>
            </div>
            <ol className="toc" role="list">
              {sections.map((s) => (
                <li key={s.id} data-level={s.level} data-current={doc.lastSection === s.ordinal ? "true" : undefined}>
                  <Link href={`/d/${id}/read/${s.ordinal}`}>
                    <span className="n">{String(s.ordinal).padStart(2, "0")}</span>
                    <span className="t">{s.title}</span>
                    <span className="w">{s.wordCount ? readingTime(s.wordCount) : ""}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {marks.length ? (
            <section className="block">
              <div className="block__head">
                <h2>Highlights</h2>
                <Link href="/highlights" className="link small">
                  All highlights
                </Link>
              </div>
              <ul className="marks" role="list">
                {marks.slice(0, 6).map((m) => (
                  <li key={m.id} className="mark-item">
                    <div>
                      <p className="mark-item__text clamp-3">{m.text}</p>
                      {m.note ? <p className="mark-item__note">{m.note}</p> : null}
                      <p className="mark-item__src">
                        <Link href={`/p/${m.passageId}`}>
                          {m.sectionTitle} <span className="ref">{passageRef(m.passageId, m.page)}</span>
                        </Link>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="block">
            <div className="block__head">
              <h2>Your notes</h2>
            </div>
            <NotesEditor id={id} initial={doc.notes} />
          </section>
        </div>

        <aside>
          <section className="block">
            <div className="block__head">
              <h2>Connections</h2>
              {related.length ? (
                <Link href="/connections" className="link small">
                  Map
                </Link>
              ) : null}
            </div>
            {related.length ? (
              <ul className="related" role="list">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/d/${r.id}`} className="related__t">
                      {r.title}
                    </Link>
                    <p className="related__m">
                      {r.author ?? "Author unknown"}
                      {r.year ? ` · ${r.year}` : ""}
                      <span className="score" title="Strength of connection">
                        <span style={{ width: `${Math.min(100, Math.round(r.score * 160))}%` }} />
                      </span>
                    </p>
                    <p className="related__shared">
                      Shared ground: <b>{r.shared.slice(0, 5).join(", ")}</b>
                    </p>
                    <Link
                      href={`/archivist?doc=${id},${r.id}&q=${encodeURIComponent(`How do “${doc.title}” and “${r.title}” relate? Where do they agree and where do they differ?`)}`}
                      className="link small mt-1"
                      style={{ display: "inline-block" }}
                    >
                      Ask how they connect
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">
                As your library grows, Athenaeum will show the documents that share the most ground with this one.
              </p>
            )}
          </section>

          <section className="block">
            <div className="block__head">
              <h2>Lines of enquiry</h2>
            </div>
            <ul className="suggest" role="list">
              {[
                "What is the central argument, and how is it built?",
                "What are the key claims, and what evidence supports each?",
                "Which terms or concepts does this document define, and how?",
              ].map((q) => (
                <li key={q}>
                  <Link href={ask(q)}>{q}</Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="block">
            <div className="block__head">
              <h2>Particulars</h2>
            </div>
            <dl className="kv">
              <dt>File</dt>
              <dd>{doc.filename ?? "—"}</dd>
              <dt>Added</dt>
              <dd>{shortDate(doc.createdAt)}</dd>
              <dt>Last read</dt>
              <dd>{doc.lastReadAt ? shortDate(doc.lastReadAt) : "Not yet"}</dd>
              <dt>Highlights</dt>
              <dd>{data.highlightCount}</dd>
              <dt>Collections</dt>
              <dd>{collections.length ? collections.map((c) => c.name).join(", ") : "—"}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
