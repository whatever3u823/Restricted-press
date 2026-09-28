import { createHash } from "node:crypto";
import { and, count, eq, gt, or } from "drizzle-orm";
import { db } from "@/db";
import { researchQueries } from "@/db/schema";
import { ARCHIVIST_LIMITS } from "@/lib/config";
import type { Viewer } from "@/lib/viewer";
import type { QuotaState } from "./types";

export const VISITOR_COOKIE = "rp_vid";

/** Salted hash of the requesting address; never stored in the clear. */
export function clientHash(headers: Headers) {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? process.env.DATABASE_URL ?? ""}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/** Archivist questions used in the last 24 hours by this reader or visitor. */
export async function getQuota(viewer: Viewer, visitorId: string | null, client: string | null = null): Promise<QuotaState> {
  const limit = ARCHIVIST_LIMITS[viewer.plan];
  if (limit === null) return { plan: viewer.plan, limit: null, used: 0, remaining: null };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const who = viewer.user
    ? eq(researchQueries.userId, viewer.user.id)
    : visitorId && client
      ? or(eq(researchQueries.visitorId, visitorId), eq(researchQueries.clientHash, client))
      : visitorId
        ? eq(researchQueries.visitorId, visitorId)
        : client
          ? eq(researchQueries.clientHash, client)
          : null;
  if (!who) return { plan: viewer.plan, limit, used: 0, remaining: limit };
  const [row] = await db
    .select({ n: count() })
    .from(researchQueries)
    .where(and(who, gt(researchQueries.createdAt, since)));
  const used = row?.n ?? 0;
  return { plan: viewer.plan, limit, used, remaining: Math.max(0, limit - used) };
}
