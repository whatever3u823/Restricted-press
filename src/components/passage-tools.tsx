"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleSavedPassage } from "@/app/actions";

const BookmarkIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M4 2.5h8v11l-4-3-4 3z" />
  </svg>
);
const AskIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14" />
  </svg>
);

export function PassageTools({ passageId, slug, saved: initial }: { passageId: string; slug: string; saved: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [message, setMessage] = useState<{ text: string; href?: string; cta?: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <span className="passage__tools">
      <button
        type="button"
        className="icon-btn"
        aria-pressed={saved}
        aria-label={saved ? `Remove saved passage ${passageId}` : `Save passage ${passageId}`}
        title={saved ? "Saved — click to remove" : "Save passage"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleSavedPassage(passageId);
            if (r.ok) {
              setSaved(r.saved);
              setMessage(null);
            } else {
              setMessage({
                text: r.message,
                href: r.reason === "signin" ? "/sign-in" : r.reason === "gate" ? "/membership" : undefined,
                cta: r.reason === "signin" ? "Sign in" : "Inner Archive",
              });
            }
          })
        }
      >
        <BookmarkIcon />
      </button>
      <Link
        className="icon-btn"
        href={`/archivist?scope=${slug}&passage=${passageId}`}
        aria-label={`Ask the Archivist about passage ${passageId}`}
        title="Ask the Archivist about this passage"
      >
        <AskIcon />
      </Link>
      {message ? (
        <span
          role="status"
          style={{
            position: "absolute",
            right: 40,
            top: 0,
            width: 220,
            background: "var(--paper)",
            border: "1px solid var(--rule-strong)",
            padding: "8px 10px",
            fontFamily: "var(--sans)",
            fontSize: 13,
            lineHeight: 1.4,
            zIndex: 5,
          }}
        >
          {message.text} {message.href ? <Link href={message.href}>{message.cta} →</Link> : null}
        </span>
      ) : null}
    </span>
  );
}
