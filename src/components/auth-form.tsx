"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/library";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    setPending(true);
    setError(null);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) {
      setError(
        error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "That email and password do not match our records."
          : (error.message ?? "Something went wrong. Please try again."),
      );
      return;
    }
    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ ["--stack" as string]: "18px" }} noValidate={false}>
      {mode === "sign-up" ? (
        <div className="field">
          <label htmlFor="name" className="label">
            Name
          </label>
          <input id="name" name="name" className="input" autoComplete="name" maxLength={80} />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "sign-up" ? 10 : undefined}
          className="input"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        />
        {mode === "sign-up" ? <span className="hint">At least 10 characters.</span> : null}
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn--primary btn--lg btn--block mt-2" type="submit" disabled={pending}>
        {pending ? "One moment…" : mode === "sign-up" ? "Open your library" : "Sign in"}
      </button>
      <p className="muted small" style={{ textAlign: "center" }}>
        {mode === "sign-up" ? (
          <>
            Already a member? <Link href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link>
          </>
        ) : (
          <>
            New to Athenaeum? <Link href={`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Open a library</Link>
          </>
        )}
      </p>
    </form>
  );
}
