"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { entitlements, passages, savedPassages, savedWorks, works } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

export type ActionResult =
  | { ok: true; saved: boolean }
  | { ok: false; reason: "signin" | "gate" | "invalid"; message: string };

const SIGN_IN: ActionResult = { ok: false, reason: "signin", message: "Sign in to keep a personal library." };
const GATE: ActionResult = {
  ok: false,
  reason: "gate",
  message: "Your personal library is part of the Inner Archive.",
};

export async function toggleSavedWork(workId: number): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.user) return SIGN_IN;
  if (!viewer.can("library.save")) return GATE;
  const [work] = await db.select({ id: works.id }).from(works).where(eq(works.id, workId)).limit(1);
  if (!work) return { ok: false, reason: "invalid", message: "Record not found." };
  const where = and(eq(savedWorks.userId, viewer.user.id), eq(savedWorks.workId, workId));
  const existing = await db.select().from(savedWorks).where(where).limit(1);
  if (existing.length) {
    await db.delete(savedWorks).where(where);
  } else {
    await db.insert(savedWorks).values({ userId: viewer.user.id, workId });
  }
  revalidatePath("/library");
  return { ok: true, saved: !existing.length };
}

export async function toggleSavedPassage(passageId: string, note?: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.user) return { ...SIGN_IN, message: "Sign in to save passages." } as ActionResult;
  if (!viewer.can("passages.save")) return { ...GATE, message: "Saved passages are part of the Inner Archive." } as ActionResult;
  if (!/^\d{4}\.\d{3}\.\d{4}$/.test(passageId)) return { ok: false, reason: "invalid", message: "Unknown passage." };
  const [p] = await db.select({ id: passages.id }).from(passages).where(eq(passages.id, passageId)).limit(1);
  if (!p) return { ok: false, reason: "invalid", message: "Unknown passage." };
  const where = and(eq(savedPassages.userId, viewer.user.id), eq(savedPassages.passageId, passageId));
  const existing = await db.select().from(savedPassages).where(where).limit(1);
  if (existing.length && note === undefined) {
    await db.delete(savedPassages).where(where);
    revalidatePath("/library");
    return { ok: true, saved: false };
  }
  if (existing.length) {
    await db.update(savedPassages).set({ note: note?.slice(0, 4000) || null }).where(where);
  } else {
    await db.insert(savedPassages).values({ userId: viewer.user.id, passageId, note: note?.slice(0, 4000) || null });
  }
  revalidatePath("/library");
  return { ok: true, saved: true };
}

/**
 * Development-only membership grant, standing in for checkout until payments
 * are connected. Disabled unless ALLOW_DEV_UPGRADE=true.
 */
export async function grantDevMembership(): Promise<ActionResult> {
  if (process.env.ALLOW_DEV_UPGRADE !== "true") {
    return { ok: false, reason: "invalid", message: "Membership checkout is not yet available." };
  }
  const viewer = await getViewer();
  if (!viewer.user) return SIGN_IN;
  if (viewer.plan !== "inner") {
    await db.insert(entitlements).values({ userId: viewer.user.id, plan: "inner", status: "active", source: "dev" });
  }
  revalidatePath("/", "layout");
  return { ok: true, saved: true };
}

export async function cancelDevMembership(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.user) return SIGN_IN;
  await db
    .update(entitlements)
    .set({ status: "cancelled", endsAt: new Date(), updatedAt: new Date() })
    .where(and(eq(entitlements.userId, viewer.user.id), eq(entitlements.source, "dev"), eq(entitlements.status, "active")));
  revalidatePath("/", "layout");
  return { ok: true, saved: false };
}
