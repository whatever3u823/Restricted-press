import type { Metadata } from "next";
import Link from "next/link";
import { IndexHead } from "@/components/period";
import { RequestForm } from "@/components/request-form";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Request a title" };

export default async function RequestPage() {
  const viewer = await getViewer();
  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Restricted Press</Link> <span>/</span> <span>Request a title</span>
        </nav>
        <h1 className="title-xl mt-3" style={{ maxWidth: "16ch" }}>
          Request a title
        </h1>
        <p className="lede mt-3" style={{ maxWidth: "46ch" }}>
          Name a text the archive does not yet hold. Requests are entered in the accession register and guide what is
          recovered next.
        </p>
      </header>

      <div className="split" style={{ alignItems: "start" }}>
        <div className="frame">
          <span className="label label--red">Form A-1 · Accession request</span>
          <div className="mt-3">
            <RequestForm kind="title" signedInEmail={viewer.user?.email ?? null} submitLabel="File request" />
          </div>
        </div>
        <div>
          <IndexHead no="—" title="Procedure" />
          <ol className="numbered">
            <li>
              <div>
                <strong>Identification</strong>
                <p className="meta mt-1">The requested work and a suitable printed edition are identified.</p>
              </div>
            </li>
            <li>
              <div>
                <strong>Provenance &amp; rights</strong>
                <p className="meta mt-1">
                  The text, translation, introduction and illustrations are each assessed. An old book is not assumed
                  to be free of rights.
                </p>
              </div>
            </li>
            <li>
              <div>
                <strong>Accession</strong>
                <p className="meta mt-1">Cleared titles receive a file number, a dossier and a readable text.</p>
              </div>
            </li>
          </ol>
          <p className="meta mt-4">
            Requests are not guaranteed. Titles still in copyright cannot be accessioned without a licence.
          </p>
        </div>
      </div>
    </div>
  );
}
