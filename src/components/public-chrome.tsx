import Link from "next/link";
import { Wordmark } from "./brand";

export function PublicHeader() {
  return (
    <header className="public-head">
      <div className="public-head__inner">
        <Wordmark />
        <nav aria-label="Site">
          <Link href="/#method" className="hide-sm">
            Method
          </Link>
          <Link href="/membership" className="hide-sm">
            Membership
          </Link>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className="btn btn--sm btn--primary">
            Open your library
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-foot">
      <div className="public-foot__inner">
        <span>© {new Date().getFullYear()} Athenaeum. A private library for serious readers.</span>
        <span className="row" style={{ ["--gap" as string]: "20px" }}>
          <Link href="/membership">Membership</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/sign-in">Sign in</Link>
        </span>
      </div>
    </footer>
  );
}
