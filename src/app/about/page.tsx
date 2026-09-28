import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About the archive" };

export default function AboutPage() {
  return (
    <div className="wrap narrow">
      <header className="page-head">
        <span className="file-no">Institution · Charter</span>
        <h1 className="title-xl mt-2">An institution that happens to possess texts most people have forgotten exist.</h1>
      </header>
      <div className="prose stack" style={{ ["--stack" as string]: "1em" }}>
        <p>
          Restricted Press keeps a curated archive of obscure, forgotten and historically significant texts — beginning
          with the literature of magic, witchcraft, alchemy, esotericism and mysticism — and makes them useful: read in
          full, catalogued as records, connected to one another, and open to questioning.
        </p>
      </div>

      <section className="mt-6" id="provenance">
        <div className="section-head">
          <h2>Provenance &amp; rights</h2>
        </div>
        <ol className="numbered mt-2">
          <li>
            <div>
              <strong>Nothing is assumed.</strong>
              <p className="meta mt-1">
                An old book is not automatically in the public domain. The underlying work, a translation, an introduction,
                illustrations, annotations and the edition itself can each have a different status, so each is recorded
                separately with its basis and a confidence level.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Uncertain records are held, not hidden.</strong>
              <p className="meta mt-1">
                A record whose rights are unresolved stays in the catalogue — discoverable, its provenance inspectable — with
                its text withheld until review clears it.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Every source is named.</strong>
              <p className="meta mt-1">
                Each dossier records where its text came from, when it was retrieved, a checksum of the source file, the
                transcribers’ own notes, and what the archive changed (provider notices removed; nothing else).
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Dates say how they are known.</strong>
              <p className="meta mt-1">
                A date read from a title page is marked as such; a date supplied by the curators is marked “c.” and
                “unverified” until checked.
              </p>
            </div>
          </li>
        </ol>
        <p className="notice mt-3">
          Rights notes are preliminary curatorial research, not legal advice. Current records are assessed for the United
          States unless stated otherwise.
        </p>
      </section>

      <section className="mt-6" id="archivist">
        <div className="section-head">
          <h2>The Archivist’s principles</h2>
        </div>
        <ol className="numbered mt-2">
          <li><div><strong>Answers come from the archive.</strong><p className="meta mt-1">The Archivist retrieves passages first and answers only from them.</p></div></li>
          <li><div><strong>Quotations are archive text.</strong><p className="meta mt-1">Cited sentences are taken from the passages themselves; quotations in the answer are checked against the archive and flagged if they cannot be found.</p></div></li>
          <li><div><strong>Evidence and inference are kept apart.</strong><p className="meta mt-1">Context from outside the archive is labelled as such.</p></div></li>
          <li><div><strong>Silence is reported.</strong><p className="meta mt-1">When the archive cannot answer, the Archivist says so.</p></div></li>
          <li><div><strong>The original is preserved.</strong><p className="meta mt-1">Texts are never silently modernised.</p></div></li>
        </ol>
      </section>

      <section className="mt-6">
        <div className="section-head">
          <h2>Editorial status</h2>
        </div>
        <p className="prose mt-2">
          Summaries, historical context and biographical notes marked “Curatorial draft” were written for this first
          edition of the archive and are awaiting editorial review. The texts themselves are transcriptions of printed
          editions, as recorded on each dossier.
        </p>
        <p className="mt-3">
          <Link href="/archive" className="link-arrow">
            Enter the Archive →
          </Link>
        </p>
      </section>
    </div>
  );
}
