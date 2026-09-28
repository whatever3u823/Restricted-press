import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { NavLinks } from "./nav-links";
import { Seal } from "./seal";

export async function SiteHeader() {
  const viewer = await getViewer();
  const access = viewer.plan === "inner" ? "Inner Archive" : viewer.user ? "Public Access · Reader" : "Public Access";
  return (
    <>
      <div className="strip" role="note">
        <div className="wrap strip__inner">
          <span>
            <b>Restricted Press</b> · Archive of forgotten texts
          </span>
          <span className="strip__right">Access level: {access}</span>
        </div>
      </div>
      <header className="site-header">
        <div className="wrap site-header__inner">
          <Link href="/" className="wordmark" aria-label="Restricted Press — home">
            <Seal className="wordmark__seal" />
            <span className="wordmark__name">Restricted Press</span>
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
    </>
  );
}
