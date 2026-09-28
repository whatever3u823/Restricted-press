/**
 * The institution's visual vocabulary: bindings, file cards,
 * catalogue rows and numbered index heads. All data shown is real record data.
 */
import Link from "next/link";
import { accessLabel, fileNo, type WorkListItem, yearLabel } from "@/lib/archive";
import { Byline } from "./records";

type CoverWork = Pick<WorkListItem, "accession" | "title" | "category" | "authors">;

function primaryAuthor(item: CoverWork) {
  return item.authors.find((a) => a.role === "author" || a.role === "editor") ?? item.authors[0];
}

function shortTitle(t: string) {
  // Bindings carry the short title, as a binder would letter it.
  return t
    .replace(/ from \d{4} to \d{4}$/, "")
    .replace(/ and the Beginnings of Chemistry$/, "")
    .replace(/ and the Occult Arts$/, "");
}

/** An archival binding: cloth by collection, paper title label, file number. */
export function BookCover({ item }: { item: CoverWork }) {
  const author = primaryAuthor(item);
  return (
    <div className={`cover cover--${item.category?.slug ?? "esoterica"}`} aria-hidden="true">
      <span className="cover__file">{fileNo(item.accession)}</span>
      <span className="cover__label">
        <span className="cover__title">{shortTitle(item.title)}</span>
        <span className="cover__rule" />
        <span className="cover__author">{author ? author.name.replace(/^Sir /, "") : "Anonymous"}</span>
      </span>
      <span className="cover__press">Restricted Press</span>
    </div>
  );
}

/** Numbered section index: "02 / FEATURED FILES". */
export function IndexHead({ no, title, aside }: { no: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="index-head">
      <span className="index-head__no">{no}</span>
      <h2 className="index-head__title">{title}</h2>
      {aside ? <span>{aside}</span> : <span />}
    </div>
  );
}

/** A featured file: the binding is the centrepiece, the record sits beneath. */
export function FileCard({ item, i = 0 }: { item: WorkListItem; i?: number }) {
  const author = primaryAuthor(item);
  return (
    <article className="file-card reveal" style={{ ["--i" as string]: i }}>
      <BookCover item={item} />
      <div className="file-card__record">
        <span className="file-no">{fileNo(item.accession)}</span>
        <h3 className="file-card__title">
          <Link href={`/archive/${item.slug}`}>{item.title}</Link>
        </h3>
        <span className="file-card__author">
          {author?.name ?? "Anonymous"} · {yearLabel(item.originalYear, item.originalYearBasis)}
        </span>
        <dl className="kv">
          <dt>Status</dt>
          <dd className={item.rights.tone === "clear" ? undefined : "red"}>{item.rights.label}</dd>
          <dt>Access</dt>
          <dd>{accessLabel(item)}</dd>
        </dl>
        <span className="file-card__cta">[ View file ]</span>
      </div>
    </article>
  );
}

/** One line of the catalogue. */
export function CatalogRow({ item, note }: { item: WorkListItem; note?: string }) {
  return (
    <li className="catalog-row">
      <span className="file-no">{fileNo(item.accession)}</span>
      <span className="catalog-row__cover">
        <BookCover item={item} />
      </span>
      <div className="catalog-row__main">
        <h3 className="catalog-row__title">
          <Link href={`/archive/${item.slug}`}>{item.title}</Link>
        </h3>
        <p className="catalog-row__author">
          <Byline authors={item.authors} />
        </p>
        {note ?? item.summary ? <p className="catalog-row__summary">{note ?? item.summary}</p> : null}
      </div>
      <span className="cell">
        <span className="cell-label">Year</span>
        {yearLabel(item.originalYear, item.originalYearBasis)}
      </span>
      <span className="cell">
        <span className="cell-label">Subject</span>
        {item.category?.name ?? "—"}
      </span>
      <span className="cell">
        <span className="cell-label">Status</span>
        <span className={`stamp${item.rights.tone === "clear" ? "" : " stamp--red"}`}>{item.rights.label}</span>
        <span style={{ color: item.accessLevel === "inner" || item.publicationStatus !== "published" ? "var(--red)" : undefined }}>
          {accessLabel(item)}
        </span>
      </span>
    </li>
  );
}
