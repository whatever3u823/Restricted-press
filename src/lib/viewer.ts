/**
 * Who is looking, and what they may do. Every premium check in the app goes
 * through `can()`, so plans can be reshaped here without touching pages.
 */
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { entitlements } from "@/db/schema";
import { auth } from "./auth";

export type Plan = "visitor" | "reader" | "inner";

export type Feature =
  | "archivist.ask" // ask the Archivist at all (quota applies)
  | "archivist.deep" // deep research: more sources, query expansion, comparison
  | "archivist.unlimited"
  | "search.expanded" // conceptual search (expanded vocabulary)
  | "library.save" // save records
  | "passages.save" // save passages with notes
  | "text.inner"; // read texts marked Inner Archive

const FEATURES: Record<Plan, Feature[]> = {
  visitor: ["archivist.ask"],
  reader: ["archivist.ask"],
  inner: [
    "archivist.ask",
    "archivist.deep",
    "archivist.unlimited",
    "search.expanded",
    "library.save",
    "passages.save",
    "text.inner",
  ],
};

export type Viewer = {
  user: { id: string; name: string; email: string } | null;
  plan: Plan;
  can: (f: Feature) => boolean;
};

export async function hasActiveInner(userId: string) {
  const now = new Date();
  const rows = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.plan, "inner"),
        eq(entitlements.status, "active"),
        or(isNull(entitlements.endsAt), gt(entitlements.endsAt, now)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const user = session?.user ? { id: session.user.id, name: session.user.name, email: session.user.email } : null;
  const plan: Plan = !user ? "visitor" : (await hasActiveInner(user.id)) ? "inner" : "reader";
  const allowed = new Set(FEATURES[plan]);
  return { user, plan, can: (f) => allowed.has(f) };
});
