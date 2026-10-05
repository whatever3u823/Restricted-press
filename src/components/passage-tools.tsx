"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toggleHighlight } from "@/app/actions";
import { AskIcon, HighlightIcon, NoteIcon } from "./icons";

/** Mark, annotate, or ask the Archivist about one passage. */
export function PassageTools({
  documentId,
  passageId,
  marked: initialMarked,
  note: initialNote,
}: {
  documentId: number;
  passageId: string;
  marked: boolean;
  note: string | null;
}) {
  const [marked, setMarked] = useState(initialMarked);
  const [note, setNote] = useState(initialNote);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLSpanElement>(null);

  // Reflect the mark on the passage itself.
  useEffect(() => {
    const p = ref.current?.closest(".psg") as HTMLElement | null;
    if (p) p.dataset.marked = marked ? "true" : "";
  }, [marked]);

  // On touch screens, tapping a passage reveals its tools.
  useEffect(() => {
    const p = ref.current?.closest(".psg") as HTMLElement | null;
    if (!p) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("button, a, textarea")) return;
      if (window.getSelection()?.toString()) return;
      if (window.matchMedia("(max-width: 920px)").matches) p.dataset.open = p.dataset.open === "true" ? "" : "true";
    };
    p.addEventListener("click", onClick);
    return () => p.removeEventListener("click", onClick);
  }, []);

  const mark = () =>
    start(async () => {
      const r = await toggleHighlight(passageId);
      if (r.ok) {
        setMarked(r.marked);
        if (!r.marked) setNote(null);
        setError(null);
      } else setError(r.message);
    });

  const saveNote = () =>
    start(async () => {
      const r = await toggleHighlight(passageId, draft);
      if (r.ok) {
        setMarked(true);
        setNote(draft.trim() || null);
        setEditing(false);
        setError(null);
      } else setError(r.message);
    });

  return (
    <>
      <span className="psg__tools" ref={ref}>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={marked}
          aria-label={marked ? "Remove highlight" : "Highlight passage"}
          title={marked ? "Remove highlight" : "Highlight"}
          onClick={mark}
          disabled={pending}
        >
          <HighlightIcon />
        </button>
        <button type="button" className="icon-btn" aria-label="Add a note" title="Note" onClick={() => setEditing((e) => !e)}>
          <NoteIcon />
        </button>
        <Link className="icon-btn" href={`/archivist?doc=${documentId}&passage=${passageId}`} aria-label="Ask the Archivist about this passage" title="Ask the Archivist">
          <AskIcon />
        </Link>
      </span>
      {editing ? (
        <span className="psg__note" style={{ display: "block" }}>
          <textarea
            className="textarea"
            rows={3}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="A note on this passage"
            aria-label="Note on this passage"
            maxLength={4000}
            style={{ fontSize: 14 }}
          />
          <span className="row mt-1" style={{ ["--gap" as string]: "6px" }}>
            <button type="button" className="btn btn--sm btn--primary" onClick={saveNote} disabled={pending}>
              Save note
            </button>
            <button type="button" className="btn btn--sm btn--quiet" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </span>
        </span>
      ) : note ? (
        <span className="psg__note">{note}</span>
      ) : null}
      {error ? (
        <span className="psg__note" role="status" style={{ display: "block", borderLeftColor: "var(--signal)" }}>
          {error}
        </span>
      ) : null}
    </>
  );
}
