import type { Metadata } from "next";
import Link from "next/link";
import { MembershipActions } from "@/components/membership-actions";
import { InkStamp } from "@/components/period";
import { ARCHIVIST_LIMITS, formatPrice, MEMBERSHIP } from "@/lib/config";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "The Inner Archive" };

const ROWS: [string, string, string][] = [
  ["Browse, search and read the open collection", "✓", "✓"],
  ["Dossiers, provenance and rights records", "✓", "✓"],
  ["Archivist questions per day", `${ARCHIVIST_LIMITS.visitor} as a visitor · ${ARCHIVIST_LIMITS.reader} with a free account`, "Unlimited"],
  ["Deep research — wider search, twice the sources, cross-text comparison", "—", "✓"],
  ["Conceptual passage search with historical vocabulary and spellings", "Exact words", "✓"],
  ["Personal library of records", "—", "✓"],
  ["Saved passages with research notes", "—", "✓"],
  ["Inner Archive texts", "Dossier only", "✓"],
];

export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const viewer = await getViewer();
  const { from } = await searchParams;
  const price = formatPrice(MEMBERSHIP.monthlyPriceCents);

  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Restricted Press</Link> <span>/</span> <span>Inner Archive</span>
        </nav>
        {from ? (
          <div className="notice mt-3" style={{ maxWidth: 640 }}>
            <strong>That text is held in the Inner Archive.</strong> Its dossier remains open to all.{" "}
            <Link href={`/archive/${from}`}>Return to the dossier →</Link>
          </div>
        ) : null}
      </header>

      <section className="split" style={{ alignItems: "start" }}>
        <div>
          <span className="stamp stamp--accent stamp--large">Inner Archive</span>
          <h1 className="display mt-3" style={{ fontSize: "clamp(2.6rem, 6vw, 4.6rem)" }}>
            Unlock the deeper archive.
          </h1>
          <p className="lede mt-3" style={{ maxWidth: "40ch" }}>
            For readers who mean to work in the archive: unlimited research with the Archivist, enquiry across texts,
            and a private library of records, passages and notes.
          </p>
        </div>
        <div className="hero__panel" style={{ position: "relative" }}>
          <span style={{ position: "absolute", right: 10, top: -26, zIndex: 3 }}>
            <InkStamp tone="brass" sub="Members only" tilt={6}>
              Inner Archive
            </InkStamp>
          </span>
          <div className="spread" style={{ position: "relative" }}>
            <span className="label label--ink">Membership</span>
            <span className="label">{viewer.plan === "inner" ? "Active" : "Monthly"}</span>
          </div>
          <p className="tier__price mt-3" style={{ position: "relative" }}>
            {price}
            <span className="meta" style={{ fontFamily: "var(--sans)" }}> / month</span>
          </p>
          <p className="meta mt-1" style={{ position: "relative" }}>
            {MEMBERSHIP.pricingNote}
          </p>
          <div className="mt-3" style={{ position: "relative" }}>
            <MembershipActions plan={viewer.plan} devUpgrade={process.env.ALLOW_DEV_UPGRADE === "true"} priceLabel={`${price}/month`} />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="section-head">
          <h2>What membership opens</h2>
        </div>
        <div className="table-scroll">
          <table className="rights-table" style={{ fontSize: 15 }}>
            <thead>
              <tr>
                <th style={{ width: "52%" }}></th>
                <th>The Archive · free</th>
                <th>Inner Archive</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, a, b]) => (
                <tr key={k}>
                  <td style={{ fontFamily: "var(--serif)", fontSize: "1.08rem" }}>{k}</td>
                  <td className="muted">{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 split" style={{ alignItems: "start" }}>
        <div>
          <span className="label">Coming to members</span>
          <h2 className="title-l mt-1">Reading paths &amp; research collections</h2>
        </div>
        <p className="lede">
          Guided sequences through the archive — from the Hermetic texts to their Victorian interpreters, or through the
          English witch trials in the order they happened — and collections you can assemble and annotate.
        </p>
      </section>
    </div>
  );
}
