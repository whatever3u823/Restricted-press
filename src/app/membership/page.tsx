import type { Metadata } from "next";
import Link from "next/link";
import { MembershipActions } from "@/components/membership-actions";
import { ARCHIVIST_LIMITS, formatPrice, MEMBERSHIP } from "@/lib/config";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Access levels" };

const ROWS: [string, string, string][] = [
  ["Browse, search and read the open collection", "✓", "✓"],
  ["Files, provenance and rights records", "✓", "✓"],
  ["Archivist questions per day", `${ARCHIVIST_LIMITS.visitor} as a visitor · ${ARCHIVIST_LIMITS.reader} with a free account`, "Unlimited"],
  ["Deep research — wider search, twice the sources, cross-text comparison", "—", "✓"],
  ["Conceptual passage search with historical vocabulary and spellings", "Exact words", "✓"],
  ["Personal library of files", "—", "✓"],
  ["Saved passages with research notes", "—", "✓"],
  ["Inner Archive texts", "File record only", "✓"],
];

export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const viewer = await getViewer();
  const { from } = await searchParams;
  const price = formatPrice(MEMBERSHIP.monthlyPriceCents);

  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Restricted Press</Link> <span>/</span> <span>Access</span>
        </nav>
        {from ? (
          <div className="notice mt-3" style={{ maxWidth: 640 }}>
            <strong>That text is held in the Inner Archive.</strong> Its file record remains open to all.{" "}
            <Link href={`/archive/${from}`}>Return to the file →</Link>
          </div>
        ) : null}
      </header>

      <section className="page-head__row" style={{ alignItems: "end" }}>
        <div>
          <span className="file-no">Instrument 05 · Access</span>
          <h1 className="title-xl mt-2">Access levels</h1>
          <p className="lede mt-3" style={{ maxWidth: "44ch" }}>
            The archive is open to the public. The Inner Archive is for readers who mean to work in it: unlimited
            research with the Archivist, enquiry across texts, and a private register of files, passages and notes.
          </p>
        </div>
        <p className="class-mark" style={{ whiteSpace: "normal", textAlign: "right" }}>
          Your access: {viewer.plan === "inner" ? "Inner Archive" : viewer.plan === "reader" ? "Public · registered reader" : "Public · visitor"}
        </p>
      </section>

      <section className="tiers mt-6" aria-label="Access levels">
        <div className="tier">
          <span className="tier__level">Level 01 · Public access</span>
          <span className="tier__name">The Archive</span>
          <p className="tier__price">
            Open <span className="meta" style={{ fontFamily: "var(--sans)" }}>· no charge</span>
          </p>
          <ul>
            <li>Browse, search and read the open collection</li>
            <li>Files, provenance and rights records</li>
            <li>
              {ARCHIVIST_LIMITS.visitor} Archivist queries a day as a visitor · {ARCHIVIST_LIMITS.reader} with a free account
            </li>
            <li>Passage search by exact words</li>
          </ul>
          {viewer.plan === "visitor" ? (
            <Link href="/sign-up?next=/membership" className="link-arrow">
              Register as a reader
            </Link>
          ) : (
            <span className="stamp">{viewer.plan === "reader" ? "Your current level" : "Included"}</span>
          )}
        </div>
        <div className="tier tier--inner">
          <span className="tier__level">Level 02 · Inner Archive</span>
          <span className="tier__name">The Inner Archive</span>
          <div>
            <p className="tier__price">
              {price}
              <span className="meta" style={{ fontFamily: "var(--sans)" }}> / month</span>
            </p>
            <p className="meta mt-1">{MEMBERSHIP.pricingNote}</p>
          </div>
          <ul>
            <li>Unlimited research with the Archivist</li>
            <li>Deep research — wider search, twice the sources, cross-text comparison</li>
            <li>Conceptual passage search with historical vocabulary and spellings</li>
            <li>Inner Archive texts, read in full</li>
            <li>A private library of files and saved passages with research notes</li>
          </ul>
          <MembershipActions plan={viewer.plan} devUpgrade={process.env.ALLOW_DEV_UPGRADE === "true"} priceLabel={`${price}/month`} />
        </div>
      </section>

      <section className="mt-8">
        <div className="section-head">
          <h2>Schedule of access</h2>
        </div>
        <div className="table-scroll">
          <table className="rights-table" style={{ fontSize: 15 }}>
            <thead>
              <tr>
                <th style={{ width: "52%" }}>Provision</th>
                <th>Public access</th>
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
          <span className="label">In preparation for members</span>
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
