import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount } from "@/components/delete-account";
import { SignOut } from "@/components/sign-out";
import { getQuota } from "@/lib/archivist/quota";
import { LIBRARY_LIMITS } from "@/lib/config";
import { libraryStats } from "@/lib/library";
import { requireReader } from "@/lib/viewer";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await requireReader("/account");
  const [quota, stats] = await Promise.all([getQuota(viewer.user.id, viewer.plan), libraryStats(viewer.user.id)]);
  const fellow = viewer.plan === "fellow";

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <header className="page-head">
        <div className="page-head__text">
          <span className="eyebrow eyebrow--rule">Account</span>
          <h1 className="h1">{viewer.user.name}</h1>
          <p className="page-head__sub">{viewer.user.email}</p>
        </div>
        <SignOut />
      </header>

      <dl className="readout" style={{ ["--cols" as string]: 4 }}>
        <div>
          <dt>Membership</dt>
          <dd className={fellow ? "brass" : undefined}>{fellow ? "Fellow" : "Member"}</dd>
        </div>
        <div>
          <dt>Documents</dt>
          <dd>
            {stats.documents}
            {fellow ? null : <span className="dim"> / {LIBRARY_LIMITS.member}</span>}
          </dd>
        </div>
        <div>
          <dt>Questions today</dt>
          <dd>{quota.limit === null ? "Unlimited" : `${quota.remaining} left`}</dd>
        </div>
        <div>
          <dt>Asked in all</dt>
          <dd>{stats.questions}</dd>
        </div>
      </dl>

      <section className="mt-5">
        <div className="block__head">
          <h2>Your reading</h2>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: "200px minmax(0,1fr)" }}>
          <dt>Words held</dt>
          <dd className="num">{stats.words.toLocaleString("en-US")}</dd>
          <dt>Reading now</dt>
          <dd>{stats.reading}</dd>
          <dt>Finished</dt>
          <dd>{stats.finished}</dd>
          <dt>Highlights</dt>
          <dd>
            {stats.highlights} · <Link href="/highlights" className="link">view</Link>
          </dd>
        </dl>
      </section>

      <section className="mt-5">
        <div className="block__head">
          <h2>Membership</h2>
        </div>
        <p className="muted">
          {fellow
            ? "Your Fellowship is active: an unlimited library, unlimited questions and deep research."
            : "The Fellowship removes the document and question limits and adds deep research across authors."}{" "}
          <Link href="/membership" className="link">
            {fellow ? "Manage" : "See the Fellowship"}
          </Link>
        </p>
      </section>

      <section className="danger">
        <div className="spread">
          <div>
            <h2>Delete account</h2>
            <p className="muted small mt-1" style={{ maxWidth: "52ch" }}>
              Removes your library and everything in it, immediately. See{" "}
              <Link href="/privacy" className="link">
                what Athenaeum keeps
              </Link>
              .
            </p>
          </div>
          <DeleteAccount />
        </div>
      </section>
    </div>
  );
}
