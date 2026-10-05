"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { collectionDocuments, collections, documents, entitlements, highlights, passages } from "@/db/schema";
import { PASSAGE_ID } from "@/lib/ingest";
import { getViewer } from "@/lib/viewer";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const SIGN_IN = { ok: false as const, message: "Sign in to continue." };

async function reader() {
  const viewer = await getViewer();
  return viewer.user ? { viewer, userId: viewer.user.id } : null;
}

async function ownsDocument(userId: string, id: number) {
  const [d] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, id), eq(documents.ownerId, userId))).limit(1);
  return Boolean(d);
}

/* ─────────────────────────────── Documents ─────────────────────────────── */

const docPatch = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  author: z.string().trim().max(300).nullable().optional(),
  year: z.number().int().min(-3000).max(2100).nullable().optional(),
  kind: z.enum(["book", "article", "paper", "notes", "other"]).optional(),
  readingStatus: z.enum(["unread", "reading", "finished"]).optional(),
  notes: z.string().max(20000).nullable().optional(),
});

export async function updateDocument(id: number, patch: z.input<typeof docPatch>): Promise<ActionResult> {
  const r = await reader();
  if (!r) return SIGN_IN;
  const parsed = docPatch.safeParse(patch);
  if (!parsed.success) return { ok: false, message: "Those details could not be saved." };
  if (!(await ownsDocument(r.userId, id))) return { ok: false, message: "Document not found." };
  const p = parsed.data;
  await db
    .update(documents)
    .set({
      ...p,
      author: p.author === undefined ? undefined : p.author || null,
      notes: p.notes === undefined ? undefined : p.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id));
  revalidatePath(`/d/${id}`);
  revalidatePath("/library");
  return { ok: true };
}

export async function deleteDocument(id: number): Promise<ActionResult> {
  const r = await reader();
  if (!r) return SIGN_IN;
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.ownerId, r.userId)));
  revalidatePath("/library");
  return { ok: true };
}

/* ─────────────────────────────── Collections ─────────────────────────────── */

export async function createCollection(name: string, documentId?: number): Promise<ActionResult<{ id: number }>> {
  const r = await reader();
  if (!r) return SIGN_IN;
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!clean) return { ok: false, message: "Give the collection a name." };
  const [existing] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.ownerId, r.userId), eq(collections.name, clean)))
    .limit(1);
  const id = existing?.id ?? (await db.insert(collections).values({ ownerId: r.userId, name: clean }).returning({ id: collections.id }))[0].id;
  if (documentId && (await ownsDocument(r.userId, documentId))) {
    await db.insert(collectionDocuments).values({ collectionId: id, documentId }).onConflictDoNothing();
  }
  revalidatePath("/library");
  if (documentId) revalidatePath(`/d/${documentId}`);
  return { ok: true, id };
}

export async function renameCollection(id: number, name: string): Promise<ActionResult> {
  const r = await reader();
  if (!r) return SIGN_IN;
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!clean) return { ok: false, message: "Give the collection a name." };
  try {
    await db.update(collections).set({ name: clean }).where(and(eq(collections.id, id), eq(collections.ownerId, r.userId)));
  } catch {
    return { ok: false, message: "You already have a collection with that name." };
  }
  revalidatePath("/library");
  return { ok: true };
}

export async function deleteCollection(id: number): Promise<ActionResult> {
  const r = await reader();
  if (!r) return SIGN_IN;
  await db.delete(collections).where(and(eq(collections.id, id), eq(collections.ownerId, r.userId)));
  revalidatePath("/library");
  return { ok: true };
}

/** Put a document in a collection, or take it out. */
export async function toggleInCollection(collectionId: number, documentId: number): Promise<ActionResult<{ member: boolean }>> {
  const r = await reader();
  if (!r) return SIGN_IN;
  const [col] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.ownerId, r.userId)))
    .limit(1);
  if (!col || !(await ownsDocument(r.userId, documentId))) return { ok: false, message: "Not found." };
  const where = and(eq(collectionDocuments.collectionId, collectionId), eq(collectionDocuments.documentId, documentId));
  const existing = await db.select().from(collectionDocuments).where(where).limit(1);
  if (existing.length) await db.delete(collectionDocuments).where(where);
  else await db.insert(collectionDocuments).values({ collectionId, documentId });
  revalidatePath("/library");
  revalidatePath(`/d/${documentId}`);
  return { ok: true, member: !existing.length };
}

/* ─────────────────────────────── Highlights ─────────────────────────────── */

/** Mark a passage (with an optional note), update its note, or — with no note given — unmark it. */
export async function toggleHighlight(passageId: string, note?: string): Promise<ActionResult<{ marked: boolean }>> {
  const r = await reader();
  if (!r) return SIGN_IN;
  if (!PASSAGE_ID.test(passageId)) return { ok: false, message: "Unknown passage." };
  const [p] = await db
    .select({ id: passages.id })
    .from(passages)
    .where(and(eq(passages.id, passageId), eq(passages.ownerId, r.userId)))
    .limit(1);
  if (!p) return { ok: false, message: "Unknown passage." };
  const where = and(eq(highlights.userId, r.userId), eq(highlights.passageId, passageId));
  const existing = await db.select().from(highlights).where(where).limit(1);
  if (existing.length && note === undefined) {
    await db.delete(highlights).where(where);
    revalidatePath("/highlights");
    return { ok: true, marked: false };
  }
  const clean = note?.trim().slice(0, 4000) || null;
  if (existing.length) await db.update(highlights).set({ note: clean }).where(where);
  else await db.insert(highlights).values({ userId: r.userId, passageId, note: clean });
  revalidatePath("/highlights");
  return { ok: true, marked: true };
}

export async function deleteHighlights(ids: number[]): Promise<ActionResult> {
  const r = await reader();
  if (!r) return SIGN_IN;
  if (ids.length) await db.delete(highlights).where(and(eq(highlights.userId, r.userId), inArray(highlights.id, ids)));
  revalidatePath("/highlights");
  return { ok: true };
}

/* ─────────────────────────────── Membership ─────────────────────────────── */

/**
 * Preview-only Fellowship grant, standing in for checkout until payments
 * are connected. Disabled unless ALLOW_DEV_UPGRADE=true.
 */
export async function grantPreviewFellowship(): Promise<ActionResult> {
  if (process.env.ALLOW_DEV_UPGRADE !== "true") return { ok: false, message: "Fellowship checkout is not yet available." };
  const r = await reader();
  if (!r) return SIGN_IN;
  if (r.viewer.plan !== "fellow") {
    await db.insert(entitlements).values({ userId: r.userId, plan: "fellow", status: "active", source: "dev" });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function endPreviewFellowship(): Promise<ActionResult> {
  const r = await reader();
  if (!r) return SIGN_IN;
  await db
    .update(entitlements)
    .set({ status: "cancelled", endsAt: new Date(), updatedAt: new Date() })
    .where(and(eq(entitlements.userId, r.userId), eq(entitlements.source, "dev"), eq(entitlements.status, "active")));
  revalidatePath("/", "layout");
  return { ok: true };
}
