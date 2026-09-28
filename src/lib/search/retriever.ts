/**
 * Retrieval — the single seam between "a question" and "evidence".
 *
 * Everything that needs passages (archive search, the Archivist) goes through
 * a Retriever. Today there is one implementation, LexicalRetriever, backed by
 * Postgres full-text search over passages plus the controlled vocabulary.
 * A semantic (embedding) retriever can implement the same interface and be
 * combined with this one via reciprocal-rank fusion without touching callers.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type { Concept } from "./vocabulary";

export type RetrievalQuery = {
  concepts: Concept[];
  limit: number;
  /** Cap on passages from one work, so answers stay cross-textual. */
  perWorkCap?: number;
  /** Restrict to these works. */
  workIds?: number[];
  /** Include works whose text is Inner Archive only. */
  includeInner?: boolean;
  offset?: number;
};

export type PassageHit = {
  id: string;
  workId: number;
  accession: number;
  slug: string;
  title: string;
  author: string | null;
  year: number | null;
  sectionOrdinal: number;
  sectionTitle: string;
  kind: string;
  text: string;
  /** Excerpt with <mark> tags around matched terms. */
  snippet: string;
  /** How many of the query's concepts the passage touches. */
  coverage: number;
  score: number;
};

export interface Retriever {
  readonly name: string;
  retrieve(q: RetrievalQuery): Promise<PassageHit[]>;
}

/** Build a tsquery that matches any term in a concept. */
function conceptQuery(c: Concept): SQL {
  const parts = c.terms.map((t) =>
    t.includes(" ") ? sql`phraseto_tsquery('english', unaccent_immutable(${t}))` : sql`plainto_tsquery('english', unaccent_immutable(${t}))`,
  );
  return sql`(${sql.join(parts, sql` || `)})`;
}

export class LexicalRetriever implements Retriever {
  readonly name = "lexical";

  async retrieve(q: RetrievalQuery): Promise<PassageHit[]> {
    const concepts = q.concepts.filter((c) => c.terms.length);
    if (!concepts.length) return [];
    const perConcept = concepts.map(conceptQuery);
    const any = sql`(${sql.join(perConcept, sql` || `)})`;
    const coverage = sql.join(
      perConcept.map((cq) => sql`(p.search @@ ${cq})::int`),
      sql` + `,
    );
    const workFilter = q.workIds?.length ? sql`and p.work_id in ${q.workIds}` : sql``;
    const innerFilter = q.includeInner ? sql`` : sql`and w.access_level = 'open'`;
    const cap = q.perWorkCap ?? 1000;

    const rows = await db.execute<{
      id: string;
      work_id: number;
      accession: number;
      slug: string;
      title: string;
      author: string | null;
      year: number | null;
      section_ordinal: number;
      section_title: string;
      kind: string;
      text: string;
      snippet: string;
      coverage: number;
      score: number;
    }>(sql`
      with q as (select ${any} as tsq),
      matched as (
        select p.id, p.work_id, p.section_id, p.kind, p.text, p.word_count, p.ordinal,
          (${coverage}) as coverage,
          ts_rank_cd(p.search, q.tsq, 32) as rank
        from passages p, q, works w
        where w.id = p.work_id and w.publication_status = 'published'
          ${innerFilter} ${workFilter}
          and p.kind not in ('rule', 'illustration')
          and p.word_count >= 12
          and p.search @@ q.tsq
      ),
      scored as (
        select m.*,
          -- Concept coverage dominates; rank breaks ties; very short
          -- passages and footnotes are discounted.
          (m.coverage * 1.0 + m.rank * 4.0) * case when m.kind = 'note' then 0.6 when m.word_count < 30 then 0.7 else 1 end as score
        from matched m
      ),
      ranked as (
        select s.*, row_number() over (partition by s.work_id order by s.score desc) as work_rank
        from scored s
      )
      select r.id, r.work_id, w.accession, w.slug, w.title,
        (select a.name from work_authors wa join authors a on a.id = wa.author_id
          where wa.work_id = w.id order by wa.position limit 1) as author,
        w.original_year as year,
        sec.ordinal as section_ordinal, sec.title as section_title,
        r.kind, r.text, r.coverage, r.score,
        ts_headline('english', r.text, (select tsq from q),
          'StartSel=<mark>,StopSel=</mark>,MaxWords=42,MinWords=18,MaxFragments=2,FragmentDelimiter=" … "') as snippet
      from ranked r
      join works w on w.id = r.work_id
      join sections sec on sec.id = r.section_id
      where r.work_rank <= ${cap}
      order by r.score desc, r.id
      limit ${q.limit} offset ${q.offset ?? 0}
    `);

    return [...rows].map((r) => ({
      id: r.id,
      workId: r.work_id,
      accession: r.accession,
      slug: r.slug,
      title: r.title,
      author: r.author,
      year: r.year,
      sectionOrdinal: r.section_ordinal,
      sectionTitle: r.section_title,
      kind: r.kind,
      text: r.text,
      snippet: r.snippet,
      coverage: Number(r.coverage),
      score: Number(r.score),
    }));
  }
}

export const retriever: Retriever = new LexicalRetriever();

/** Fetch specific passages in retrieval shape (for a passage the reader pinned). */
export async function getPassageHits(ids: string[], includeInner: boolean): Promise<PassageHit[]> {
  if (!ids.length) return [];
  const rows = await db.execute<{
    id: string;
    work_id: number;
    accession: number;
    slug: string;
    title: string;
    author: string | null;
    year: number | null;
    section_ordinal: number;
    section_title: string;
    kind: string;
    text: string;
  }>(sql`
    select p.id, p.work_id, w.accession, w.slug, w.title,
      (select a.name from work_authors wa join authors a on a.id = wa.author_id where wa.work_id = w.id order by wa.position limit 1) author,
      w.original_year as year, sec.ordinal section_ordinal, sec.title section_title, p.kind, p.text
    from passages p join works w on w.id = p.work_id join sections sec on sec.id = p.section_id
    where p.id in ${ids} and w.publication_status = 'published' ${includeInner ? sql`` : sql`and w.access_level = 'open'`}
  `);
  return [...rows].map((r) => ({
    id: r.id,
    workId: r.work_id,
    accession: r.accession,
    slug: r.slug,
    title: r.title,
    author: r.author,
    year: r.year,
    sectionOrdinal: r.section_ordinal,
    sectionTitle: r.section_title,
    kind: r.kind,
    text: r.text,
    snippet: r.text.slice(0, 280),
    coverage: 0,
    score: 0,
  }));
}
