import { after, NextResponse } from "next/server";
import { catalogueDocument } from "@/lib/archivist";
import { finalizeDocument, IngestError } from "@/lib/ingest";
import { getViewer } from "@/lib/viewer";

export const maxDuration = 120;

/** Complete an upload; the Archivist then catalogues the document in the background. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer.user) return NextResponse.json({ error: "Sign in to add documents." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Unknown document." }, { status: 400 });
  try {
    await finalizeDocument(viewer.user.id, id);
  } catch (err) {
    if (err instanceof IngestError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[upload] finalize", err);
    return NextResponse.json({ error: "The document could not be completed. Please try again." }, { status: 500 });
  }
  after(() => catalogueDocument(id).catch((err) => console.error("[archivist] catalogue", err)));
  return NextResponse.json({ id });
}
