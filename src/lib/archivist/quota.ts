import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { researchQueries } from "@/db/schema";
import { ARCHIVIST_LIMITS } from "@/lib/config";
import type { Plan } from "@/lib/viewer";
import type { QuotaState } from "./types";

/** Archivist questions used in the last 24 hours by this reader. */
export async function getQuota(userId: string, plan: Plan): Promise<QuotaState> {
  const limit = ARCHIVIST_LIMITS[plan];
  if (limit === null) return { plan, limit: null, used: 0, remaining: null };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(researchQueries)
    .where(and(eq(researchQueries.userId, userId), gt(researchQueries.createdAt, since)));
  const used = row?.n ?? 0;
  return { plan, limit, used, remaining: Math.max(0, limit - used) };
}
