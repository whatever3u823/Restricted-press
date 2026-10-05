import { NextResponse } from "next/server";
import { createDocument, IngestError, metaSchema } from "@/lib/ingest";
import { getViewer } from "@/lib/viewer";

/** Open a new document in the reader's library. Its text follows in batches. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer.user) return NextResponse.json({ error: "Sign in to add documents." }, { status: 401 });
  const parsed = metaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The document's details were incomplete." }, { status: 400 });
  try {
    const id = await createDocument(viewer.user.id, viewer.plan, parsed.data);
    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof IngestError) return NextResponse.json({ error: err.message, gate: err.status === 403 }, { status: err.status });
    console.error("[upload] create", err);
    return NextResponse.json({ error: "The document could not be filed. Please try again." }, { status: 500 });
  }
}
