import Link from "next/link";
import { SITE } from "@/lib/config";
import { Seal } from "./seal";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__grid">
        <div>
          <Seal className="footer-seal" lettered />
          <div className="wordmark mt-3" style={{ color: "#ece5d4" }}>
            <span>Restricted Press</span>
          </div>
          <p className="mt-2" style={{ maxWidth: "38ch", fontFamily: "var(--fell)", fontStyle: "italic", fontSize: "1.05rem", color: "#c3baa7" }}>
            {SITE.tagline}
          </p>
          <p className="mt-2" style={{ maxWidth: "40ch", fontSize: 13 }}>
            An independent archive of historical texts. Rights notes on each record are preliminary research, not
            legal advice.
          </p>
        </div>
        <div>
          <span className="label" style={{ color: "#c4a468" }}>Archive</span>
          <ul>
            <li><Link href="/archive">Browse records</Link></li>
            <li><Link href="/archive?tab=passages">Search passages</Link></li>
            <li><Link href="/authors">Authors</Link></li>
            <li><Link href="/archivist">The Archivist</Link></li>
          </ul>
        </div>
        <div>
          <span className="label" style={{ color: "#c4a468" }}>Membership</span>
          <ul>
            <li><Link href="/membership">Inner Archive</Link></li>
            <li><Link href="/editions">Restricted Editions</Link></li>
            <li><Link href="/library">Your library</Link></li>
          </ul>
        </div>
        <div>
          <span className="label" style={{ color: "#c4a468" }}>Institution</span>
          <ul>
            <li><Link href="/about">About the archive</Link></li>
            <li><Link href="/about#provenance">Provenance &amp; rights</Link></li>
            <li><Link href="/about#plates">Plates &amp; sources</Link></li>
          </ul>
        </div>
      </div>
      <div className="wrap mt-6">
        <p className="class-mark" style={{ color: "#6f675a", borderTop: "1px solid #37322a", paddingTop: 16 }}>
          RP · ACCESSION REGISTER · TEXTS PRESERVED AS PRINTED · NOTHING SILENTLY MODERNISED
        </p>
      </div>
    </footer>
  );
}
