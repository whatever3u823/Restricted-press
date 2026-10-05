import { NextResponse } from "next/server";
import { searchWithinDocument } from "@/lib/library";
import { getViewer } from "@/lib/viewer";

/** Find words within one document. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer.user) return NextResponse.json({ results: [] }, { status: 401 });
  const id = Number((await params).id);
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (!Number.isInteger(id) || q.length < 2) return NextResponse.json({ results: [] });
  return NextResponse.json({ results: await searchWithinDocument(viewer.user.id, id, q) });
}
