import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOut } from "@/components/sign-out";
import { getQuota, VISITOR_COOKIE } from "@/lib/archivist/quota";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/sign-in?next=/account");
  const quota = await getQuota(viewer, (await cookies()).get(VISITOR_COOKIE)?.value ?? null);
  return (
    <div className="wrap narrow">
      <header className="page-head">
        <span className="label">Reader record</span>
        <h1 className="title-xl mt-1">{viewer.user.name}</h1>
        <p className="meta mt-1">{viewer.user.email}</p>
      </header>
      <dl className="biblio">
        <dt>Standing</dt>
        <dd>
          {viewer.plan === "inner" ? (
            <span className="stamp stamp--solid">Inner Archive</span>
          ) : (
            <>
              Reader · <Link href="/membership">join the Inner Archive</Link>
            </>
          )}
        </dd>
        <dt>Archivist</dt>
        <dd>{quota.limit === null ? "Unlimited questions" : `${quota.remaining} of ${quota.limit} questions left today`}</dd>
        <dt>Library</dt>
        <dd>
          <Link href="/library">Saved records and passages →</Link>
        </dd>
      </dl>
      <div className="mt-4">
        <SignOut />
      </div>
    </div>
  );
}
