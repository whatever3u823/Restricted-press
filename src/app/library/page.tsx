import { inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { relative, Spine, StatusBadge, shortDate } from "@/components/doc-bits";
import { UploadIcon } from "@/components/icons";
import { db } from "@/db";
import { sections } from "@/db/schema";
import { CollectionControls, DiscardUpload, FilterBar } from "@/components/library-controls";
import type { DocumentKind, ReadingStatus } from "@/db/schema";
import { LIBRARY_LIMITS } from "@/lib/config";
import { incompleteUploads, KIND_LABEL, libraryStats, listCollections, listDocuments, readingTime, type LibraryFilters } from "@/lib/library";
import { requireReader } from "@/lib/viewer";

export const metadata: Metadata = { title: "Library" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const viewer = await requireReader("/library");
  const sp = await searchParams;
  const ownerId = viewer.user.id;
  const filters: LibraryFilters = {
    q: one(sp.q)?.slice(0, 100),
    collection: one(sp.c) ? Number(one(sp.c)) : undefined,
    author: one(sp.author)?.slice(0, 100),
    kind: one(sp.kind) as DocumentKind | undefined,
    status: one(sp.status) as ReadingStatus | undefined,
    sort: one(sp.sort) as LibraryFilters["sort"],
  };
  const [docs, stats, cols, incomplete, recent] = await Promise.all([
    listDocuments(ownerId, filters),
    libraryStats(ownerId),
    listCollections(ownerId),
    incompleteUploads(ownerId),
    listDocuments(ownerId, { sort: "read" }),
  ]);
  const collection = filters.collection ? cols.find((c) => c.id === filters.collection) : undefined;
  const filtered = Boolean(filters.q || filters.collection || filters.author || filters.kind || filters.status);
  const resume = recent.filter((d) => d.lastReadAt && d.readingStatus !== "finished").slice(0, 3);
  // Where each open volume was left, and how far through it that is (by words, not sections).
  const resumeSections = resume.length
    ? await db
        .select({ documentId: sections.documentId, ordinal: sections.ordinal, title: sections.title, wordCount: sections.wordCount })
        .from(sections)
        .where(inArray(sections.documentId, resume.map((d) => d.id)))
    : [];
  const place = (d: (typeof resume)[number]) => {
    const secs = resumeSections.filter((x) => x.documentId === d.id);
    const at = d.lastSection ?? 1;
    const before = secs.filter((x) => x.ordinal < at).reduce((n, x) => n + x.wordCount, 0);
    return { title: secs.find((x) => x.ordinal === at)?.title ?? `Section ${at}`, pct: Math.max(1, Math.round((before / Math.max(1, d.wordCount)) * 100)) };
  };
  const first = viewer.user.name.trim().split(/\s+/)[0];
  const limit = LIBRARY_LIMITS[viewer.plan];

  if (!stats.documents && !incomplete.length) {
    return (
      <div className="page">
        <header className="page-head">
          <div className="page-head__text">
            <span className="eyebrow eyebrow--rule">Private library</span>
            <h1 className="h1">Welcome, {first}. Your shelves are waiting.</h1>
            <p className="page-head__sub">
              Add the books, papers and articles you work with. Athenaeum reads them, files them by chapter, and
              hands them to the Archivist.
            </p>
          </div>
        </header>
        <Link href="/library/add" className="dropzone panel ticks" style={{ textDecoration: "none", minHeight: 360 }}>
          <div>
            <UploadIcon className="dropzone__mark" />
            <p className="h2">Add your first documents</p>
            <p className="muted mt-2">PDF, EPUB, Word, text, Markdown or HTML — several at once if you like.</p>
            <span className="btn btn--primary mt-4">Choose files</span>
          </div>
        </Link>
        <ol className="firstrun">
          <li>
            <span className="n">01</span>
            <h3>File your documents</h3>
            <p>Books, papers and articles are divided into chapters and paragraphs and indexed, word by word.</p>
          </li>
          <li>
            <span className="n">02</span>
            <h3>Read and mark</h3>
            <p>The reading room keeps your place. Highlight passages and note what they mean to you.</p>
          </li>
          <li>
            <span className="n">03</span>
            <h3>Consult the Archivist</h3>
            <p>Ask anything of what you own. Every answer is cited to the sentence — and the page.</p>
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <header className="page-head">
        <div className="page-head__text">
          <span className="eyebrow eyebrow--rule">{collection ? "Collection" : "Private library"}</span>
          <h1 className="h1">{collection ? collection.name : `${first}’s library`}</h1>
          {filters.author ? (
            <p className="page-head__sub">
              Documents by {filters.author} · <Link href="/library" className="link">show all</Link>
            </p>
          ) : null}
        </div>
        <div className="row">
          {collection ? <CollectionControls id={collection.id} name={collection.name} /> : null}
          <Link href="/library/add" className="btn btn--primary">
            <UploadIcon className="" />
            Add documents
          </Link>
        </div>
      </header>

      {!collection && !filtered ? (
        <dl className="readout" style={{ ["--cols" as string]: 4 }}>
          <div>
            <dt>Documents</dt>
            <dd>
              {stats.documents}
              {viewer.plan === "member" ? <span className="dim"> / {limit}</span> : null}
            </dd>
          </div>
          <div>
            <dt>Words held</dt>
            <dd>{stats.words.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Passages indexed</dt>
            <dd>{stats.passages.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Highlights</dt>
            <dd>{stats.highlights}</dd>
          </div>
        </dl>
      ) : null}

      {incomplete.length ? (
        <div className="notice mt-3">
          <strong>Unfinished uploads.</strong> {incomplete.length === 1 ? "One document" : `${incomplete.length} documents`} did not finish
          arriving: {incomplete.map((d, i) => (
            <span key={d.id}>
              {i ? ", " : ""}
              <em>{d.title}</em> (<DiscardUpload id={d.id} />)
            </span>
          ))}
          . Add {incomplete.length === 1 ? "it" : "them"} again to complete.
        </div>
      ) : null}

      {resume.length && !collection && !filtered ? (
        <section className="mt-5" aria-label="Resume reading">
          <div className="section-head" style={{ borderBottom: 0 }}>
            <span className="eyebrow">Continue reading</span>
          </div>
          <div className="resume">
            {resume.map((d) => (
              <Link key={d.id} href={`/d/${d.id}/read/${d.lastSection ?? 1}`} className="panel">
                <Spine title={d.title} format={d.format} kind={d.kind} />
                <span style={{ minWidth: 0 }}>
                  <span className="resume__t" style={{ display: "block" }}>
                    {d.title}
                  </span>
                  <span className="resume__where" style={{ display: "block" }}>
                    § {d.lastSection ?? 1} · {place(d).title}
                  </span>
                  <span className="meter" style={{ display: "block" }}>
                    <span style={{ width: `${place(d).pct}%` }} />
                  </span>
                  <span className="resume__foot">
                    <span>{d.lastReadAt ? `Last read ${relative(d.lastReadAt)}` : ""}</span>
                    <span className="num">{place(d).pct}%</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5" aria-label="Documents">
        <FilterBar />
        {docs.length ? (
          <div className="doc-table">
            <div className="doc-head" aria-hidden="true">
              <span>Title</span>
              <span>Kind</span>
              <span>Year</span>
              <span>Length</span>
              <span>Status</span>
            </div>
            {docs.map((d) => (
              <Link key={d.id} href={`/d/${d.id}`} className="doc-row">
                <span className="doc-row__main">
                  <Spine title={d.title} format={d.format} kind={d.kind} />
                  <span style={{ minWidth: 0 }}>
                    <span className="doc-row__title" style={{ display: "block" }}>
                      {d.title}
                    </span>
                    <span className="doc-row__by" style={{ display: "block" }}>
                      {d.author ?? "Author unknown"} <span className="dim">· added {shortDate(d.createdAt)}</span>
                    </span>
                  </span>
                </span>
                <span className="doc-row__cell doc-row__cell--hide">{KIND_LABEL[d.kind]}</span>
                <span className="doc-row__cell num doc-row__cell--hide">{d.year ?? "—"}</span>
                <span className="doc-row__cell num doc-row__cell--hide">{readingTime(d.wordCount)}</span>
                <span className="doc-row__cell">
                  <StatusBadge status={d.readingStatus} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty mt-3">
            <p className="h2">Nothing answers to that.</p>
            <p className="mt-2">
              {collection && !filters.q ? "This collection is empty — add documents to it from their pages." : "Try fewer filters."}{" "}
              <Link href="/library" className="link">
                Show the whole library
              </Link>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
