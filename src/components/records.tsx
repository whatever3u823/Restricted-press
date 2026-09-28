import Link from "next/link";
import { Fragment } from "react";
import { fileNo, type AuthorRef, type RightsSummary, type WorkListItem, yearLabel } from "@/lib/archive";

export function Byline({ authors, linked = true }: { authors: AuthorRef[]; linked?: boolean }) {
  const primary = authors.filter((a) => a.role === "author" || a.role === "editor");
  const secondary = authors.filter((a) => a.role !== "author" && a.role !== "editor");
  const name = (a: AuthorRef) =>
    linked ? (
      <Link href={`/authors/${a.slug}`} style={{ position: "relative", zIndex: 1 }}>
        {a.name}
      </Link>
    ) : (
      a.name
    );
  return (
    <>
      {primary.map((a, i) => (
        <Fragment key={a.slug}>
          {i > 0 ? " & " : null}
          {name(a)}
          {a.role === "editor" ? " (ed.)" : null}
        </Fragment>
      ))}
      {secondary.map((a) => (
        <Fragment key={a.slug}>
          {" · "}
          {a.role === "translator" ? "trans. " : a.role === "introducer" ? "intro. " : ""}
          {name(a)}
        </Fragment>
      ))}
    </>
  );
}

export function RightsStamp({ rights, large }: { rights: RightsSummary; large?: boolean }) {
  const tone = rights.tone === "clear" ? "" : " stamp--accent";
  return <span className={`stamp${tone}${large ? " stamp--large" : ""}`}>{rights.label}</span>;
}

export function AccessStamp({ item }: { item: Pick<WorkListItem, "accessLevel" | "publicationStatus"> }) {
  if (item.publicationStatus !== "published") return <span className="stamp stamp--accent">Text withheld</span>;
  if (item.accessLevel === "inner") return <span className="stamp stamp--brass">Inner Archive</span>;
  return null;
}

export function Confidence({ level }: { level: "high" | "medium" | "low" }) {
  const n = level === "high" ? 3 : level === "medium" ? 2 : 1;
  return (
    <span className="confidence" title={`${level} confidence`} aria-label={`${level} confidence`}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < n ? "on" : undefined} />
      ))}
    </span>
  );
}

export function DraftFlag({ children = "Curatorial draft — pending review" }: { children?: React.ReactNode }) {
  return <span className="draft-flag">{children}</span>;
}

/** Titles transcribed in capitals are set in small capitals. */
export function SectionTitle({ title }: { title: string }) {
  const clean = title.replace(/_/g, "").replace(/^¶\s*/, "");
  const letters = clean.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length > 3 && letters === letters.toUpperCase();
  return allCaps ? <span className="caps-title">{clean}</span> : <>{clean}</>;
}

export function RecordRow({ item, note }: { item: WorkListItem; note?: React.ReactNode }) {
  return (
    <li className="record-row">
      <div className="record-row__file file-no">{fileNo(item.accession)}</div>
      <div>
        <h3 className="record-row__title">
          <Link href={`/archive/${item.slug}`}>{item.title}</Link>
        </h3>
        <p className="record-row__byline">
          <Byline authors={item.authors} /> · {yearLabel(item.originalYear, item.originalYearBasis)}
        </p>
        {note ? <p className="record-row__summary">{note}</p> : item.summary ? <p className="record-row__summary">{item.summary}</p> : null}
      </div>
      <div className="record-row__side">
        {item.category ? <span className="label">{item.category.name}</span> : null}
        <RightsStamp rights={item.rights} />
        <AccessStamp item={item} />
      </div>
    </li>
  );
}

export function RecordCard({ item }: { item: WorkListItem }) {
  return (
    <article className="record-card">
      <div className="record-card__top">
        <span className="file-no">{fileNo(item.accession)}</span>
        {item.category ? <span className="label">{item.category.name}</span> : null}
      </div>
      <h3 className="record-card__title">
        <Link href={`/archive/${item.slug}`}>{item.title}</Link>
      </h3>
      <p className="meta">
        <Byline authors={item.authors.filter((a) => a.role === "author" || a.role === "editor")} linked={false} />
      </p>
      <div className="record-card__foot">
        <span>{yearLabel(item.originalYear, item.originalYearBasis)}</span>
        <span>{item.accessLevel === "inner" ? "Inner Archive" : item.rights.label}</span>
      </div>
    </article>
  );
}

/** Render the transcription's _underscore_ italics as emphasis. */
export function Emph({ text }: { text: string }) {
  const parts = text.split(/(_[^_\n]+_)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^_[^_\n]+_$/.test(p) ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}
