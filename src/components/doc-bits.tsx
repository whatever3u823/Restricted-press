import type { DocumentKind, ReadingStatus } from "@/db/schema";
import { STATUS_LABEL } from "@/lib/library";

/** Which leather a volume is bound in: stable for a title, varied across a shelf. */
export function toneOf(title: string) {
  let h = 2166136261;
  for (let i = 0; i < title.length; i++) h = Math.imul(h ^ title.charCodeAt(i), 16777619);
  return (h >>> 0) % 7;
}

/** A document's mark: books are bound volumes with a gilt initial; papers and notes are folded sheets. */
export function Spine({ title, format, kind, large }: { title: string; format: string; kind: DocumentKind; large?: boolean }) {
  const initial = title.replace(/^(the|a|an)\s+/i, "").match(/\p{L}|\p{N}/u)?.[0]?.toUpperCase() ?? "·";
  return (
    <span className={`spine${large ? " spine--lg" : ""}`} data-format={format} data-kind={kind} data-tone={toneOf(title)} aria-hidden="true">
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
