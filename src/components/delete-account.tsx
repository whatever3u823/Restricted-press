"use client";

import { useRef, useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions";
import { authClient } from "@/lib/auth-client";

export function DeleteAccount() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = value.trim().toLowerCase() === "delete my library";

  return (
    <>
      <button type="button" className="btn btn--sm btn--danger" onClick={() => dialog.current?.showModal()}>
        Delete account
      </button>
      <dialog ref={dialog} className="dialog" aria-label="Delete your account">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await deleteAccount(value);
              if (!r.ok) {
                setError(r.message);
                return;
              }
              await authClient.signOut().catch(() => {});
              window.location.assign("/");
            });
          }}
        >
          <div className="dialog__body stack" style={{ ["--stack" as string]: "16px" }}>
            <h2 className="h2">Delete your account?</h2>
            <p className="muted">
              Every document, highlight, note, collection and question in your library is deleted immediately. This cannot
              be undone.
            </p>
            <div className="field">
              <label className="label" htmlFor="del-confirm">
                Type “delete my library” to confirm
              </label>
              <input id="del-confirm" className="input" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" aria-invalid={error ? true : undefined} />
            </div>
            {error ? <p className="error-text">{error}</p> : null}
          </div>
          <div className="dialog__foot">
            <button type="button" className="btn btn--quiet" onClick={() => dialog.current?.close()}>
              Keep my library
            </button>
            <button type="submit" className="btn btn--danger" disabled={!ready || pending}>
              {pending ? "Deleting…" : "Delete everything"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
