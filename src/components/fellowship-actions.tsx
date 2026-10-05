"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { endPreviewFellowship, grantPreviewFellowship } from "@/app/actions";

export function FellowshipActions({
  signedIn,
  plan,
  preview,
  priceLabel,
}: {
  signedIn: boolean;
  plan: "member" | "fellow";
  preview: boolean;
  priceLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link href="/sign-up?next=/membership" className="btn btn--brass btn--block">
        Open a library to join
      </Link>
    );
  }
  if (plan === "fellow") {
    return (
      <div className="stack" style={{ ["--stack" as string]: "12px" }}>
        <p className="eyebrow eyebrow--brass">● Your Fellowship is active</p>
        {preview ? (
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await endPreviewFellowship();
                router.refresh();
              })
            }
          >
            End preview Fellowship
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="stack" style={{ ["--stack" as string]: "10px" }}>
      {preview ? (
        <>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await grantPreviewFellowship();
                if (!r.ok) setError(r.message);
                else router.refresh();
              })
            }
          >
            {pending ? "One moment…" : "Become a Fellow — preview"}
          </button>
          <p className="hint">
            Payments are not yet connected. This preview grants the Fellowship without charge; the price shown ({priceLabel}) is
            indicative.
          </p>
        </>
      ) : (
        <p className="notice">
          <strong>The Fellowship opens soon.</strong> Checkout is not yet available.
        </p>
      )}
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
