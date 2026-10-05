import { and, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ArchivistConsole } from "@/components/archivist-console";
import { relative } from "@/components/doc-bits";
import { db } from "@/db";
import { documents, passages } from "@/db/schema";
import { archivistConfigured } from "@/lib/archivist";
import { getQuota } from "@/lib/archivist/quota";
import type { ArchivistResult } from "@/lib/archivist/types";
import { PASSAGE_ID } from "@/lib/ingest";
import { getQuery, libraryConnections, listDocuments, recentQueries } from "@/lib/library";
import { requireReader } from "@/lib/viewer";

export const metadata: Metadata = { title: "The Archivist" };

type SP = Promise<{ q?: string; doc?: string; passage?: string; h?: string }>;

const shorten = (t: string, n = 48) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export default async function ArchivistPage({ searchParams }: { searchParams: SP }) {
  const viewer = await requireReader("/archivist");
  const sp = await searchParams;
  const ownerId = viewer.user.id;

  const docIds = (sp.doc ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 12);
  const [scope, quota, history, library] = await Promise.all([
    docIds.length
      ? db
          .select({ id: documents.id, title: documents.title })
          .from(documents)
          .where(and(eq(documents.ownerId, ownerId), inArray(documents.id, docIds)))
      : Promise.resolve([]),
    getQuota(ownerId, viewer.plan),
    recentQueries(ownerId, 14),
    listDocuments(ownerId, { sort: "read" }),
  ]);

  let passage: { id: string; title: string; page: number | null } | null = null;
  if (sp.passage && PASSAGE_ID.test(sp.passage)) {
    const [p] = await db
      .select({ id: passages.id, page: passages.page, title: documents.title })
      .from(passages)
      .innerJoin(documents, eq(documents.id, passages.documentId))
      .where(and(eq(passages.id, sp.passage), eq(passages.ownerId, ownerId)))
      .limit(1);
    passage = p ?? null;
  }

  const stored = sp.h ? await getQuery(ownerId, Number(sp.h)) : null;
  const initialResult = stored ? ({ ...(stored.response as ArchivistResult), id: stored.id } as ArchivistResult) : null;

  // Lines of enquiry drawn from the reader's own library.
  const suggestions: string[] = [];
  if (scope.length === 1) {
    const t = scope[0].title;
    suggestions.push(
      `What is the central argument of “${shorten(t)}”, and how is it built?`,
      `What are the key claims in “${shorten(t)}”, and what evidence supports each?`,
      `Which ideas in “${shorten(t)}” are taken up elsewhere in my library?`,
    );
  } else if (scope.length > 1) {
    suggestions.push(
      `Where do ${scope.map((s) => `“${shorten(s.title, 36)}”`).join(" and ")} agree, and where do they part ways?`,
      `What does each of these documents contribute that the others do not?`,
    );
  } else if (library.length) {
    const { pairs } = library.length > 1 ? await libraryConnections(ownerId) : { pairs: [] };
    const top = pairs[0];
    if (top) {
      const name = (d: { author: string | null; title: string }) => d.author?.split(";")[0].trim() || `“${shorten(d.title, 36)}”`;
      suggestions.push(`Where do ${name(top.a)} and ${name(top.b)} agree and disagree about ${top.shared[0]}?`);
    }
    const terms = library.flatMap((d) => d.keyTerms.slice(0, 3).map((t) => t.term));
    const common = [...new Set(terms)].slice(0, 2);
    if (common[0]) suggestions.push(`What does my library say about ${common[0]}?`);
    suggestions.push(`Summarise the central argument of “${shorten(library[0].title)}”.`);
    if (common[1]) suggestions.push(`Which documents discuss ${common[1]}, and how do their treatments differ?`);
  }

  return (
    <div className="page page--wide">
      <header className="page-head">
        <div className="page-head__text">
          <span className="eyebrow eyebrow--rule eyebrow--brass">The Archivist</span>
          <h1 className="h1">What would you know?</h1>
          <p className="page-head__sub">
            The Archivist reads your library passage by passage and answers only from what it finds — every statement
            tied to the sentence that supports it.
          </p>
        </div>
      </header>

      {library.length ? (
        <div className="console">
          <div>
            <ArchivistConsole
              initialQuestion={sp.q ?? (passage ? "What is this passage saying, and where else does my library take up its subject?" : "")}
              autoRun={Boolean((sp.q || passage) && !initialResult)}
              initialResult={initialResult}
              scope={scope}
              passage={passage}
              suggestions={suggestions}
              quota={quota}
              canDeep={viewer.can("archivist.deep")}
              generative={archivistConfigured()}
              libraryCount={library.length}
            />
          </div>
          <aside>
            <div className="block__head">
              <h2>Recent inquiries</h2>
            </div>
            {history.length ? (
              <ul className="history" role="list">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link href={`/archivist?h=${h.id}`}>
                      <span className="clamp-2">{h.question}</span>
                      <span className="when">
                        {relative(h.createdAt)}
                        {h.mode === "deep" ? " · deep research" : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Your questions are kept here, with their answers and sources, for you to return to.</p>
            )}
          </aside>
        </div>
      ) : (
        <div className="empty">
          <p className="h2">The Archivist has nothing to read yet.</p>
          <p className="mt-2">Add documents to your library, and it will answer from them.</p>
          <Link href="/library/add" className="btn btn--primary mt-4">
            Add documents
          </Link>
        </div>
      )}
    </div>
  );
}
