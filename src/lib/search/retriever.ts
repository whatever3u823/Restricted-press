/**
 * Retrieval — the single seam between "a question" and "evidence".
 *
 * Everything that needs passages (library search, the Archivist) goes
 * through a Retriever, always scoped to one reader's library. Today there is
 * one implementation, LexicalRetriever, backed by Postgres full-text search.
 * A semantic (embedding) retriever can implement the same interface and be
 * combined with this one via reciprocal-rank fusion without touching callers.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type { Concept } from "./query";

export type RetrievalQuery = {
  ownerId: string;
  concepts: Concept[];
  limit: number;
  /** Cap on passages from one document, so answers stay cross-textual. */
  perDocumentCap?: number;
  /** Restrict to these documents. */
  documentIds?: number[];
  offset?: number;
};

export type PassageHit = {
  id: string;
  documentId: number;
  title: string;
  author: string | null;
  year: number | null;
  sectionOrdinal: number;
  sectionTitle: string;
  page: number | null;
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

type Row = {
  id: string;
  document_id: number;
  title: string;
  author: string | null;
  year: number | null;
  section_ordinal: number;
  section_title: string;
  page: number | null;
  kind: string;
  text: string;
  snippet: string;
  coverage: number;
  score: number;
};

const toHit = (r: Row): PassageHit => ({
  id: r.id,
  documentId: r.document_id,
  title: r.title,
  author: r.author,
  year: r.year,
  sectionOrdinal: r.section_ordinal,
  sectionTitle: r.section_title,
  page: r.page,
  kind: r.kind,
  text: r.text,
  snippet: r.snippet,
  coverage: Number(r.coverage),
  score: Number(r.score),
});

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
    const docFilter = q.documentIds?.length ? sql`and p.document_id in ${q.documentIds}` : sql``;
    const cap = q.perDocumentCap ?? 100000;

    const rows = await db.execute<Row>(sql`
      with q as (select ${any} as tsq),
      matched as (
        select p.id, p.document_id, p.section_id, p.kind, p.text, p.word_count, p.page,
          (${coverage}) as coverage,
          ts_rank_cd(p.search, q.tsq, 32) as rank
        from passages p, q
        where p.owner_id = ${q.ownerId} ${docFilter}
          and p.kind <> 'heading'
          and p.word_count >= 8
          and p.search @@ q.tsq
      ),
      scored as (
        select m.*,
          -- Concept coverage dominates; rank breaks ties; very short passages are discounted.
          (m.coverage * 1.0 + m.rank * 4.0) * case when m.word_count < 25 then 0.7 else 1 end as score
        from matched m
      ),
      ranked as (
        select s.*, row_number() over (partition by s.document_id order by s.score desc) as doc_rank
        from scored s
      )
      select r.id, r.document_id, d.title, d.author, d.year,
        sec.ordinal as section_ordinal, sec.title as section_title, r.page,
        r.kind, r.text, r.coverage, r.score,
        ts_headline('english', r.text, (select tsq from q),
          'StartSel=<mark>,StopSel=</mark>,MaxWords=42,MinWords=18,MaxFragments=2,FragmentDelimiter=" … "') as snippet
      from ranked r
      join documents d on d.id = r.document_id and d.status = 'ready'
      join sections sec on sec.id = r.section_id
      where r.doc_rank <= ${cap}
      order by r.score desc, r.id
      limit ${q.limit} offset ${q.offset ?? 0}
    `);
    return [...rows].map(toHit);
  }
}

export const retriever: Retriever = new LexicalRetriever();

/** Fetch specific passages in retrieval shape (for a passage the reader pinned). */
export async function getPassageHits(ownerId: string, ids: string[]): Promise<PassageHit[]> {
  if (!ids.length) return [];
  const rows = await db.execute<Row>(sql`
    select p.id, p.document_id, d.title, d.author, d.year, sec.ordinal section_ordinal, sec.title section_title,
      p.page, p.kind, p.text, left(p.text, 280) snippet, 0 coverage, 0 score
    from passages p join documents d on d.id = p.document_id join sections sec on sec.id = p.section_id
    where p.id in ${ids} and p.owner_id = ${ownerId}
  `);
  return [...rows].map(toHit);
}
