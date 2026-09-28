import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { ArchivistConsole } from "@/components/archivist-console";
import { fileNo, getDossier } from "@/lib/archive";
import { archivistConfigured } from "@/lib/archivist";
import { clientHash, getQuota, VISITOR_COOKIE } from "@/lib/archivist/quota";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "The Archivist" };

type SP = Promise<{ q?: string; scope?: string; passage?: string }>;

const GENERAL_SUGGESTIONS = [
  "What did accused witches confess about the Devil's mark?",
  "How do these texts describe the philosopher's stone?",
  "What happens to the soul after death, according to the archive?",
  "Who was Matthew Hopkins?",
  "How is the priest of Nemi explained?",
  "What did Dr. Dee record about Edward Kelley?",
];

export default async function ArchivistPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
  const quota = await getQuota(viewer, visitorId, viewer.user ? null : clientHash(await headers()));
  const scopeDossier = sp.scope ? await getDossier(sp.scope) : null;
  const scope =
    scopeDossier && scopeDossier.work.publicationStatus === "published"
      ? { slug: scopeDossier.work.slug, title: scopeDossier.work.title, file: fileNo(scopeDossier.work.accession) }
      : null;
  const passage = sp.passage && /^\d{4}\.\d{3}\.\d{4}$/.test(sp.passage) ? sp.passage : null;

  const suggestions = scopeDossier?.work.archivistQuestions.length ? scopeDossier.work.archivistQuestions : GENERAL_SUGGESTIONS;
  const initialQuestion =
    sp.q ?? (passage ? `What is this passage (¶ ${passage}) saying, and where else does the archive take up its subject?` : "");

  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Restricted Press</Link> <span>/</span> <span>The Archivist</span>
        </nav>
      </header>
      <div className="archivist">
        <div className="page-head__row">
          <div>
            <span className="file-no">Instrument 03 · Research terminal</span>
            <h1 className="title-xl mt-2">The Archivist</h1>
            <p className="label label--red mt-3">A research instrument for the restricted collection</p>
          </div>
          <p className="meta" style={{ maxWidth: "40ch" }}>
            Put a question in plain language. The Archivist reads the archive passage by passage and answers only from
            what it retrieves — every claim cited to file, section and paragraph.
          </p>
        </div>
        <ArchivistConsole
          initialQuestion={initialQuestion}
          autoRun={Boolean(sp.q || passage)}
          scope={scope}
          passage={passage}
          suggestions={suggestions}
          quota={quota}
          canDeep={viewer.can("archivist.deep")}
          signedIn={Boolean(viewer.user)}
          generative={archivistConfigured()}
        />
      </div>
    </div>
  );
}
