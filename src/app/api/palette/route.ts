import { and, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getViewer } from "@/lib/viewer";

/** Documents for the command palette: title/author matches, or the most recently opened. */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer.user) return NextResponse.json({ documents: [] }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const mine = and(eq(documents.ownerId, viewer.user.id), eq(documents.status, "ready"));
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await db
    .select({ id: documents.id, title: documents.title, author: documents.author })
    .from(documents)
    .where(q ? and(mine, or(ilike(documents.title, like), ilike(documents.author, like))) : mine)
    .orderBy(q ? sql`position(lower(${q}) in lower(${documents.title})) = 0, lower(${documents.title})` : sql`${documents.lastReadAt} desc nulls last, ${documents.createdAt} desc`)
    .limit(q ? 8 : 5);
  return NextResponse.json({ documents: rows });
}
