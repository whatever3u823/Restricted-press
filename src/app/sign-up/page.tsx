import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { Mark } from "@/components/brand";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Open your library" };

export default async function Page() {
  const viewer = await getViewer();
  if (viewer.user) redirect("/library");
  return (
    <div className="auth">
      <aside className="auth__aside" aria-hidden="true">
        <Mark className="auth__mark" />
        <p className="auth__line">
          Everything you have read.
          <br />
          <em>Nothing you have forgotten.</em>
        </p>
        <span className="eyebrow">Athenaeum · Private library</span>
      </aside>
      <div className="auth__card rise">
        <span className="eyebrow eyebrow--rule">New membership</span>
        <h1 className="h1">Open your library.</h1>
        <p className="muted mt-2" style={{ marginBottom: 32 }}>
          A private library, free to begin. No card required.
        </p>
        <Suspense>
          <AuthForm mode="sign-up" />
        </Suspense>
      </div>
    </div>
  );
}
