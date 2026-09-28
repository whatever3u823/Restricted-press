import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/period";
import { Confidence, DraftFlag, SectionTitle } from "@/components/records";
import { SaveRecord } from "@/components/save-record";
import { db } from "@/db";
import { savedWorks } from "@/db/schema";
import { accessLabel, fileNo, getDossier, lifeDates, yearLabel } from "@/lib/archive";
import { getViewer } from "@/lib/viewer";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const d = await getDossier((await params).slug);
  if (!d) return { title: "File not found" };
  return { title: `${fileNo(d.work.accession)} · ${d.work.title}`, description: d.work.summary ?? undefined };
}

const COMPONENT_LABEL: Record<string, string> = {
  text: "Underlying text",
  translation: "Translation",
  introduction: "Introduction",
  illustrations: "Illustrations",
  annotations: "Editorial matter",
  edition: "Transcription / edition",
};
const STATUS_LABEL: Record<string, string> = {
  public_domain_us: "Public domain (US)",
  public_domain_worldwide: "Public domain (worldwide)",
  needs_review: "Needs review",
  restricted: "Restricted",
  licensed: "Licensed",
};
const BASIS_LABEL: Record<string, string> = {
  title_page: "from title page",
  curatorial: "curatorial identification — unverified",
  unknown: "not established",
};

export default async function DossierPage({ params }: { params: Params }) {
  const { slug } = await params;
  const d = await getDossier(slug);
  if (!d) notFound();
  const viewer = await getViewer();
  const { work, item, edition, source, rights, sections, related, authorDetails } = d;

  const withheld = work.publicationStatus !== "published";
  const innerLocked = work.accessLevel === "inner" && !viewer.can("text.inner");
  const firstBody = sections.find((s) => s.matter === "body") ?? sections[0];
  const readHref = firstBody ? `/archive/${slug}/read/${firstBody.ordinal}` : null;
  const saved = viewer.user
    ? (await db.select().from(savedWorks).where(and(eq(savedWorks.userId, viewer.user.id), eq(savedWorks.workId, work.id))).limit(1)).length > 0
    : false;
  const draft = work.contentStatus !== "reviewed";

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <div className="wrap">
      <header className="page-head" style={{ paddingBottom: 0 }}>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/archive">The Archive</Link> <span>/</span>
          {item.category ? (
            <>
              <Link href={`/subjects/${item.category.slug}`}>{item.category.name}</Link> <span>/</span>
            </>
          ) : null}
          <span>{fileNo(work.accession)}</span>
        </nav>

        <div className="file-head mt-6">
          <div className="file-head__cover fade-in">
            <BookCover item={item} />
          </div>
          <div className="reveal">
            <div className="file-head__kicker">
              <span className="file-no" style={{ fontSize: 13 }}>
                {fileNo(work.accession)}
              </span>
              <span className="label">Archive file</span>
              {draft ? <DraftFlag>Curatorial draft</DraftFlag> : null}
            </div>
            <h1 className="file-head__title">{work.title}</h1>
            {work.subtitle ? <p className="file-head__sub">{work.subtitle}</p> : null}
            <p className="file-head__by">
              {item.authors.map((a, i) => (
                <span key={a.slug}>
                  {i > 0 ? (a.role === "author" ? " & " : " · ") : null}
                  {a.role === "translator" ? "trans. " : a.role === "introducer" ? "intro. " : ""}
                  <Link href={`/authors/${a.slug}`}>{a.name}</Link>
                  {a.role === "editor" ? " (ed.)" : null}
                </span>
              ))}
              <span className="muted">{yearLabel(work.originalYear, work.originalYearBasis)}</span>
            </p>

            <dl className="file-head__meta">
              <div>
                <dt>Status</dt>
                <dd className={item.rights.tone === "clear" ? undefined : "red"}>
                  {item.rights.label} <Confidence level={item.rights.confidence} />
                </dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{source ? `${source.provider}${source.identifier ? ` #${source.identifier}` : ""}` : "Not recorded"}</dd>
              </div>
              <div>
                <dt>Printed</dt>
                <dd>{edition ? [edition.place, edition.year].filter(Boolean).join(", ") || "Not recorded" : "Not recorded"}</dd>
              </div>
              <div>
                <dt>Year</dt>
                <dd>
                  {work.originalYear ?? "n.d."}
                  {work.originalYear && work.originalYearBasis === "curatorial" ? " · unverified" : ""}
                </dd>
              </div>
              <div>
                <dt>Collection</dt>
                <dd>{item.category ? <Link href={`/subjects/${item.category.slug}`}>{item.category.name}</Link> : "—"}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd className={withheld || work.accessLevel === "inner" ? "red" : undefined}>
                  {accessLabel(work)}
                  {!withheld ? ` · ${work.wordCount.toLocaleString()} words` : ""}
                </dd>
              </div>
            </dl>

            <p className="prose file-head__desc" style={{ maxWidth: "60ch" }}>
              {work.summary}
            </p>

            <div className="file-head__actions">
              {withheld ? (
                <span className="btn" aria-disabled="true">
                  Text withheld
                </span>
              ) : innerLocked ? (
                <Link href="/membership" className="btn btn--accent">
                  Request Inner Archive access
                </Link>
              ) : readHref ? (
                <Link href={readHref} className="btn">
                  Read the text
                </Link>
              ) : null}
              {!withheld ? (
                <Link href={`/archivist?scope=${slug}`} className="btn btn--ghost">
                  Consult the Archivist
                </Link>
              ) : null}
            </div>
            <div className="mt-3" style={{ maxWidth: 320 }}>
              <SaveRecord workId={work.id} initiallySaved={saved} />
            </div>
          </div>
        </div>
      </header>

      <div className="dossier">
        <div>
          {work.archivistNotes || work.archivistQuestions.length ? (
            <section className="dossier__section" id="notes">
              <div className="dossier__section-head">
                <span className="file-no">{num()}</span>
                <h2>Archival notes</h2>
              </div>
              <div className="dossier__section-body">
                {work.archivistNotes ? <p className="archival-note">{work.archivistNotes}</p> : null}
                {work.archivistQuestions.length && !withheld ? (
                  <>
                    <h3 className="label mt-4">Lines of enquiry</h3>
                    <ul className="related-list mt-1">
                      {work.archivistQuestions.map((q) => (
                        <li key={q}>
                          <Link href={`/archivist?q=${encodeURIComponent(q)}&scope=${slug}`}>
                            <span className="related-list__title">{q}</span>
                            <span className="related-list__note">Query the Archivist within this file →</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {item.subjects.length ? (
                  <div className="tags mt-4">
                    {item.subjects.map((s) => (
                      <Link key={s.slug} href={`/subjects/${s.slug}`} className="tag">
                        {s.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="dossier__section" id="history">
            <div className="dossier__section-head">
              <span className="file-no">{num()}</span>
              <h2>Publication history</h2>
            </div>
            <div className="dossier__section-body">
              {work.historicalContext ? (
                <div className="prose" style={{ marginBottom: 28 }}>
                  <p>{work.historicalContext}</p>
                </div>
              ) : null}
              <dl className="biblio">
                <dt>File</dt>
                <dd>{fileNo(work.accession)}</dd>
                <dt>Title</dt>
                <dd>
                  {work.title}
                  {work.subtitle ? <span className="muted">: {work.subtitle}</span> : null}
                </dd>
                {authorDetails.map((a) => {
                  const role = item.authors.find((x) => x.slug === a.slug)?.role ?? "author";
                  return (
                    <div key={a.id} style={{ display: "contents" }}>
                      <dt>{role === "introducer" ? "Introduction" : role}</dt>
                      <dd>
                        <Link href={`/authors/${a.slug}`}>{a.name}</Link>
                        {lifeDates(a.birthYear, a.deathYear) ? <span className="muted"> ({lifeDates(a.birthYear, a.deathYear)})</span> : null}
                      </dd>
                    </div>
                  );
                })}
                <dt>First published</dt>
                <dd>
                  {work.originalYear ?? "Not established"}{" "}
                  <span className="meta">— {BASIS_LABEL[work.originalYearBasis] ?? work.originalYearBasis}</span>
                </dd>
                {work.originalLanguage ? (
                  <>
                    <dt>Language</dt>
                    <dd>{work.originalLanguage}</dd>
                  </>
                ) : null}
                {edition ? (
                  <>
                    <dt>Archive edition</dt>
                    <dd>{edition.label}</dd>
                    {edition.publisher ? (
                      <>
                        <dt>Publisher</dt>
                        <dd>
                          {edition.publisher}
                          {edition.place ? `, ${edition.place}` : ""}
                        </dd>
                      </>
                    ) : null}
                    <dt>Edition date</dt>
                    <dd>
                      {edition.year ?? "Undated"} <span className="meta">— {BASIS_LABEL[edition.yearBasis] ?? edition.yearBasis}</span>
                    </dd>
                    {edition.editionStatement ? (
                      <>
                        <dt>Edition statement</dt>
                        <dd>{edition.editionStatement}</dd>
                      </>
                    ) : null}
                    {edition.imprint ? (
                      <>
                        <dt>Imprint (as printed)</dt>
                        <dd style={{ fontStyle: "italic" }}>{edition.imprint}</dd>
                      </>
                    ) : null}
                    {edition.notes ? (
                      <>
                        <dt>Edition notes</dt>
                        <dd>{edition.notes}</dd>
                      </>
                    ) : null}
                  </>
                ) : null}
              </dl>
            </div>
          </section>

          <section className="dossier__section" id="text">
            <div className="dossier__section-head">
              <span className="file-no">{num()}</span>
              <h2>The text</h2>
            </div>
            <div className="dossier__section-body">
              {withheld ? (
                <>
                  <div className="redacted-doc" aria-hidden="true">
                    {[92, 100, 76, 98, 64, 100, 88, 40].map((w, i) => (
                      <span key={i} style={{ width: `${w}%` }} />
                    ))}
                  </div>
                  <p className="notice mt-3">
                    <strong>Text withheld pending rights review.</strong> The file remains in the catalogue so that it can
                    be found and its provenance inspected. The text will be released if the review clears it.
                  </p>
                </>
              ) : (
                <>
                  {innerLocked ? (
                    <div className="notice" style={{ marginBottom: 16 }}>
                      <strong>Inner Archive text.</strong> This file is open to all; its text is available at the Inner
                      Archive level of access. <Link href="/membership">Access levels →</Link>
                    </div>
                  ) : null}
                  <ol className="contents">
                    {sections.map((s) => (
                      <li key={s.id} className={s.level === 2 ? "level-2" : undefined}>
                        <Link href={innerLocked ? "/membership" : `/archive/${slug}/read/${s.ordinal}`}>
                          <span>
                            <SectionTitle title={s.title} />
                          </span>
                          <span className="count">{s.wordCount ? `${s.wordCount.toLocaleString()} w` : ""}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </section>

          <section className="dossier__section" id="provenance">
            <div className="dossier__section-head">
              <span className="file-no">{num()}</span>
              <h2>Source record</h2>
            </div>
            <div className="dossier__section-body">
              {source ? (
                <dl className="biblio">
                  <dt>Digital source</dt>
                  <dd>
                    {source.provider} {source.identifier ? `#${source.identifier}` : ""}
                    {source.url ? (
                      <>
                        {" "}
                        · <a href={source.url} rel="noopener noreferrer" target="_blank">source record ↗</a>
                      </>
                    ) : null}
                  </dd>
                  {source.retrievedAt ? (
                    <>
                      <dt>Retrieved</dt>
                      <dd>
                        {source.retrievedAt.toISOString().slice(0, 10)}
                        {source.checksum ? <span className="meta"> · sha256 {source.checksum.slice(0, 12)}…</span> : null}
                      </dd>
                    </>
                  ) : null}
                  {source.transcriptionNotes ? (
                    <>
                      <dt>Transcription</dt>
                      <dd style={{ whiteSpace: "pre-line", fontSize: "0.98rem" }}>{source.transcriptionNotes}</dd>
                    </>
                  ) : null}
                  {source.providerSubjects.length ? (
                    <>
                      <dt>Subject headings</dt>
                      <dd style={{ fontSize: "0.98rem" }}>{source.providerSubjects.join("; ")}</dd>
                    </>
                  ) : null}
                  <dt>Archive treatment</dt>
                  <dd style={{ fontSize: "0.98rem" }}>
                    Provider licence and notices removed. Spelling, punctuation and capitalisation preserved as
                    transcribed; transcribers’ ligature codes restored to the original characters.
                  </dd>
                </dl>
              ) : (
                <p className="meta">No source recorded.</p>
              )}

              <h3 className="label mt-6" id="rights">
                Rights — assessed by component
              </h3>
              <div className="table-scroll mt-2">
                <table className="rights-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Status</th>
                      <th>Confidence</th>
                      <th>Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rights.map((r) => (
                      <tr key={r.id}>
                        <td>{COMPONENT_LABEL[r.component] ?? r.component}</td>
                        <td>
                          <span className={`stamp${r.status === "needs_review" || r.status === "restricted" ? " stamp--red" : ""}`}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                          <div className="meta mt-1">{r.jurisdiction}</div>
                        </td>
                        <td>
                          <Confidence level={r.confidence} /> <span className="meta">{r.confidence}</span>
                        </td>
                        <td>
                          {r.basis}
                          {r.notes ? <div className="meta mt-1">{r.notes}</div> : null}
                          <div className="meta mt-1">{r.reviewedBy ? `Reviewed by ${r.reviewedBy}` : "Not yet reviewed by counsel"}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="meta mt-2">Preliminary rights research for curatorial purposes; not legal advice.</p>
            </div>
          </section>
        </div>

        <aside className="dossier__rail" aria-label="Related files">
          {related.length ? (
            <div className="rail-block" id="related">
              <h3>Related files</h3>
              <ul className="related-list">
                {related.map(({ item: r, reason, curated }) => (
                  <li key={r.id}>
                    <Link href={`/archive/${r.slug}`}>
                      <span className="file-no" style={{ fontSize: 10.5 }}>
                        {fileNo(r.accession)}
                      </span>
                      <span className="related-list__title">{r.title}</span>
                      <span className="related-list__note">
                        {curated ? "◆ " : ""}
                        {reason}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {item.authors.length ? (
            <div className="rail-block">
              <h3>Cross-references</h3>
              <div className="tags">
                {item.authors.map((a) => (
                  <Link key={a.slug} href={`/authors/${a.slug}`} className="tag">
                    {a.name}
                  </Link>
                ))}
                {item.subjects.slice(0, 4).map((s) => (
                  <Link key={s.slug} href={`/subjects/${s.slug}`} className="tag">
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
