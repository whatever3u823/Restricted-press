import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page() {
  const viewer = await getViewer();
  if (viewer.user) redirect("/library");
  return (
    <div className="auth">
      <div className="auth__card rise">
        <span className="eyebrow eyebrow--rule">Return to the library</span>
        <h1 className="h1">Welcome back.</h1>
        <p className="muted mt-2" style={{ marginBottom: 32 }}>
          Your shelves are as you left them.
        </p>
        <Suspense>
          <AuthForm mode="sign-in" />
        </Suspense>
      </div>
    </div>
  );
}
