import { and, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Uploader } from "@/components/uploader";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { archivistConfigured } from "@/lib/archivist";
import { LIBRARY_LIMITS } from "@/lib/config";
import { ACCEPT } from "@/lib/parse/accept";
import { requireReader } from "@/lib/viewer";

export const metadata: Metadata = { title: "Add documents" };

export default async function AddPage() {
  const viewer = await requireReader("/library/add");
  const [{ n }] = await db.select({ n: count() }).from(documents).where(and(eq(documents.ownerId, viewer.user.id)));
  const limit = LIBRARY_LIMITS[viewer.plan];
  const remaining = viewer.plan === "fellow" ? null : Math.max(0, limit - n);

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head__text">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/library">Library</Link> <span>/</span> <span>Add documents</span>
          </nav>
          <h1 className="h1">Add to your library</h1>
          <p className="page-head__sub">
            Each document is read, divided into its chapters and paragraphs, indexed for search
            {archivistConfigured() ? ", and catalogued by the Archivist with a short abstract and subjects" : ""}. Scanned
            PDFs without selectable text cannot be read yet.
          </p>
        </div>
      </header>
      {remaining === 0 ? (
        <div className="notice notice--signal">
          <strong>Your library is full.</strong> A free membership holds {limit} documents.{" "}
          <Link href="/membership" className="link">
            The Fellowship removes the limit
          </Link>
          , or remove documents you no longer need.
        </div>
      ) : (
        <Uploader accept={ACCEPT} remaining={remaining} />
      )}
    </div>
  );
}
