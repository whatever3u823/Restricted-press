import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessStamp, Byline, Confidence, DraftFlag, RightsStamp, SectionTitle } from "@/components/records";
import { SaveRecord } from "@/components/save-record";
import { db } from "@/db";
import { savedWorks } from "@/db/schema";
import { fileNo, getDossier, lifeDates, yearLabel } from "@/lib/archive";
import { formatPrice } from "@/lib/config";
import { getViewer } from "@/lib/viewer";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const d = await getDossier((await params).slug);
  if (!d) return { title: "Record not found" };
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
  const { work, item, edition, source, rights, sections, related, physical, authorDetails } = d;

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

        <div className="row mt-4" style={{ gap: 10 }}>
          <span className="file-no" style={{ fontSize: 14, color: "var(--ink)" }}>
            {fileNo(work.accession)}
          </span>
          <span className="label">· Archive record</span>
          <RightsStamp rights={item.rights} />
          <AccessStamp item={item} />
        </div>
        <h1 className="title-xl mt-2" style={{ maxWidth: "22ch" }}>
          {work.title}
        </h1>
        {work.subtitle ? (
          <p className="lede mt-2" style={{ fontStyle: "italic", maxWidth: "52ch" }}>
            {work.subtitle}
          </p>
        ) : null}
        <p className="mt-3" style={{ fontSize: 17 }}>
          <Byline authors={item.authors} />
        </p>

        <dl className="cover-sheet mt-4">
          <div>
            <dt className="label">Date</dt>
            <dd>
              {yearLabel(work.originalYear, work.originalYearBasis)}
              {work.originalYear && work.originalYearBasis === "curatorial" ? <span className="meta"> · unverified</span> : null}
            </dd>
          </div>
          <div>
            <dt className="label">Shelf</dt>
            <dd>{item.category ? <Link href={`/subjects/${item.category.slug}`}>{item.category.name}</Link> : "—"}</dd>
          </div>
          <div>
            <dt className="label">Status</dt>
            <dd>
              {item.rights.label} <Confidence level={item.rights.confidence} />
            </dd>
          </div>
          <div>
            <dt className="label">Text</dt>
            <dd>
              {withheld
                ? "Withheld pending review"
                : `${work.wordCount.toLocaleString()} words · ${sections.filter((s) => s.matter === "body").length} sections`}
            </dd>
          </div>
        </dl>
        {!withheld ? (
          <div className="dossier-mobile-actions">
            <Link href={innerLocked ? "/membership" : (readHref ?? "#text")} className={`btn${innerLocked ? " btn--accent" : ""}`}>
              {innerLocked ? "Unlock the text" : "Read the text →"}
            </Link>
            <Link href={`/archivist?scope=${slug}`} className="btn btn--ghost">
              Ask the Archivist
            </Link>
          </div>
        ) : null}
      </header>

      <div className="dossier">
        <div>
          <section className="dossier__section" id="about">
            <div className="dossier__section-head">
              <span className="file-no">{num()}</span>
              <h2>About the Work</h2>
            </div>
            <div className="dossier__section-body">
              <div className="prose">
                <p>{work.summary}</p>
              </div>
              {item.subjects.length ? (
                <div className="tags mt-3">
                  {item.subjects.map((s) => (
                    <Link key={s.slug} href={`/subjects/${s.slug}`} className="tag">
                      {s.name}
                    </Link>
                  ))}
                </div>
              ) : null}
              {draft ? (
                <p className="mt-3">
                  <DraftFlag />
                </p>
              ) : null}
            </div>
          </section>

          {work.historicalContext ? (
            <section className="dossier__section" id="context">
              <div className="dossier__section-head">
                <span className="file-no">{num()}</span>
                <h2>Historical Context</h2>
              </div>
              <div className="dossier__section-body prose">
                <p>{work.historicalContext}</p>
              </div>
            </section>
          ) : null}

          <section className="dossier__section" id="text">
            <div className="dossier__section-head">
              <span className="file-no">{num()}</span>
              <h2>Read the Text</h2>
            </div>
            <div className="dossier__section-body">
              {withheld ? (
                <div className="notice">
                  <strong>Text withheld pending rights review.</strong> This record remains in the catalogue so that it
                  can be found and its provenance inspected. The full text will be released if the review clears it.
                </div>
              ) : (
                <>
                  {innerLocked ? (
                    <div className="notice" style={{ marginBottom: 16 }}>
                      <strong>An Inner Archive text.</strong> The dossier is open to all; the full text is available to
                      Inner Archive members. <Link href="/membership">Unlock the deeper archive →</Link>
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

          <section className="dossier__section" id="bibliography">
            <div className="dossier__section-head">
              <span className="file-no">{num()}</span>
              <h2>Bibliographic Record</h2>
            </div>
            <div className="dossier__section-body">
              <dl className="biblio">
                <dt>Accession</dt>
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

          <section className="dossier__section" id="provenance">
            <div className="dossier__section-head">
              <span className="file-no">{num()}</span>
              <h2>Source &amp; Provenance</h2>
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

              <h3 className="label label--ink mt-6" id="rights">
                Rights record — assessed by component
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
                          <span className={`stamp${r.status === "needs_review" || r.status === "restricted" ? " stamp--accent" : ""}`}>
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

          {work.archivistNotes ? (
            <section className="dossier__section" id="notes">
              <div className="dossier__section-head">
                <span className="file-no">{num()}</span>
                <h2>Archivist’s Notes</h2>
              </div>
              <div className="dossier__section-body">
                <div className="prose">
                  <p>{work.archivistNotes}</p>
                </div>
                {work.archivistQuestions.length && !withheld ? (
                  <>
                    <h3 className="label label--ink mt-4">Lines of enquiry</h3>
                    <ul className="related-list mt-1">
                      {work.archivistQuestions.map((q) => (
                        <li key={q}>
                          <Link href={`/archivist?q=${encodeURIComponent(q)}&scope=${slug}`}>
                            <span className="related-list__title">{q}</span>
                            <span className="related-list__note">Ask the Archivist, within this record →</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="dossier__rail" aria-label="Record actions">
          <div className="rail-block">
            <h3>Actions</h3>
            <div className="stack" style={{ ["--stack" as string]: "10px" }}>
              {withheld ? (
                <span className="btn" aria-disabled="true" style={{ width: "100%" }}>
                  Text withheld
                </span>
              ) : innerLocked ? (
                <Link href="/membership" className="btn btn--accent" style={{ width: "100%" }}>
                  Unlock in the Inner Archive
                </Link>
              ) : readHref ? (
                <Link href={readHref} className="btn" style={{ width: "100%" }}>
                  Read the text <span className="arrow">→</span>
                </Link>
              ) : null}
              {!withheld ? (
                <Link href={`/archivist?scope=${slug}`} className="btn btn--ghost" style={{ width: "100%" }}>
                  Ask the Archivist about this record
                </Link>
              ) : null}
              <SaveRecord workId={work.id} initiallySaved={saved} />
            </div>
          </div>

          {related.length ? (
            <div className="rail-block">
              <h3>Related records</h3>
              <ul className="related-list">
                {related.map(({ item: r, reason, curated }) => (
                  <li key={r.id}>
                    <Link href={`/archive/${r.slug}`}>
                      <span className="file-no" style={{ fontSize: 10.5 }}>
                        {fileNo(r.accession)}
                      </span>
                      <div className="related-list__title">{r.title}</div>
                      <div className="related-list__note">
                        {curated ? "◆ " : ""}
                        {reason}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {item.authors.length ? (
            <div className="rail-block">
              <h3>Follow the trail</h3>
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

          {physical ? (
            <div className="rail-block">
              <h3>Restricted Edition</h3>
              <p style={{ fontFamily: "var(--serif)", fontSize: "1.12rem", lineHeight: 1.25 }}>{physical.name}</p>
              {physical.description ? <p className="meta mt-1">{physical.description}</p> : null}
              <div className="spread mt-2">
                <span className="stamp stamp--brass">{physical.status === "available" ? "Available" : "In preparation"}</span>
                {physical.priceCents ? (
                  <span style={{ fontFamily: "var(--serif)", fontSize: "1.2rem" }}>
                    {formatPrice(physical.priceCents, physical.currency)}
                    {physical.status !== "available" ? <span className="meta"> indicative</span> : null}
                  </span>
                ) : null}
              </div>
              <Link href="/editions" className="link-arrow mt-2" style={{ display: "inline-block" }}>
                View edition →
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
