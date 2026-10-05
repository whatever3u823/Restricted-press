import type { DocumentKind, ReadingStatus } from "@/db/schema";
import { STATUS_LABEL } from "@/lib/library";

/** A document's mark in lists: its initial, cut like a spine, with the format below. */
export function Spine({ title, format, kind, large }: { title: string; format: string; kind: DocumentKind; large?: boolean }) {
  const initial = title.replace(/^(the|a|an)\s+/i, "").match(/\p{L}|\p{N}/u)?.[0]?.toUpperCase() ?? "·";
  return (
    <span className={`spine${large ? " spine--lg" : ""}`} data-format={format} data-kind={kind} aria-hidden="true">
      {initial}
    </span>
  );
}

export function StatusBadge({ status }: { status: ReadingStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>;
}

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const shortDate = (d: Date | string) => fmt.format(new Date(d));

export function relative(d: Date | string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return shortDate(d);
}
