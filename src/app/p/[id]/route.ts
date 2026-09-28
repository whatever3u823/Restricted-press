import { NextResponse } from "next/server";
import { locatePassage } from "@/lib/archive";

/** Permanent passage links: /p/0017.003.0012 → the reader, scrolled to the passage. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loc = /^\d{4}\.\d{3}\.\d{4}$/.test(id) ? await locatePassage(id) : null;
  if (!loc) return NextResponse.redirect(new URL("/archive?missing=passage", req.url));
  return NextResponse.redirect(new URL(`/archive/${loc.slug}/read/${loc.ordinal}#p-${id}`, req.url));
}
