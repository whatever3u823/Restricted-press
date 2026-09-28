import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { Seal } from "@/components/seal";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Create an account" };

export default async function Page() {
  const viewer = await getViewer();
  if (viewer.user) redirect("/account");
  return (
    <div className="wrap" style={{ padding: "64px var(--gutter)" }}>
      <div className="auth-card">
        <div className="spread">
          <span className="file-no">Access control · Form R-1</span>
          <Seal className="wordmark__seal" />
        </div>
        <h1 className="title-l mt-3">Register as a reader.</h1>
        <p className="meta mt-1" style={{ marginBottom: 24 }}>
          A free account gives you more questions for the Archivist each day, and is the first step to the Inner Archive.
        </p>
        <Suspense>
          <AuthForm mode="sign-up" />
        </Suspense>
      </div>
    </div>
  );
}
