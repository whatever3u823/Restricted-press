import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PassageTools } from "@/components/passage-tools";
import { ReaderChrome } from "@/components/reader-chrome";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getDocument, getSectionText, highlightedIn } from "@/lib/library";
import { getViewer, requireReader } from "@/lib/viewer";

type Params = Promise<{ id: string; section: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await params;
  const viewer = await getViewer();
  const d = viewer.user ? await getDocument(viewer.user.id, Number(p.id)) : null;
  const s = d?.sections.find((x) => x.ordinal === Number(p.section));
  return { title: d ? `${s ? `${s.title} — ` : ""}${d.doc.title}` : "Reader" };
}

export default async function ReadPage({ params }: { params: Params }) {
  const p = await params;
  const viewer = await requireReader(`/d/${p.id}/read/${p.section}`);
  const id = Number(p.id);
  const ordinal = Number(p.section);
  const data = await getDocument(viewer.user.id, id);
  if (!data || data.doc.status !== "ready" || !Number.isInteger(ordinal)) notFound();
  const text = await getSectionText(id, ordinal);
  if (!text) notFound();
  const { doc, sections } = data;
  const marks = await highlightedIn(viewer.user.id, text.passages.map((x) => x.id));

  // Keep the reader's place.
  await db
    .update(documents)
    .set({ lastSection: ordinal, lastReadAt: new Date(), ...(doc.readingStatus === "unread" ? { readingStatus: "reading" as const } : {}) })
    .where(and(eq(documents.id, id), eq(documents.ownerId, viewer.user.id)));

  const index = sections.findIndex((s) => s.ordinal === ordinal);
  const prev = sections[index - 1];
  const next = sections[index + 1];
  let lastPage: number | null = null;

  return (
    <ReaderChrome
      documentId={id}
      title={doc.title}
      section={{ ordinal, title: text.section.title, index: index + 1, total: sections.length }}
      sections={sections.map((s) => ({ ordinal: s.ordinal, title: s.title, level: s.level }))}
      prev={prev ? `/d/${id}/read/${prev.ordinal}` : null}
      next={next ? `/d/${id}/read/${next.ordinal}` : null}
    >
      <article className="reader__body" aria-labelledby="section-title">
        <p className="reader__kicker">
          {doc.title.length > 70 ? `${doc.title.slice(0, 67)}…` : doc.title} · § {ordinal}
        </p>
        <h1 className="reader__title" id="section-title">
          {text.section.title}
        </h1>
        <div className="reader__rule" />
        <div className="text">
          {text.passages.map((psg) => {
            const pageMark = psg.page && psg.page !== lastPage ? psg.page : null;
            if (psg.page) lastPage = psg.page;
            return (
              <div key={psg.id} id={`p-${psg.id}`} className="psg" data-kind={psg.kind} data-marked={marks.has(psg.id) ? "true" : undefined}>
                {pageMark ? <span className="page-mark">p. {pageMark}</span> : null}
                {psg.text}
                {psg.kind !== "heading" ? (
                  <PassageTools documentId={id} passageId={psg.id} marked={marks.has(psg.id)} note={marks.get(psg.id) ?? null} />
                ) : null}
              </div>
            );
          })}
          {!text.passages.length ? <p className="psg" style={{ color: "var(--r-fg-3)" }}>This section heads the subsections that follow.</p> : null}
        </div>
      </article>
      <nav className="reader__pager" aria-label="Sections">
        {prev ? (
          <a href={`/d/${id}/read/${prev.ordinal}`}>
            <span className="k">← Previous</span>
            <span className="t" style={{ display: "block" }}>
              {prev.title}
            </span>
          </a>
        ) : null}
        {next ? (
          <a href={`/d/${id}/read/${next.ordinal}`} className="next">
            <span className="k">Next →</span>
            <span className="t" style={{ display: "block" }}>
              {next.title}
            </span>
          </a>
        ) : (
          <a href={`/d/${id}`} className="next">
            <span className="k">End of document</span>
            <span className="t" style={{ display: "block" }}>
              Return to its page
            </span>
          </a>
        )}
      </nav>
    </ReaderChrome>
  );
}
