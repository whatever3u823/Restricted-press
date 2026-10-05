import { NextResponse } from "next/server";
import { PASSAGE_ID } from "@/lib/ingest";
import { locatePassage } from "@/lib/library";
import { getViewer } from "@/lib/viewer";

/** Permanent passage links: /p/42.003.0012 → the reader, at the passage. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.user) return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(`/p/${id}`)}`, req.url));
  const loc = PASSAGE_ID.test(id) ? await locatePassage(viewer.user.id, id) : null;
  if (!loc) return NextResponse.redirect(new URL("/library", req.url));
  return NextResponse.redirect(new URL(`/d/${loc.documentId}/read/${loc.ordinal}#p-${id}`, req.url));
}
