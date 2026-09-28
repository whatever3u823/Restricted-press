"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleSavedWork, type ActionResult } from "@/app/actions";

export function SaveRecord({ workId, initiallySaved }: { workId: number; initiallySaved: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [problem, setProblem] = useState<Extract<ActionResult, { ok: false }> | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="stack" style={{ ["--stack" as string]: "8px" }}>
      <button
        type="button"
        className="btn btn--ghost"
        style={{ width: "100%" }}
        aria-pressed={saved}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleSavedWork(workId);
            if (r.ok) {
              setSaved(r.saved);
              setProblem(null);
            } else setProblem(r);
          })
        }
      >
        {saved ? "✓ In your library" : "Add to your library"}
      </button>
      {problem ? (
        <p className="meta" role="status">
          {problem.message}{" "}
          {problem.reason === "signin" ? (
            <Link href="/sign-in">Sign in →</Link>
          ) : problem.reason === "gate" ? (
            <Link href="/membership">Inner Archive →</Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
