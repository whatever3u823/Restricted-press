import { NextResponse } from "next/server";
import { appendSections, IngestError, sectionsSchema } from "@/lib/ingest";
import { getViewer } from "@/lib/viewer";

export const maxDuration = 60;

/** Receive a batch of a document's sections. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer.user) return NextResponse.json({ error: "Sign in to add documents." }, { status: 401 });
  const id = Number((await params).id);
  const parsed = sectionsSchema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return NextResponse.json({ error: "Part of the document arrived damaged." }, { status: 400 });
  try {
    return NextResponse.json(await appendSections(viewer.user.id, id, parsed.data));
  } catch (err) {
    if (err instanceof IngestError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[upload] sections", err);
    return NextResponse.json({ error: "Part of the document could not be stored. Please try again." }, { status: 500 });
  }
}
