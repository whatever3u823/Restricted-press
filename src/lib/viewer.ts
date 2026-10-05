/**
 * Who is looking, and what they may do. Every plan check in the app goes
 * through `can()`, so plans can be reshaped here without touching pages.
 */
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { entitlements } from "@/db/schema";
import { auth } from "./auth";

/** member: a free account. fellow: the paid plan. */
export type Plan = "member" | "fellow";

export type Feature =
  | "archivist.deep" // deep research: wider search, more sources, comparison
  | "archivist.unlimited"
  | "library.unlimited";

const FEATURES: Record<Plan, Feature[]> = {
  member: [],
  fellow: ["archivist.deep", "archivist.unlimited", "library.unlimited"],
};

export type Reader = { id: string; name: string; email: string };

export type Viewer = {
  user: Reader | null;
  plan: Plan;
  can: (f: Feature) => boolean;
};

export async function hasActiveFellowship(userId: string) {
  const now = new Date();
  const rows = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.plan, "fellow"),
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
  const plan: Plan = user && (await hasActiveFellowship(user.id)) ? "fellow" : "member";
  const allowed = new Set(user ? FEATURES[plan] : []);
  return { user, plan, can: (f) => allowed.has(f) };
});

/** For pages inside the library: the signed-in reader, or a redirect to sign in. */
export async function requireReader(next: string): Promise<Viewer & { user: Reader }> {
  const viewer = await getViewer();
  if (!viewer.user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return viewer as Viewer & { user: Reader };
}
