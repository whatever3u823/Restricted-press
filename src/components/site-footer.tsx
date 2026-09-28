import Link from "next/link";
import { Seal } from "./seal";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__grid">
        <div>
          <div className="wordmark">
            <Seal className="wordmark__seal" />
            <span className="wordmark__name">Restricted Press</span>
          </div>
          <p className="mt-2" style={{ maxWidth: "38ch", fontFamily: "var(--serif)", fontSize: "1.1rem", color: "var(--ink-2)" }}>
            An archive of forgotten and restricted texts, preserved as printed and made available again.
          </p>
          <p className="mt-2" style={{ maxWidth: "44ch", fontSize: 13 }}>
            Rights notes on each file are preliminary curatorial research, not legal advice.
          </p>
        </div>
        <div>
          <span className="label label--red">01 · Archive</span>
          <ul>
            <li><Link href="/archive">Catalogue</Link></li>
            <li><Link href="/collections">Collections</Link></li>
            <li><Link href="/archive?tab=passages">Passage search</Link></li>
            <li><Link href="/authors">Authors</Link></li>
          </ul>
        </div>
        <div>
          <span className="label label--red">02 · Instruments</span>
          <ul>
            <li><Link href="/archivist">The Archivist</Link></li>
            <li><Link href="/request">Request a title</Link></li>
            <li><Link href="/library">Your library</Link></li>
          </ul>
        </div>
        <div>
          <span className="label label--red">03 · Institution</span>
          <ul>
            <li><Link href="/editions">Restricted Editions</Link></li>
            <li><Link href="/membership">Access levels</Link></li>
            <li><Link href="/about">About the Press</Link></li>
            <li><Link href="/about#provenance">Provenance &amp; rights</Link></li>
          </ul>
        </div>
      </div>
      <div className="wrap">
        <div className="site-footer__base">
          <span>Restricted Press · The Archive</span>
          <span>Texts preserved as printed · nothing silently modernised</span>
        </div>
      </div>
    </footer>
  );
}
