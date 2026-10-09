import Link from "next/link";
import { redirect } from "next/navigation";
import { ARCHIVIST_LIMITS, LIBRARY_LIMITS } from "@/lib/config";
import { getViewer } from "@/lib/viewer";

export default async function Landing() {
  const viewer = await getViewer();
  if (viewer.user) redirect("/library");

  return (
    <>
      <section className="hero">
        <div className="wrap hero__grid">
          <div>
            <span className="eyebrow eyebrow--rule rise">Private library &amp; research instrument</span>
            <h1 className="display rise" style={{ ["--i" as string]: 1 }}>
              Your library.
              <br />
              <em>Total recall.</em>
            </h1>
            <p className="lede hero__lede rise" style={{ ["--i" as string]: 2 }}>
              Athenaeum keeps the books, papers and articles you collect — and the Archivist, a librarian that has
              read every page of them. Ask it anything. It answers from your library alone, and cites the sentence.
            </p>
            <div className="hero__cta rise" style={{ ["--i" as string]: 3 }}>
              <Link href="/sign-up" className="btn btn--primary btn--lg">
                Open your library
              </Link>
              <Link href="/sign-in" className="link">
                I have a library — sign in
              </Link>
            </div>
            <p className="hero__fine rise" style={{ ["--i" as string]: 4 }}>
              <span>PDF, EPUB, Word, text</span>
              <span>Private to your account</span>
              <span>Every answer cited</span>
            </p>
          </div>

          <div className="stage rise" style={{ ["--i" as string]: 2 }} aria-label="Athenaeum: a page in the reading room, and the Archivist answering from it">
            <figure className="leaf" aria-hidden="true">
              <p className="leaf__kicker">The Prince · § 25</p>
              <p className="leaf__title">What fortune can effect in human affairs</p>
              <p className="leaf__text">
                <span className="leaf__folio">p. 98</span>
                <mark>
                  I hold it to be true that Fortune is the arbiter of one-half of our actions, but that she still leaves us
                  to direct the other half, or perhaps a little less.
                </mark>{" "}
                I compare her to one of those raging rivers, which when in flood overflows the plains…
              </p>
              <p className="leaf__note">Against Seneca — preparation as defence, or as seizure?</p>
            </figure>

            <figure className="panel ticks specimen" aria-label="An example inquiry to the Archivist">
              <div className="specimen__bar">
                <span>The Archivist</span>
                <span className="brass">● Source-bound</span>
              </div>
              <p className="specimen__q">Where do Seneca and Machiavelli part ways on fortune?</p>
              <div className="specimen__a">
                <p>
                  <span className="cited">Both treat fortune as a force to be prepared for rather than prayed to</span>
                  <span className="cite">1</span>
                  <span className="cite">2</span>. They part on what preparation is for.{" "}
                  <span className="cited">Machiavelli wants the prince to seize her — boldness over caution</span>
                  <span className="cite">2</span>; <span className="cited">Seneca wants a man who has nothing she can take</span>
                  <span className="cite">1</span>.
                </p>
              </div>
              <ol className="specimen__src" role="list">
                <li>
                  <span className="brass mono">1</span>
                  <span>
                    <b>On Providence</b> — Seneca
                  </span>
                  <span className="ref">§1 ¶2</span>
                </li>
                <li>
                  <span className="brass mono">2</span>
                  <span>
                    <b>The Prince</b> — Machiavelli
                  </span>
                  <span className="ref">§25 ¶1 · p. 98</span>
                </li>
              </ol>
            </figure>
          </div>
        </div>
      </section>

      <section className="band" id="method">
        <div className="wrap">
          <div className="band__head">
            <div>
              <span className="eyebrow eyebrow--brass">The method</span>
              <h2 className="h1 mt-2">Four instruments. One discipline.</h2>
            </div>
            <p className="lede">
              Most reading software stores files. Athenaeum understands them — every chapter, every paragraph, every
              author — so that what you have read is never lost to you again.
            </p>
          </div>

          <ol className="index" role="list">
            <li className="index-row">
              <span className="index-row__n">01</span>
              <h3>Collect</h3>
              <p>
                Bring PDFs, EPUBs, Word documents and text. Athenaeum extracts the text, finds the chapters, and files
                each document — catalogued on arrival by the Archivist.
              </p>
              <span className="index-row__token formats" aria-label="Supported formats">
                {["PDF", "EPUB", "DOCX", "TXT", "MD", "HTML"].map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </span>
            </li>
            <li className="index-row">
              <span className="index-row__n">02</span>
              <h3>Read</h3>
              <p>
                A reading room built for concentration: three lights, adjustable type and measure, your place kept,
                and every passage marked, annotated and addressable.
              </p>
              <span className="index-row__token lights" aria-label="Night, Dusk and Paper lighting">
                <span data-light="night">Aa</span>
                <span data-light="dusk">Aa</span>
                <span data-light="paper">Aa</span>
              </span>
            </li>
            <li className="index-row">
              <span className="index-row__n">03</span>
              <h3>Interrogate</h3>
              <p>
                Put questions to the Archivist. It searches every page you own and answers only from them, citing the
                exact sentences — and the page, where there is one.
              </p>
              <span className="index-row__token" aria-hidden="true">
                <span className="cite" data-active="true">
                  2
                </span>
                <span className="ref" style={{ marginLeft: 10 }}>
                  The Prince · §25 ¶1 · p. 98
                </span>
              </span>
            </li>
            <li className="index-row">
              <span className="index-row__n">04</span>
              <h3>Connect</h3>
              <p>
                See where your authors converge. Athenaeum maps the ground shared between documents and between
                authors, and the Archivist will trace it for you.
              </p>
              <span className="index-row__token pairing" aria-hidden="true">
                <span>Seneca</span>
                <span className="pairing__line" />
                <span>Machiavelli</span>
              </span>
            </li>
          </ol>
        </div>
      </section>

      <section className="band">
        <div className="wrap band__head" style={{ marginBottom: 0, alignItems: "start" }}>
          <div>
            <span className="eyebrow eyebrow--brass">The Archivist</span>
            <h2 className="h1 mt-2">
              Perfect recall.
              <br />
              <em>No imagination.</em>
            </h2>
          </div>
          <div>
            <p className="lede">
              The Archivist is not a chatbot with opinions. It is a research librarian bound to your shelves: it reads
              before it speaks, and it shows you where it read.
            </p>
            <dl className="kv mt-4" style={{ gridTemplateColumns: "180px minmax(0,1fr)" }}>
              <dt>Source</dt>
              <dd>Your library, and nothing else</dd>
              <dt>Citation</dt>
              <dd>Sentence-level, with section and page</dd>
              <dt>Verification</dt>
              <dd>Every quotation checked against the text; anything unverifiable is flagged</dd>
              <dt>Candour</dt>
              <dd>When your library holds no answer, it says so</dd>
              <dt>Deep research</dt>
              <dd>Compares authors across documents and traces ideas between them</dd>
            </dl>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap band__head" style={{ marginBottom: 0, alignItems: "start" }}>
          <div>
            <span className="eyebrow">Principles</span>
            <h2 className="h1 mt-2">Built on three refusals.</h2>
          </div>
          <ol className="refusals" role="list">
            <li>
              <h3>It will not show your library to anyone.</h3>
              <p>Documents are visible to your account alone — never shared, listed or published.</p>
            </li>
            <li>
              <h3>It will not answer without evidence.</h3>
              <p>Every claim the Archivist makes leads back to a sentence you own. An answer you cannot check is a rumour.</p>
            </li>
            <li>
              <h3>It will not compete for your attention.</h3>
              <p>No feeds, no streaks, no noise. An instrument for the long work of understanding.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="wrap closing">
        <h2 className="display">
          Begin with <em>one book.</em>
        </h2>
        <p className="lede mt-3" style={{ maxWidth: "34rem", marginInline: "auto" }}>
          A free membership holds {LIBRARY_LIMITS.member} documents and {ARCHIVIST_LIMITS.member} questions a day. The
          Fellowship removes every limit.
        </p>
        <div className="row mt-4" style={{ justifyContent: "center", ["--gap" as string]: "20px" }}>
          <Link href="/sign-up" className="btn btn--primary btn--lg">
            Open your library
          </Link>
          <Link href="/membership" className="link">
            Compare memberships
          </Link>
        </div>
      </section>
    </>
  );
}
