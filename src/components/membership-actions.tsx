"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelDevMembership, grantDevMembership } from "@/app/actions";

export function MembershipActions({
  plan,
  devUpgrade,
  priceLabel,
}: {
  plan: "visitor" | "reader" | "inner";
  devUpgrade: boolean;
  priceLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (plan === "visitor") {
    return (
      <div className="row">
        <Link href="/sign-up?next=/membership" className="btn btn--accent">
          Create an account to join
        </Link>
        <Link href="/sign-in?next=/membership" className="link-arrow">
          I have an account →
        </Link>
      </div>
    );
  }

  if (plan === "inner") {
    return (
      <div className="stack" style={{ ["--stack" as string]: "12px" }}>
        <p>
          <span className="stamp stamp--solid">Inner Archive · active</span>
        </p>
        {devUpgrade ? (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await cancelDevMembership();
                router.refresh();
              })
            }
          >
            End preview membership
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="stack" style={{ ["--stack" as string]: "10px" }}>
      {devUpgrade ? (
        <>
          <button
            type="button"
            className="btn btn--accent"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await grantDevMembership();
                if (!r.ok) setError(r.message);
                else router.refresh();
              })
            }
          >
            {pending ? "Opening the Inner Archive…" : "Join the Inner Archive — preview"}
          </button>
          <p className="meta">
            Payments are not yet connected. This preview grants membership without charge so the Inner Archive can be
            evaluated; the price shown ({priceLabel}) is indicative.
          </p>
        </>
      ) : (
        <p className="notice">
          <strong>Membership opens soon.</strong> Checkout is not yet available on this installation.
        </p>
      )}
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
