import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { researchQueries } from "@/db/schema";
import { runArchivist } from "@/lib/archivist";
import { getQuota } from "@/lib/archivist/quota";
import { PASSAGE_ID } from "@/lib/ingest";
import { getViewer } from "@/lib/viewer";

export const maxDuration = 120;

const body = z.object({
  question: z.string().trim().min(3).max(1000),
  mode: z.enum(["standard", "deep"]).default("standard"),
  documents: z.array(z.number().int().positive()).max(12).nullish(),
  passage: z.string().regex(PASSAGE_ID).nullish(),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please ask a question of at least a few words." }, { status: 400 });
  }
  const { question, mode, documents, passage } = parsed.data;

  const viewer = await getViewer();
  if (!viewer.user) return NextResponse.json({ error: "Sign in to consult the Archivist." }, { status: 401 });

  if (mode === "deep" && !viewer.can("archivist.deep")) {
    return NextResponse.json({ error: "Deep research is part of the Fellowship.", gate: "archivist.deep" }, { status: 403 });
  }

  const quota = await getQuota(viewer.user.id, viewer.plan);
  if (quota.remaining === 0) {
    return NextResponse.json(
      { error: "You have used today's questions. The Fellowship removes the limit.", gate: "archivist.unlimited", quota },
      { status: 429 },
    );
  }

  try {
    const result = await runArchivist(question, {
      ownerId: viewer.user.id,
      mode,
      documentIds: documents ?? undefined,
      passageId: passage ?? null,
    });
    const [row] = await db
      .insert(researchQueries)
      .values({ userId: viewer.user.id, question, mode, response: result })
      .returning({ id: researchQueries.id });
    const used = quota.limit === null ? 0 : quota.used + 1;
    return NextResponse.json({
      result: { ...result, id: row.id },
      quota: { ...quota, used, remaining: quota.limit === null ? null : Math.max(0, quota.limit - used) },
    });
  } catch (err) {
    console.error("[archivist]", err);
    return NextResponse.json(
      { error: "The Archivist could not complete this request. Nothing was counted against your questions — please try again." },
      { status: 502 },
    );
  }
}
