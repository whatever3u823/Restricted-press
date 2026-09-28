/** Period vocabulary: covers, stamps, plates, redactions, ornaments. */
import Link from "next/link";
import { classMark, fileNo, type WorkListItem } from "@/lib/archive";
import { Emblem, Lozenge } from "./emblems";

type CoverWork = Pick<WorkListItem, "accession" | "title" | "category" | "authors">;

export function BookCover({ item, size = "md" }: { item: CoverWork; size?: "sm" | "md" | "lg" }) {
  const author = item.authors.find((a) => a.role === "author" || a.role === "editor");
  return (
    <div className={`cover cover--${size} cover--${item.category?.slug ?? "esoterica"}`} aria-hidden="true">
      <span className="cover__file">{fileNo(item.accession)}</span>
      <span className="cover__middle">
        <Emblem category={item.category?.slug} className="cover__emblem" />
        <span className="cover__title">{shortTitle(item.title)}</span>
      </span>
      <span className="cover__author">{author ? surname(author.name) : "Restricted Press"}</span>
    </div>
  );
}

function shortTitle(t: string) {
  // Covers carry the short title, as a binder would letter it.
  return t.replace(/ from \d{4} to \d{4}$/, "").replace(/ and the Beginnings of Chemistry$/, "").replace(/ and the Occult Arts$/, "");
}
function surname(name: string) {
  const clean = name.replace(/^Sir /, "");
  if (/Three Initiates/.test(clean)) return "Three Initiates";
  return clean.split(" ").slice(-1)[0];
}

export function InkStamp({
  children,
  sub,
  tone = "red",
  tilt = -4,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "red" | "brass" | "ink";
  tilt?: number;
}) {
  return (
    <span
      className={`ink-stamp${tone === "brass" ? " ink-stamp--brass" : tone === "ink" ? " ink-stamp--ink" : ""}`}
      style={{ ["--tilt" as string]: `${tilt}deg` }}
      aria-hidden="true"
    >
      {children}
      {sub ? <small>{sub}</small> : null}
    </span>
  );
}

/** A redaction bar that lifts on hover or focus. */
export function Redact({ children }: { children: React.ReactNode }) {
  return (
    <span className="redact" tabIndex={0} title="Restored on request">
      {children}
    </span>
  );
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function Plate({
  src,
  caption,
  n,
  photo,
  mounted,
  href,
}: {
  src: string;
  caption: string;
  n?: number;
  photo?: boolean;
  mounted?: boolean;
  href?: string;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={caption} loading="lazy" decoding="async" />
  );
  return (
    <figure className={`plate${photo ? " plate--photo-cap" : ""}`}>
      <div className={`plate__frame${photo ? " plate__frame--photo" : ""}${mounted ? " mounted" : ""}`}>
        {href ? <Link href={href}>{img}</Link> : img}
      </div>
      <figcaption>
        {n !== undefined ? <span className="plate__no">Plate {ROMAN[n] ?? n + 1}</span> : null}
        <span className="plate__caption">{caption}</span>
      </figcaption>
    </figure>
  );
}

export function Ornament() {
  return (
    <div className="ornament" aria-hidden="true">
      <Lozenge />
    </div>
  );
}

export function ClassMark({ item }: { item: Parameters<typeof classMark>[0] }) {
  return (
    <span className="class-mark" title="Class mark">
      {classMark(item)}
    </span>
  );
}

/** SVG filter that roughens stamp edges like ink on paper. Rendered once. */
export function InkFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="rp-ink" x="-10%" y="-20%" width="120%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="1" seed="9" result="blotch" />
        <feColorMatrix in="blotch" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.45" result="mask" />
        <feComposite in="rough" in2="mask" operator="in" />
      </filter>
    </svg>
  );
}
