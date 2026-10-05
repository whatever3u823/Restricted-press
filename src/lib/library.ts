/**
 * Reading the reader's library. Every query here is scoped to one owner:
 * nothing in Athenaeum is visible to anyone but the reader who uploaded it.
 */
import { and, asc, count, desc, eq, gt, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  collectionDocuments,
  collections,
  documents,
  highlights,
  passages,
  researchQueries,
  sections,
  type DocumentKind,
  type ReadingStatus,
} from "@/db/schema";
import { compare, weigh } from "@/lib/terms";

export type DocItem = typeof documents.$inferSelect & { collectionIds: number[] };

export const KIND_LABEL: Record<DocumentKind, string> = {
  book: "Book",
  article: "Article",
  paper: "Paper",
  notes: "Notes",
  other: "Document",
};

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
};

/** "42.003.0012" → "§3 ¶12" */
export function passageRef(id: string, page?: number | null) {
  const [, sec, par] = id.split(".");
  return `§${Number(sec)} ¶${Number(par)}${page ? ` · p. ${page}` : ""}`;
}

/** Individual names from an author field: "Marcus Aurelius; George Long (trans.)". */
export function authorNames(author: string | null): string[] {
  if (!author) return [];
  return author
    .split(/;|\s+&\s+|\s+and\s+/)
    .map((a) => a.replace(/\((ed|eds|trans|translator|editor)\.?\)/gi, "").trim())
    .filter((a) => a.length > 1);
}

export function readingTime(words: number) {
  const minutes = Math.round(words / 250);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = minutes / 60;
  return `${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)} h`;
}

/* ─────────────────────────────── Documents ─────────────────────────────── */

export type LibraryFilters = {
  q?: string;
  collection?: number;
  author?: string;
  kind?: DocumentKind;
  status?: ReadingStatus;
  sort?: "recent" | "title" | "author" | "read" | "year";
};

export async function listDocuments(ownerId: string, f: LibraryFilters = {}): Promise<DocItem[]> {
  const where = [eq(documents.ownerId, ownerId), eq(documents.status, "ready")];
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    where.push(or(ilike(documents.title, like), ilike(documents.author, like), sql`${documents.subjects}::text ilike ${like}`)!);
  }
  if (f.author) where.push(ilike(documents.author, `%${f.author.replace(/[%_]/g, "")}%`));
  if (f.kind) where.push(eq(documents.kind, f.kind));
  if (f.status) where.push(eq(documents.readingStatus, f.status));
  if (f.collection) {
    where.push(
      inArray(
        documents.id,
        db.select({ id: collectionDocuments.documentId }).from(collectionDocuments).where(eq(collectionDocuments.collectionId, f.collection)),
      ),
    );
  }
  const order =
    f.sort === "title"
      ? [asc(sql`lower(${documents.title})`)]
      : f.sort === "author"
        ? [asc(sql`lower(coalesce(${documents.author}, 'zzz'))`), asc(documents.title)]
        : f.sort === "read"
          ? [sql`${documents.lastReadAt} desc nulls last`, desc(documents.createdAt)]
          : f.sort === "year"
            ? [sql`${documents.year} asc nulls last`, asc(documents.title)]
            : [desc(documents.createdAt)];
  const rows = await db.select().from(documents).where(and(...where)).orderBy(...order);
  const links = rows.length
    ? await db.select().from(collectionDocuments).where(inArray(collectionDocuments.documentId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => ({ ...r, collectionIds: links.filter((l) => l.documentId === r.id).map((l) => l.collectionId) }));
}

export const getDocument = cache(async (ownerId: string, id: number) => {
  if (!Number.isInteger(id)) return null;
  const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.ownerId, ownerId))).limit(1);
  if (!doc) return null;
  const [secs, cols, [{ n: marks }]] = await Promise.all([
    db
      .select({ id: sections.id, ordinal: sections.ordinal, title: sections.title, level: sections.level, wordCount: sections.wordCount })
      .from(sections)
      .where(eq(sections.documentId, id))
      .orderBy(asc(sections.ordinal)),
    db
      .select({ id: collections.id, name: collections.name })
      .from(collectionDocuments)
      .innerJoin(collections, eq(collections.id, collectionDocuments.collectionId))
      .where(eq(collectionDocuments.documentId, id)),
    db
      .select({ n: count() })
      .from(highlights)
      .innerJoin(passages, eq(passages.id, highlights.passageId))
      .where(and(eq(highlights.userId, ownerId), eq(passages.documentId, id))),
  ]);
  return { doc, sections: secs, collections: cols, highlightCount: marks };
});

export type DocumentView = NonNullable<Awaited<ReturnType<typeof getDocument>>>;

export async function getSectionText(documentId: number, ordinal: number) {
  const [section] = await db
    .select()
    .from(sections)
    .where(and(eq(sections.documentId, documentId), eq(sections.ordinal, ordinal)))
    .limit(1);
  if (!section) return null;
  const rows = await db.select().from(passages).where(eq(passages.sectionId, section.id)).orderBy(asc(passages.ordinal));
  return { section, passages: rows };
}

/** Where a passage lives, if it belongs to this reader. */
export async function locatePassage(ownerId: string, id: string) {
  const [row] = await db
    .select({ documentId: passages.documentId, ordinal: sections.ordinal })
    .from(passages)
    .innerJoin(sections, eq(sections.id, passages.sectionId))
    .where(and(eq(passages.id, id), eq(passages.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

/** Find words within one document, in reading order. */
export async function searchWithinDocument(ownerId: string, documentId: number, q: string, limit = 80) {
  const rows = await db.execute<{ id: string; ordinal: number; section_ordinal: number; section_title: string; page: number | null; snippet: string }>(sql`
    select p.id, p.ordinal, s.ordinal section_ordinal, s.title section_title, p.page,
      ts_headline('english', p.text, websearch_to_tsquery('english', unaccent_immutable(${q})),
        'StartSel=<mark>,StopSel=</mark>,MaxWords=30,MinWords=12,MaxFragments=1') snippet
    from passages p join sections s on s.id = p.section_id
    where p.document_id = ${documentId} and p.owner_id = ${ownerId}
      and p.search @@ websearch_to_tsquery('english', unaccent_immutable(${q}))
    order by p.ordinal
    limit ${limit}
  `);
  return [...rows];
}

/* ─────────────────────────────── Overview ─────────────────────────────── */

export async function libraryStats(ownerId: string) {
  const [[docs], [marks], [asked]] = await Promise.all([
    db
      .select({
        documents: count(),
        words: sql<number>`coalesce(sum(${documents.wordCount}), 0)::bigint`,
        reading: sql<number>`count(*) filter (where ${documents.readingStatus} = 'reading')::int`,
        finished: sql<number>`count(*) filter (where ${documents.readingStatus} = 'finished')::int`,
      })
      .from(documents)
      .where(and(eq(documents.ownerId, ownerId), eq(documents.status, "ready"))),
    db.select({ n: count() }).from(highlights).where(eq(highlights.userId, ownerId)),
    db.select({ n: count() }).from(researchQueries).where(eq(researchQueries.userId, ownerId)),
  ]);
  const [{ n: passagesIndexed }] = await db.select({ n: count() }).from(passages).where(eq(passages.ownerId, ownerId));
  return {
    documents: docs.documents,
    words: Number(docs.words),
    reading: docs.reading,
    finished: docs.finished,
    highlights: marks.n,
    questions: asked.n,
    passages: passagesIndexed,
  };
}

export async function listCollections(ownerId: string) {
  const rows = await db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      n: sql<number>`(select count(*) from ${collectionDocuments} cd where cd.collection_id = ${collections.id})::int`,
    })
    .from(collections)
    .where(eq(collections.ownerId, ownerId))
    .orderBy(asc(sql`lower(${collections.name})`));
  return rows;
}

export async function recentQueries(ownerId: string, limit = 12) {
  return db
    .select({ id: researchQueries.id, question: researchQueries.question, mode: researchQueries.mode, createdAt: researchQueries.createdAt })
    .from(researchQueries)
    .where(eq(researchQueries.userId, ownerId))
    .orderBy(desc(researchQueries.createdAt))
    .limit(limit);
}

export async function getQuery(ownerId: string, id: number) {
  const [row] = await db
    .select()
    .from(researchQueries)
    .where(and(eq(researchQueries.id, id), eq(researchQueries.userId, ownerId)))
    .limit(1);
  return row ?? null;
}

/* ─────────────────────────────── Highlights ─────────────────────────────── */

export async function listHighlights(ownerId: string, documentId?: number) {
  return db
    .select({
      id: highlights.id,
      passageId: highlights.passageId,
      note: highlights.note,
      createdAt: highlights.createdAt,
      text: passages.text,
      page: passages.page,
      documentId: documents.id,
      title: documents.title,
      author: documents.author,
      sectionTitle: sections.title,
      sectionOrdinal: sections.ordinal,
    })
    .from(highlights)
    .innerJoin(passages, eq(passages.id, highlights.passageId))
    .innerJoin(documents, eq(documents.id, passages.documentId))
    .innerJoin(sections, eq(sections.id, passages.sectionId))
    .where(and(eq(highlights.userId, ownerId), documentId ? eq(passages.documentId, documentId) : undefined))
    .orderBy(desc(highlights.createdAt));
}

export async function highlightedIn(ownerId: string, passageIds: string[]) {
  if (!passageIds.length) return new Map<string, string | null>();
  const rows = await db
    .select({ passageId: highlights.passageId, note: highlights.note })
    .from(highlights)
    .where(and(eq(highlights.userId, ownerId), inArray(highlights.passageId, passageIds)));
  return new Map(rows.map((r) => [r.passageId, r.note]));
}

/* ─────────────────────────────── Connections ─────────────────────────────── */

const CONNECTION_POOL = 400;

async function termDocs(ownerId: string) {
  return db
    .select({ id: documents.id, title: documents.title, author: documents.author, year: documents.year, kind: documents.kind, keyTerms: documents.keyTerms })
    .from(documents)
    .where(and(eq(documents.ownerId, ownerId), eq(documents.status, "ready"), gt(documents.wordCount, 0)))
    .orderBy(desc(documents.createdAt))
    .limit(CONNECTION_POOL);
}

/** The documents closest to this one in subject, with the words they share. */
export async function relatedDocuments(ownerId: string, id: number, k = 6) {
  const docs = await termDocs(ownerId);
  const vectors = weigh(docs);
  const self = vectors.get(id);
  if (!self) return [];
  return docs
    .filter((d) => d.id !== id)
    .map((d) => ({ doc: d, ...compare(self, vectors.get(d.id)!) }))
    .filter((r) => r.score > 0.04 && r.shared.length >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => ({ id: r.doc.id, title: r.doc.title, author: r.doc.author, year: r.doc.year, score: r.score, shared: r.shared.slice(0, 6) }));
}

/**
 * Connections across the library: pairs of documents by different authors
 * that share the most ground, and the same at the level of authors.
 */
export async function libraryConnections(ownerId: string) {
  const docs = await termDocs(ownerId);
  const vectors = weigh(docs);

  const pairs: { a: (typeof docs)[number]; b: (typeof docs)[number]; score: number; shared: string[] }[] = [];
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = docs[i];
      const b = docs[j];
      const sameAuthor = authorNames(a.author).some((n) => authorNames(b.author).includes(n));
      if (sameAuthor) continue;
      const c = compare(vectors.get(a.id)!, vectors.get(b.id)!);
      if (c.score > 0.05 && c.shared.length >= 3) pairs.push({ a, b, score: c.score, shared: c.shared.slice(0, 8) });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  // Authors: the sum of their documents' vectors.
  const authorVec = new Map<string, Map<string, number>>();
  const authorDocs = new Map<string, number[]>();
  for (const d of docs) {
    for (const name of authorNames(d.author)) {
      const v = authorVec.get(name) ?? new Map<string, number>();
      for (const [t, w] of vectors.get(d.id)!) v.set(t, (v.get(t) ?? 0) + w);
      authorVec.set(name, v);
      authorDocs.set(name, [...(authorDocs.get(name) ?? []), d.id]);
    }
  }
  const names = [...authorVec.keys()];
  const authorPairs: { a: string; b: string; score: number; shared: string[] }[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const c = compare(authorVec.get(names[i])!, authorVec.get(names[j])!);
      if (c.score > 0.05 && c.shared.length >= 3) authorPairs.push({ a: names[i], b: names[j], score: c.score, shared: c.shared.slice(0, 8) });
    }
  }
  authorPairs.sort((x, y) => y.score - x.score);

  const authors = names
    .map((name) => {
      const v = [...authorVec.get(name)!.entries()].sort((x, y) => y[1] - x[1]);
      const closest = authorPairs.find((p) => p.a === name || p.b === name);
      return {
        name,
        documents: docs.filter((d) => authorDocs.get(name)!.includes(d.id)).map((d) => ({ id: d.id, title: d.title, year: d.year })),
        terms: v.slice(0, 8).map(([t]) => t),
        closest: closest ? { name: closest.a === name ? closest.b : closest.a, shared: closest.shared.slice(0, 4) } : null,
      };
    })
    .sort((a, b) => b.documents.length - a.documents.length || a.name.localeCompare(b.name));

  return { pairs: pairs.slice(0, 24), authorPairs: authorPairs.slice(0, 16), authors, considered: docs.length };
}

/** Documents still arriving (an upload in progress or abandoned). */
export async function incompleteUploads(ownerId: string) {
  return db
    .select({ id: documents.id, title: documents.title, createdAt: documents.createdAt })
    .from(documents)
    .where(and(eq(documents.ownerId, ownerId), eq(documents.status, "processing"), lt(documents.createdAt, new Date(Date.now() - 120_000))));
}
