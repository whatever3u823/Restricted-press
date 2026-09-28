import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { NavLinks } from "./nav-links";
import { Seal } from "./seal";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Link href="/" className="wordmark" aria-label="Restricted Press — home">
          <Seal className="wordmark__seal" />
          <span>Restricted Press</span>
        </Link>
        <NavLinks
          account={
            viewer.user
              ? { label: viewer.plan === "inner" ? "Inner Archive" : "Account", href: "/account" }
              : { label: "Sign in", href: "/sign-in" }
          }
        />
      </div>
    </header>
  );
}
