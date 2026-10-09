import type { Metadata } from "next";
import { FellowshipActions } from "@/components/fellowship-actions";
import { ARCHIVIST_LIMITS, FELLOWSHIP, formatPrice, LIBRARY_LIMITS } from "@/lib/config";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Membership" };

export default async function MembershipPage() {
  const viewer = await getViewer();
  const price = formatPrice(FELLOWSHIP.monthlyPriceCents);
  const signedIn = Boolean(viewer.user);

  return (
    <div className={signedIn ? "page" : "wrap"} style={signedIn ? undefined : { paddingTop: "clamp(48px, 8vw, 96px)" }}>
      <header className="page-head" style={{ display: "block" }}>
        <span className="eyebrow eyebrow--rule">Membership</span>
        <h1 className="h1" style={{ maxWidth: "18ch" }}>
          Two ways to <em>keep a library.</em>
        </h1>
        <p className="page-head__sub">
          Every member has a private library, a reading room and the Archivist. The Fellowship is for those who read for
          a living — or as if they did.
        </p>
      </header>

      <div className="plans mt-3">
        <section className="panel plan" aria-labelledby="plan-member">
          <div>
            <span className="eyebrow">Member</span>
            <h2 className="h2 mt-2" id="plan-member">
              The library
            </h2>
          </div>
          <div>
            <p className="plan__price">
              Free<small>always</small>
            </p>
            <p className="hint mt-2">No card, no trial period.</p>
          </div>
          <ul>
            <li>Up to {LIBRARY_LIMITS.member} documents — PDF, EPUB, Word, text, Markdown, HTML</li>
            <li>The reading room: three lighting modes, highlights and notes</li>
            <li>Search inside every page you own</li>
            <li>{ARCHIVIST_LIMITS.member} questions to the Archivist each day, every answer cited</li>
            <li>Collections, connections and the author map</li>
          </ul>
          <div className="plan__foot">
            {signedIn ? (
              viewer.plan === "member" ? (
                <p className="eyebrow">● Your current membership</p>
              ) : (
                <p className="eyebrow">Included in the Fellowship</p>
              )
            ) : (
              <a href="/sign-up" className="btn btn--block">
                Open your library
              </a>
            )}
          </div>
        </section>

        <section className="panel ticks plan plan--fellow" aria-labelledby="plan-fellow">
          <div>
            <span className="eyebrow eyebrow--brass">Fellow</span>
            <h2 className="h2 mt-2" id="plan-fellow">
              The Fellowship
            </h2>
          </div>
          <div>
            <p className="plan__price">
              {price}
              <small>a month</small>
            </p>
            <p className="hint mt-2">{FELLOWSHIP.pricingNote}</p>
          </div>
          <ul>
            <li>A library without practical limit — up to {LIBRARY_LIMITS.fellow.toLocaleString("en-US")} documents</li>
            <li>Unlimited questions to the Archivist</li>
            <li>Deep research: a wider search, twice the sources, and comparison across authors</li>
            <li>Everything in the membership</li>
          </ul>
          <div className="plan__foot">
            <FellowshipActions
              signedIn={signedIn}
              plan={viewer.plan}
              preview={process.env.ALLOW_DEV_UPGRADE === "true"}
              priceLabel={`${price}/month`}
            />
          </div>
        </section>
      </div>

      <section className="mt-6">
        <div className="block__head">
          <h2>On privacy</h2>
          <a href="/privacy" className="link small">
            The full account
          </a>
        </div>
        <div className="principles" style={{ borderTop: 0 }}>
          <div style={{ paddingTop: 0 }}>
            <h3>Your library is yours</h3>
            <p>Documents are visible to your account alone. Nothing you upload is shared, listed or published.</p>
          </div>
          <div style={{ paddingTop: 0 }}>
            <h3>Text, not files</h3>
            <p>Files are read in your browser; Athenaeum keeps their text, which is what makes them searchable.</p>
          </div>
          <div style={{ paddingTop: 0 }}>
            <h3>Answers on request</h3>
            <p>Passages are sent to the Archivist’s language model only to answer the question you ask of them.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
