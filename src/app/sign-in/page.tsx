import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { Seal } from "@/components/seal";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page() {
  const viewer = await getViewer();
  if (viewer.user) redirect("/account");
  return (
    <div className="wrap" style={{ padding: "64px var(--gutter)" }}>
      <div className="auth-card">
        <div className="spread">
          <span className="label label--ink">Reader registration</span>
          <Seal className="wordmark__seal" />
        </div>
        <h1 className="title-l mt-3">Return to the archive.</h1>
        <p className="meta mt-1" style={{ marginBottom: 24 }}>
          Sign in to continue your research.
        </p>
        <Suspense>
          <AuthForm mode="sign-in" />
        </Suspense>
      </div>
    </div>
  );
}
