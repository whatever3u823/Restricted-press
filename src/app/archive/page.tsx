import type { Metadata } from "next";
import Link from "next/link";
import { RecordRow } from "@/components/records";
import { fileNo, getFacets, listWorks, type ArchiveFilters } from "@/lib/archive";
import { markedSnippet } from "@/lib/html";
import { retriever } from "@/lib/search/retriever";
import { toConcepts } from "@/lib/search/vocabulary";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "The Archive" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

const PAGE = 20;

export default async function ArchivePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = one(sp.tab) === "passages" ? "passages" : "records";
  const filters: ArchiveFilters = {
    q: one(sp.q),
    category: one(sp.category),
    subject: one(sp.subject),
    author: one(sp.author),
    century: one(sp.century),
    availability: one(sp.availability) as ArchiveFilters["availability"],
    sort: one(sp.sort) as ArchiveFilters["sort"],
  };
  const viewer = await getViewer();
  const facets = await getFacets();

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { ...filters, tab: tab === "passages" ? "passages" : undefined, ...patch } as Record<string, string | undefined>;
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const qs = next.toString();
    return `/archive${qs ? `?${qs}` : ""}`;
  };
  const toggle = (key: keyof ArchiveFilters, value: string) =>
    href({ [key]: filters[key] === value ? undefined : value, page: undefined });

  const activeFilters = (["category", "subject", "author", "century", "availability"] as const).filter((k) => filters[k]);

  return (
    <div className="wrap">
      <header className="page-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Restricted Press</Link> <span>/</span> <span>The Archive</span>
        </nav>
        <div className="page-head__row mt-2">
          <h1 className="title-xl">The Archive</h1>
          <p className="meta">
            {facets.categories.reduce((n, c) => n + c.n, 0)} records ·{" "}
            {Object.entries(facets.availability)
              .map(([k, n]) => `${n} ${k === "full-text" ? "open" : k === "inner" ? "inner" : "withheld"}`)
              .join(" · ")}
          </p>
        </div>
        <form action="/archive" className="search-field mt-4" role="search">
          <label htmlFor="archive-q" className="visually-hidden">
            Search the archive
          </label>
          <input
            id="archive-q"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={tab === "passages" ? "Search inside the texts…" : "Search titles, authors, subjects, FILE numbers…"}
            autoComplete="off"
          />
          {tab === "passages" ? <input type="hidden" name="tab" value="passages" /> : null}
          {activeFilters.map((k) => (
            <input key={k} type="hidden" name={k} value={filters[k]} />
          ))}
          <button type="submit">Search</button>
        </form>
        <nav className="tabs mt-3" aria-label="Search scope">
          <Link href={href({ tab: undefined })} aria-current={tab === "records" ? "page" : undefined}>
            Records
          </Link>
          <Link href={href({ tab: "passages" })} aria-current={tab === "passages" ? "page" : undefined}>
            Passages — search inside the texts
          </Link>
        </nav>
      </header>

      <div className="archive-layout">
        <aside className="filters" aria-label="Filters">
          <FilterGroup
            legend="Shelf"
            items={facets.categories.map((c) => ({ key: c.slug, label: c.name, n: c.n }))}
            active={filters.category}
            link={(k) => toggle("category", k)}
          />
          <FilterGroup
            legend="Period"
            items={facets.centuries.map((c) => ({ key: c.key, label: c.label, n: c.n }))}
            active={filters.century}
            link={(k) => toggle("century", k)}
          />
          <FilterGroup
            legend="Text"
            items={[
              { key: "full-text", label: "Open full text", n: facets.availability["full-text"] ?? 0 },
              { key: "inner", label: "Inner Archive", n: facets.availability.inner ?? 0 },
              { key: "record-only", label: "Record only (withheld)", n: facets.availability["record-only"] ?? 0 },
            ].filter((x) => x.n > 0)}
            active={filters.availability}
            link={(k) => toggle("availability", k)}
          />
          <FilterGroup
            legend="Subject"
            items={facets.subjects.slice(0, 14).map((c) => ({ key: c.slug, label: c.name, n: c.n }))}
            active={filters.subject}
            link={(k) => toggle("subject", k)}
          />
          <FilterGroup
            legend="Author"
            items={facets.authors.map((c) => ({ key: c.slug, label: c.name, n: c.n }))}
            active={filters.author}
            link={(k) => toggle("author", k)}
          />
          {activeFilters.length ? (
            <Link href={tab === "passages" ? `/archive?tab=passages${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}` : "/archive"} className="link-arrow">
              Clear filters
            </Link>
          ) : null}
        </aside>

        <section aria-live="polite">
          {tab === "records" ? (
            <RecordsResults filters={filters} sortLink={(s) => href({ sort: s })} />
          ) : (
            <PassageResults
              q={filters.q}
              page={Number(one(sp.page) ?? 1) || 1}
              expanded={viewer.can("search.expanded") && one(sp.exact) !== "1"}
              canExpand={viewer.can("search.expanded")}
              includeInner={viewer.can("text.inner")}
              pageLink={(p) => href({ page: String(p) })}
              exactLink={(on) => href({ exact: on ? "1" : undefined, page: undefined })}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function FilterGroup({
  legend,
  items,
  active,
  link,
}: {
  legend: string;
  items: { key: string; label: string; n: number }[];
  active?: string;
  link: (k: string) => string;
}) {
  if (!items.length) return null;
  return (
    <fieldset>
      <legend className="label label--ink">{legend}</legend>
      <ul className="filter-list">
        {items.map((i) => (
          <li key={i.key}>
            <Link href={link(i.key)} aria-current={active === i.key ? "true" : undefined} scroll={false}>
              <span>{i.label}</span>
              <span className="n">{i.n}</span>
            </Link>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

async function RecordsResults({ filters, sortLink }: { filters: ArchiveFilters; sortLink: (s?: string) => string }) {
  const works = await listWorks(filters);
  return (
    <>
      <div className="spread" style={{ paddingBottom: 10, borderBottom: "1px solid var(--rule-strong)" }}>
        <span className="label label--ink">
          {works.length} {works.length === 1 ? "record" : "records"}
          {filters.q ? ` matching “${filters.q}”` : ""}
        </span>
        <span className="row meta" style={{ gap: 14 }}>
          Order:
          {(
            [
              [undefined, filters.q ? "Relevance" : "Accession"],
              ["date", "Date"],
              ["title", "Title"],
            ] as const
          ).map(([k, label]) => (
            <Link key={label} href={sortLink(k)} aria-current={filters.sort === k ? "true" : undefined} style={{ fontWeight: filters.sort === k ? 600 : 400 }}>
              {label}
            </Link>
          ))}
        </span>
      </div>
      {works.length ? (
        <ul className="records">
          {works.map((w) => (
            <RecordRow key={w.id} item={w} />
          ))}
        </ul>
      ) : (
        <div className="empty">
          <p>No records answer to that description.</p>
          <p className="meta mt-2">
            Try fewer filters, or{" "}
            <Link href={`/archive?tab=passages${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`}>search inside the texts</Link>.
          </p>
        </div>
      )}
    </>
  );
}

async function PassageResults({
  q,
  page,
  expanded,
  canExpand,
  includeInner,
  pageLink,
  exactLink,
}: {
  q?: string;
  page: number;
  expanded: boolean;
  canExpand: boolean;
  includeInner: boolean;
  pageLink: (p: number) => string;
  exactLink: (on: boolean) => string;
}) {
  if (!q) {
    return (
      <div className="empty">
        <p>Search every passage of every open text.</p>
        <p className="meta mt-2">Try “philosopher’s stone”, “sabbath”, “familiar spirits”, or “Kelley”.</p>
      </div>
    );
  }
  const concepts = toConcepts(q, expanded);
  const hits = await retriever.retrieve({
    concepts,
    limit: PAGE + 1,
    offset: (page - 1) * PAGE,
    includeInner,
  });
  const more = hits.length > PAGE;
  const shown = hits.slice(0, PAGE);

  return (
    <>
      <div className="spread" style={{ paddingBottom: 10, borderBottom: "1px solid var(--rule-strong)" }}>
        <span className="label label--ink">
          Passages {shown.length ? `${(page - 1) * PAGE + 1}–${(page - 1) * PAGE + shown.length}` : ""} for “{q}”
        </span>
        {canExpand ? (
          <span className="meta">
            {expanded ? (
              <>
                Conceptual search · <Link href={exactLink(true)}>exact words only</Link>
              </>
            ) : (
              <>
                Exact words · <Link href={exactLink(false)}>conceptual search</Link>
              </>
            )}
          </span>
        ) : (
          <span className="meta">
            Exact words · <Link href="/membership">conceptual search is in the Inner Archive</Link>
          </span>
        )}
      </div>
      {expanded ? (
        <p className="meta mt-2">
          Also searching for:{" "}
          {concepts
            .flatMap((c) => c.terms.filter((t) => t !== c.term).slice(0, 5))
            .slice(0, 16)
            .join(", ") || "—"}
        </p>
      ) : null}
      {shown.length ? (
        <div className="stack mt-2" style={{ ["--stack" as string]: "4px" }}>
          {shown.map((h) => (
            <article key={h.id} className="excerpt">
              <p className="excerpt__text" dangerouslySetInnerHTML={{ __html: markedSnippet(h.snippet) }} />
              <p className="excerpt__source">
                <span className="file-no">{fileNo(h.accession)}</span>
                <Link href={`/archive/${h.slug}`}>
                  <em>{h.title}</em>
                </Link>
                <span>{h.author}</span>
                <Link href={`/p/${h.id}`} className="label" style={{ textDecoration: "none" }}>
                  ¶ {h.id} — read in context →
                </Link>
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <p>The archive holds no passage matching “{q}”.</p>
          <p className="meta mt-2">
            <Link href={`/archivist?q=${encodeURIComponent(q)}`}>Ask the Archivist</Link> — it searches with a wider vocabulary.
          </p>
        </div>
      )}
      <nav className="pagination" aria-label="Pages">
        {page > 1 ? <Link href={pageLink(page - 1)}>← Previous</Link> : <span />}
        {more ? <Link href={pageLink(page + 1)}>Next →</Link> : <span />}
      </nav>
      <div className="notice mt-2">
        <strong>Asking rather than searching?</strong> The Archivist reads these passages for you and answers with
        citations. <Link href={`/archivist?q=${encodeURIComponent(q)}`}>Put “{q}” to the Archivist →</Link>
      </div>
    </>
  );
}
