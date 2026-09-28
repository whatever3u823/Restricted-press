import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { researchQueries } from "@/db/schema";
import { runArchivist } from "@/lib/archivist";
import { clientHash, getQuota, VISITOR_COOKIE } from "@/lib/archivist/quota";
import { getViewer } from "@/lib/viewer";

export const maxDuration = 120;

const body = z.object({
  question: z.string().trim().min(3).max(600),
  mode: z.enum(["standard", "deep"]).default("standard"),
  scope: z.string().regex(/^[a-z0-9-]+$/).nullish(),
  passage: z.string().regex(/^\d{4}\.\d{3}\.\d{4}$/).nullish(),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please ask a question of at least a few words." }, { status: 400 });
  }
  const { question, mode, scope, passage } = parsed.data;

  const viewer = await getViewer();
  const jar = await cookies();
  let visitorId = jar.get(VISITOR_COOKIE)?.value ?? null;
  if (!viewer.user && !visitorId) {
    visitorId = randomUUID();
    jar.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }

  if (mode === "deep" && !viewer.can("archivist.deep")) {
    return NextResponse.json(
      { error: "Deep research is part of the Inner Archive.", gate: "archivist.deep" },
      { status: 403 },
    );
  }

  const client = viewer.user ? null : clientHash(req.headers);
  const quota = await getQuota(viewer, visitorId, client);
  if (quota.remaining === 0) {
    return NextResponse.json(
      {
        error: viewer.user
          ? "You have used today's Archivist questions. The Inner Archive removes the limit."
          : "You have used the Archivist's questions for visitors today. Create a free account for more, or join the Inner Archive for unlimited research.",
        gate: "archivist.unlimited",
        quota,
      },
      { status: 429 },
    );
  }

  try {
    const result = await runArchivist(question, {
      mode,
      includeInner: viewer.can("text.inner"),
      scopeSlug: scope ?? null,
      passageId: passage ?? null,
    });
    const [row] = await db
      .insert(researchQueries)
      .values({ userId: viewer.user?.id ?? null, visitorId: viewer.user ? null : visitorId, clientHash: client, question, mode, response: result })
      .returning({ id: researchQueries.id });
    const used = quota.limit === null ? 0 : quota.used + 1;
    return NextResponse.json({
      result: { ...result, id: row.id },
      quota: { ...quota, used, remaining: quota.limit === null ? null : Math.max(0, quota.limit - used) },
    });
  } catch (err) {
    console.error("[archivist]", err);
    return NextResponse.json(
      { error: "The Archivist could not complete this request. Nothing was charged against your questions — please try again." },
      { status: 502 },
    );
  }
}
