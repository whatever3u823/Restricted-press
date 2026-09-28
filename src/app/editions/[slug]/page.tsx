import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover, IndexHead, InkStamp } from "@/components/period";
import { Byline } from "@/components/records";
import { RequestForm } from "@/components/request-form";
import { editionNumber, fileNo, getDossier, yearLabel } from "@/lib/archive";
import { formatPrice } from "@/lib/config";
import { getViewer } from "@/lib/viewer";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const d = await getDossier((await params).slug);
  return { title: d?.physical ? `${d.physical.name} — Restricted Edition` : "Restricted Edition" };
}

export default async function EditionPage({ params }: { params: Params }) {
  const { slug } = await params;
  const d = await getDossier(slug);
  if (!d || !d.physical) notFound();
  const { work, item, physical: e, edition: hist, source } = d;
  const [no, viewer] = await Promise.all([editionNumber(work.id), getViewer()]);
  const status = e.status === "available" ? "Available" : e.status === "sold_out" ? "Out of print" : "In preparation";
  const firstBody = d.sections.find((x) => x.matter === "body") ?? d.sections[0];
  const readable = work.publicationStatus === "published" && firstBody && !(work.accessLevel === "inner" && !viewer.can("text.inner"));
  const name = e.name.replace(/^Restricted Edition\s*[—–-]\s*/i, "");
  const words = d.sections.reduce((n, s) => n + (s.wordCount ?? 0), 0);

  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Restricted Press</Link> <span>/</span> <Link href="/editions">Restricted Editions</Link> <span>/</span>{" "}
          <span>RP / {no}</span>
        </nav>
      </header>

      <section className="file-head">
        <div className="file-head__cover">
          <BookCover item={item} />
          <InkStamp sub={`RP / ${no}`} tilt={-6}>
            Restored
          </InkStamp>
        </div>
        <div>
          <div className="file-head__kicker">
            <span className="file-no">Restricted Press Edition · RP / {no}</span>
            <span className="stamp stamp--red">{status}</span>
          </div>
          <h1 className="file-head__title">{name}</h1>
          <p className="file-head__by">
            <Byline authors={item.authors} />
          </p>
          {e.description ? <p className="lede file-head__desc">{e.description}</p> : null}

          <dl className="edition-spec mt-6">
            <div>
              <dt>Archive copy</dt>
              <dd>
                <Link href={`/archive/${work.slug}`} style={{ textDecoration: "none" }}>
                  {fileNo(work.accession)} · {yearLabel(work.originalYear, work.originalYearBasis)} →
                </Link>
              </dd>
            </div>
            <div>
              <dt>Edition</dt>
              <dd className="red">Restricted Press Edition · RP / {no}</dd>
            </div>
            <div>
              <dt>Restored from</dt>
              <dd>
                {hist ? [hist.label, hist.publisher].filter(Boolean).join(" · ") : "Historical source"}
                {source ? ` · via ${source.provider}` : ""}
              </dd>
            </div>
            <div>
              <dt>Text</dt>
              <dd>
                Complete · original spelling preserved{words ? ` · ${words.toLocaleString()} words` : ""}
              </dd>
            </div>
            <div>
              <dt>Production</dt>
              <dd>Professionally typeset · printed on demand</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>
                {e.priceCents ? formatPrice(e.priceCents, e.currency) : "To be announced"}
                {e.status === "available" ? "" : " · indicative"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="band">
        <IndexHead no="01" title={e.status === "available" ? "Order the edition" : "Register interest"} />
        <div className="split" style={{ alignItems: "start" }}>
          <div>
            <h2 className="title-l" style={{ maxWidth: "20ch" }}>
              {e.status === "available" ? "Copies are printed to order." : "This edition is in preparation."}
            </h2>
            <p className="lede mt-3" style={{ maxWidth: "40ch" }}>
              Ordering is not yet open. Register your interest and the Press will write when copies are issued — the
              register also decides print quantities.
            </p>
          </div>
          <div className="frame">
            <RequestForm
              kind="edition"
              workId={work.id}
              presetTitle={e.name}
              signedInEmail={viewer.user?.email ?? null}
              submitLabel="Register interest"
            />
          </div>
        </div>
      </section>

      <section className="band" style={{ borderBottom: 0 }}>
        <IndexHead
          no="02"
          title="The archive copy"
          aside={
            <Link href={`/archive/${work.slug}`} className="link-arrow">
              Open the file
            </Link>
          }
        />
        <p className="lede" style={{ maxWidth: "60ch" }}>
          {work.summary}
        </p>
        <div className="row mt-4">
          {readable ? (
            <Link href={`/archive/${work.slug}/read/${firstBody.ordinal}`} className="btn btn--ghost">
              Read the text
            </Link>
          ) : null}
          <Link href={`/archivist?scope=${work.slug}`} className="btn btn--ghost">
            Consult the Archivist
          </Link>
        </div>
      </section>
    </div>
  );
}
