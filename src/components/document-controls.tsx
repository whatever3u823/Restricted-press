"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createCollection, deleteDocument, toggleInCollection, updateDocument } from "@/app/actions";
import type { DocumentKind, ReadingStatus } from "@/db/schema";
import { CheckIcon, EditIcon, FolderIcon, PlusIcon, TrashIcon } from "./icons";

export function StatusSwitch({ id, status }: { id: number; status: ReadingStatus }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [, start] = useTransition();
  const set = (s: ReadingStatus) => {
    setValue(s);
    start(async () => {
      await updateDocument(id, { readingStatus: s });
      router.refresh();
    });
  };
  return (
    <div className="seg" role="group" aria-label="Reading status">
      {(["unread", "reading", "finished"] as const).map((s) => (
        <button key={s} type="button" aria-pressed={value === s} onClick={() => set(s)}>
          {s === "unread" ? "Unread" : s === "reading" ? "Reading" : "Finished"}
        </button>
      ))}
    </div>
  );
}

export function CollectionsMenu({
  id,
  all,
  member,
}: {
  id: number;
  all: { id: number; name: string }[];
  member: number[];
}) {
  const router = useRouter();
  const [inside, setInside] = useState(new Set(member));
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDetailsElement>(null);

  return (
    <details className="menu" ref={ref}>
      <summary className="btn btn--sm">
        <FolderIcon className="" />
        {inside.size ? `In ${inside.size} collection${inside.size === 1 ? "" : "s"}` : "Add to collection"}
      </summary>
      <div className="menu__pop">
        {all.map((c) => (
          <button
            key={c.id}
            type="button"
            className="menu__item"
            onClick={() =>
              start(async () => {
                const r = await toggleInCollection(c.id, id);
                if (r.ok) {
                  setInside((s) => {
                    const n = new Set(s);
                    if (r.member) n.add(c.id);
                    else n.delete(c.id);
                    return n;
                  });
                  router.refresh();
                }
              })
            }
          >
            <span className="check">{inside.has(c.id) ? <CheckIcon /> : null}</span>
            {c.name}
          </button>
        ))}
        {all.length ? <div className="menu__sep" /> : null}
        <form
          className="row"
          style={{ ["--gap" as string]: "6px", padding: 4 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            start(async () => {
              const r = await createCollection(name, id);
              if (r.ok) {
                setInside((s) => new Set(s).add(r.id));
                setName("");
                router.refresh();
              }
            });
          }}
        >
          <input className="input grow" style={{ padding: "6px 9px", fontSize: 13 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection" aria-label="New collection name" maxLength={80} />
          <button className="icon-btn" type="submit" disabled={pending || !name.trim()} aria-label="Create collection">
            <PlusIcon />
          </button>
        </form>
      </div>
    </details>
  );
}

type Details = { title: string; author: string | null; year: number | null; kind: DocumentKind };

export function EditDetails({ id, initial }: { id: number; initial: Details }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <button type="button" className="btn btn--sm btn--quiet" onClick={() => dialog.current?.showModal()}>
        <EditIcon className="" />
        Edit details
      </button>
      <dialog ref={dialog} className="dialog" aria-label="Edit document details">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const year = String(f.get("year") ?? "").trim();
            start(async () => {
              const r = await updateDocument(id, {
                title: String(f.get("title") ?? ""),
                author: String(f.get("author") ?? "") || null,
                year: year ? Number(year) : null,
                kind: f.get("kind") as DocumentKind,
              });
              if (r.ok) {
                dialog.current?.close();
                router.refresh();
              } else setError(r.message);
            });
          }}
        >
          <div className="dialog__body stack" style={{ ["--stack" as string]: "18px" }}>
            <h2 className="h2">Document details</h2>
            <div className="field">
              <label className="label" htmlFor="ed-title">
                Title
              </label>
              <input id="ed-title" name="title" className="input" defaultValue={initial.title} required maxLength={300} />
            </div>
            <div className="field">
              <label className="label" htmlFor="ed-author">
                Author
              </label>
              <input id="ed-author" name="author" className="input" defaultValue={initial.author ?? ""} maxLength={300} placeholder="Separate several authors with semicolons" />
            </div>
            <div className="row" style={{ ["--gap" as string]: "14px", alignItems: "flex-start" }}>
              <div className="field" style={{ width: 120 }}>
                <label className="label" htmlFor="ed-year">
                  Year
                </label>
                <input id="ed-year" name="year" className="input" inputMode="numeric" pattern="-?[0-9]{1,4}" defaultValue={initial.year ?? ""} />
              </div>
              <div className="field grow">
                <label className="label" htmlFor="ed-kind">
                  Kind
                </label>
                <select id="ed-kind" name="kind" className="select" defaultValue={initial.kind}>
                  <option value="book">Book</option>
                  <option value="paper">Paper</option>
                  <option value="article">Article</option>
                  <option value="notes">Notes</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            {error ? <p className="error-text">{error}</p> : null}
          </div>
          <div className="dialog__foot">
            <button type="button" className="btn btn--quiet" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={pending}>
              Save
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function DeleteDocument({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn--sm btn--quiet"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Remove “${title}” from your library? Its highlights and notes will be deleted too.`)) return;
        start(async () => {
          await deleteDocument(id);
          router.push("/library");
          router.refresh();
        });
      }}
    >
      <TrashIcon className="" />
      Remove
    </button>
  );
}

export function NotesEditor({ id, initial }: { id: number; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const saved = useRef(initial ?? "");
  const save = async () => {
    if (value === saved.current) return;
    setState("saving");
    const r = await updateDocument(id, { notes: value });
    if (r.ok) {
      saved.current = value;
      setState("saved");
    } else setState("idle");
  };
  return (
    <div>
      <textarea
        className="textarea"
        rows={6}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        placeholder="Your own notes on this document — kept with it, private to you."
        maxLength={20000}
        aria-label="Your notes"
        style={{ fontFamily: "var(--serif)", fontSize: "1.05rem" }}
      />
      <p className="hint mt-1">{state === "saving" ? "Saving…" : state === "saved" ? "Saved." : "Saved when you click away."}</p>
    </div>
  );
}
