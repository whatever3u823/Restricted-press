import Link from "next/link";
import { SITE } from "@/lib/config";
import { Seal } from "./seal";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__grid">
        <div>
          <div className="wordmark" style={{ color: "var(--ink)" }}>
            <Seal className="wordmark__seal" />
            <span>Restricted Press</span>
          </div>
          <p className="mt-2" style={{ maxWidth: "38ch" }}>
            {SITE.tagline} An independent archive of historical texts. Rights notes on each record are preliminary
            research, not legal advice.
          </p>
        </div>
        <div>
          <span className="label">Archive</span>
          <ul>
            <li><Link href="/archive">Browse records</Link></li>
            <li><Link href="/archive?tab=passages">Search passages</Link></li>
            <li><Link href="/authors">Authors</Link></li>
            <li><Link href="/archivist">The Archivist</Link></li>
          </ul>
        </div>
        <div>
          <span className="label">Membership</span>
          <ul>
            <li><Link href="/membership">Inner Archive</Link></li>
            <li><Link href="/editions">Restricted Editions</Link></li>
            <li><Link href="/library">Your library</Link></li>
          </ul>
        </div>
        <div>
          <span className="label">Institution</span>
          <ul>
            <li><Link href="/about">About the archive</Link></li>
            <li><Link href="/about#provenance">Provenance &amp; rights</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
