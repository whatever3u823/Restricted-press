import type { Metadata } from "next";
import Link from "next/link";
import { shortDate } from "@/components/doc-bits";
import { RemoveHighlight } from "@/components/highlight-actions";
import { listHighlights, passageRef } from "@/lib/library";
import { requireReader } from "@/lib/viewer";

export const metadata: Metadata = { title: "Highlights" };

export default async function HighlightsPage({ searchParams }: { searchParams: Promise<{ notes?: string }> }) {
  const viewer = await requireReader("/highlights");
  const { notes } = await searchParams;
  const all = await listHighlights(viewer.user.id);
  const marks = notes ? all.filter((m) => m.note) : all;
  const documents = new Set(all.map((m) => m.documentId)).size;

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head__text">
          <span className="eyebrow eyebrow--rule">Highlights</span>
          <h1 className="h1">The passages you kept.</h1>
          <p className="page-head__sub">
            {all.length
              ? `${all.length} highlight${all.length === 1 ? "" : "s"} across ${documents} document${documents === 1 ? "" : "s"}, newest first.`
              : "Mark passages as you read and they gather here, with your notes."}
          </p>
        </div>
        {all.length ? (
          <div className="seg" role="group" aria-label="Show">
            <Link href="/highlights" aria-current={!notes ? "true" : undefined}>
              All
            </Link>
            <Link href="/highlights?notes=1" aria-current={notes ? "true" : undefined}>
              With notes
            </Link>
          </div>
        ) : null}
      </header>

      {marks.length ? (
        <ul className="marks" role="list" style={{ borderTop: "1px solid var(--line-2)" }}>
          {marks.map((m) => (
            <li key={m.id} className="mark-item">
              <div style={{ minWidth: 0 }}>
                <p className="mark-item__text">{m.text}</p>
                {m.note ? <p className="mark-item__note">{m.note}</p> : null}
                <p className="mark-item__src">
                  <Link href={`/d/${m.documentId}`} style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "1rem", color: "var(--fg-2)" }}>
                    {m.title}
                  </Link>
                  {m.author ? <span>{m.author}</span> : null}
                  <span className="ref">
                    {m.sectionTitle} · {passageRef(m.passageId, m.page)}
                  </span>
                  <span>{shortDate(m.createdAt)}</span>
                  <Link href={`/p/${m.passageId}`} className="link">
                    Read in place
                  </Link>
                  <Link href={`/archivist?doc=${m.documentId}&passage=${m.passageId}`} className="link">
                    Ask about it
                  </Link>
                  <RemoveHighlight id={m.id} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <p className="h2">{notes ? "No highlights carry notes yet." : "Nothing marked yet."}</p>
          <p className="mt-2">In the reading room, hover a passage and choose the bookmark to keep it here.</p>
        </div>
      )}
    </div>
  );
}
