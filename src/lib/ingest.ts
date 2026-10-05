/**
 * Storing an upload.
 *
 * The browser parses the file and sends its sections in batches (a large
 * book can exceed one request's size limit):
 *
 *   createDocument   → a document in "processing" state
 *   appendSections   → sections and passages, numbered on from what is stored
 *   finalizeDocument → counts and key terms; the document becomes "ready"
 *
 * Every step checks that the document belongs to the reader.
 */
import { and, asc, count, eq, lt, max, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents, passages, sections } from "@/db/schema";
import { LIBRARY_LIMITS, UPLOAD } from "@/lib/config";
import { countWords } from "@/lib/parse/model";
import { extractKeyTerms } from "@/lib/terms";
import type { Plan } from "@/lib/viewer";

const pad = (n: number, width: number) => String(n).padStart(width, "0");
export const passageId = (doc: number, section: number, para: number) => `${doc}.${pad(section, 3)}.${pad(para, 4)}`;
export const PASSAGE_ID = /^\d+\.\d{3,}\.\d{4,}$/;

export const metaSchema = z.object({
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().max(300).nullish(),
  year: z.number().int().min(-3000).max(2100).nullish(),
  kind: z.enum(["book", "article", "paper", "notes", "other"]).default("book"),
  format: z.enum(["pdf", "epub", "docx", "txt", "md", "html"]),
  filename: z.string().max(300).nullish(),
});

const blockSchema = z.object({
  kind: z.enum(["paragraph", "heading", "verse", "quote", "code"]),
  text: z.string().max(200_000),
  level: z.number().int().min(1).max(9).optional(),
  page: z.number().int().min(1).max(100_000).optional(),
});

export const sectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().trim().max(400),
        level: z.number().int().min(1).max(3),
        blocks: z.array(blockSchema).max(20_000),
      }),
    )
    .min(1)
    .max(500),
});

export class IngestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function createDocument(ownerId: string, plan: Plan, meta: z.infer<typeof metaSchema>) {
  // Uploads abandoned part-way (a closed tab) are cleared after an hour.
  await db
    .delete(documents)
    .where(and(eq(documents.ownerId, ownerId), eq(documents.status, "processing"), lt(documents.createdAt, new Date(Date.now() - 3600_000))));
  const [{ n }] = await db.select({ n: count() }).from(documents).where(eq(documents.ownerId, ownerId));
  const limit = LIBRARY_LIMITS[plan];
  if (n >= limit) {
    throw new IngestError(
      plan === "fellow"
        ? `Your library holds the maximum of ${limit} documents.`
        : `Your library holds ${limit} documents, the limit for a free membership. The Fellowship removes the limit.`,
      403,
    );
  }
  const [doc] = await db
    .insert(documents)
    .values({
      ownerId,
      title: meta.title,
      author: meta.author || null,
      year: meta.year ?? null,
      kind: meta.kind,
      format: meta.format,
      filename: meta.filename ?? null,
    })
    .returning({ id: documents.id });
  return doc.id;
}

async function ownedProcessing(ownerId: string, id: number) {
  const [doc] = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.ownerId, ownerId)))
    .limit(1);
  if (!doc) throw new IngestError("Document not found.", 404);
  if (doc.status !== "processing") throw new IngestError("This document has already been filed.", 409);
  return doc;
}

/** Very long blocks are split at sentence boundaries, so a citation points somewhere precise. */
function splitLong(text: string): string[] {
  if (countWords(text) <= 450) return [text];
  const sentences = text.split(/(?<=[.!?]["”’)\]]?)\s+(?=["“‘(\[]?[\p{Lu}\p{N}])/u);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && countWords(cur) + countWords(s) > 260) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  // A "sentence" can itself be enormous (no punctuation): fall back to word windows.
  return out.flatMap((chunk) => {
    const w = chunk.split(/\s+/);
    if (w.length <= 600) return [chunk];
    const parts: string[] = [];
    for (let i = 0; i < w.length; i += 300) parts.push(w.slice(i, i + 300).join(" "));
    return parts;
  });
}

export async function appendSections(ownerId: string, id: number, input: z.infer<typeof sectionsSchema>) {
  await ownedProcessing(ownerId, id);
  const [{ s: lastSection }] = await db.select({ s: max(sections.ordinal) }).from(sections).where(eq(sections.documentId, id));
  const [{ p: lastPassage }] = await db.select({ p: max(passages.ordinal) }).from(passages).where(eq(passages.documentId, id));
  const [{ w: storedWords }] = await db.select({ w: sql<number>`coalesce(sum(${sections.wordCount}), 0)::int` }).from(sections).where(eq(sections.documentId, id));

  let sectionOrdinal = lastSection ?? 0;
  let passageOrdinal = lastPassage ?? 0;
  let words = storedWords;

  for (const s of input.sections) {
    sectionOrdinal += 1;
    const rows: (typeof passages.$inferInsert)[] = [];
    let para = 0;
    let sectionWords = 0;
    for (const b of s.blocks) {
      const parts = b.kind === "paragraph" || b.kind === "quote" ? splitLong(b.text) : [b.text];
      for (const text of parts) {
        if (!text.trim()) continue;
        const wc = countWords(text);
        sectionWords += wc;
        rows.push({
          id: passageId(id, sectionOrdinal, ++para),
          documentId: id,
          sectionId: 0,
          ownerId,
          ordinal: ++passageOrdinal,
          kind: b.kind,
          text,
          wordCount: wc,
          page: b.page ?? null,
        });
      }
    }
    words += sectionWords;
    if (words > UPLOAD.maxWords) throw new IngestError("This document is longer than a single upload can hold.", 413);
    const [sec] = await db
      .insert(sections)
      .values({ documentId: id, ordinal: sectionOrdinal, title: s.title || `Section ${sectionOrdinal}`, level: s.level, wordCount: sectionWords })
      .returning({ id: sections.id });
    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(passages).values(rows.slice(i, i + 500).map((r) => ({ ...r, sectionId: sec.id })));
    }
  }
  return { sections: sectionOrdinal };
}

export async function finalizeDocument(ownerId: string, id: number) {
  await ownedProcessing(ownerId, id);
  const secs = await db
    .select({ wordCount: sections.wordCount })
    .from(sections)
    .where(eq(sections.documentId, id))
    .orderBy(asc(sections.ordinal));
  if (!secs.length) throw new IngestError("No text arrived for this document.", 400);
  const texts = await db
    .select({ text: passages.text })
    .from(passages)
    .where(and(eq(passages.documentId, id), sql`${passages.kind} <> 'code'`));
  const keyTerms = extractKeyTerms(texts.map((t) => t.text));
  await db
    .update(documents)
    .set({
      status: "ready",
      wordCount: secs.reduce((n, s) => n + s.wordCount, 0),
      sectionCount: secs.length,
      keyTerms,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id));
}
