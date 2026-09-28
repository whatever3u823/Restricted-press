"use client";

import { useState, useTransition } from "react";
import { fileRequest } from "@/app/actions";

/** File a request with the archive. Used for titles and for edition interest. */
export function RequestForm({
  kind,
  workId,
  presetTitle,
  signedInEmail,
  submitLabel,
}: {
  kind: "title" | "edition";
  workId?: number;
  presetTitle?: string;
  signedInEmail?: string | null;
  submitLabel: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  if (reference) {
    return (
      <div className="frame" role="status">
        <span className="label label--red">Request filed</span>
        <p className="request-no mt-2">{reference}</p>
        <p className="meta mt-2">
          {kind === "title"
            ? "Your request has been entered in the accession register. Titles are assessed for provenance and rights before they are accessioned."
            : "Your interest in this edition has been recorded. You will be contacted when copies are issued."}
          {signedInEmail ? "" : " Keep the reference above for your records."}
        </p>
      </div>
    );
  }

  return (
    <form
      className="stack"
      style={{ ["--stack" as string]: "18px" }}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await fileRequest({
            kind,
            workId,
            title: String(f.get("title") ?? presetTitle ?? ""),
            author: String(f.get("author") ?? ""),
            notes: String(f.get("notes") ?? ""),
            email: String(f.get("email") ?? signedInEmail ?? ""),
          });
          if (r.ok) setReference(r.reference);
          else setError(r.message);
        });
      }}
    >
      {kind === "title" ? (
        <>
          <div className="field">
            <label className="label label--ink" htmlFor="rq-title">
              Title requested
            </label>
            <input id="rq-title" name="title" className="input" required maxLength={300} placeholder="e.g. The Book of Black Magic and of Pacts" />
          </div>
          <div className="field">
            <label className="label label--ink" htmlFor="rq-author">
              Author, editor or translator
            </label>
            <input id="rq-author" name="author" className="input" maxLength={200} placeholder="If known" />
          </div>
          <div className="field">
            <label className="label label--ink" htmlFor="rq-notes">
              Edition, date or reason for request
            </label>
            <textarea id="rq-notes" name="notes" className="textarea" rows={4} maxLength={2000} placeholder="Any detail that helps identify the edition" />
          </div>
        </>
      ) : (
        <input type="hidden" name="title" value={presetTitle ?? ""} />
      )}
      {signedInEmail ? (
        <p className="meta">
          Correspondence to <span className="mono">{signedInEmail}</span>
        </p>
      ) : (
        <div className="field">
          <label className="label label--ink" htmlFor="rq-email">
            Email for correspondence
          </label>
          <input id="rq-email" name="email" type="email" className="input" maxLength={200} placeholder="Optional" />
        </div>
      )}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn--accent" type="submit" disabled={pending}>
        {pending ? "Filing…" : submitLabel}
      </button>
    </form>
  );
}
