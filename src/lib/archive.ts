/**
 * Read access to the catalogue. Pages call these functions; nothing else in
 * the UI talks to the database about works, sections or passages.
 */
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import * as s from "@/db/schema";

/** Publication statuses visible to the public. */
export const VISIBLE: s.PublicationStatus[] = ["published", "rights_review"];

export const fileNo = (accession: number) => `FILE ${String(accession).padStart(4, "0")}`;

export type AuthorRef = { slug: string; name: string; role: string };
export type SubjectRef = { slug: string; name: string };

export type RightsSummary = {
  label: string;
  tone: "clear" | "review" | "restricted";
  confidence: "high" | "medium" | "low";
};

export type WorkListItem = {
  id: number;
  accession: number;
  slug: string;
  title: string;
  subtitle: string | null;
  originalYear: number | null;
  originalYearBasis: string;
  publicationStatus: s.PublicationStatus;
  accessLevel: "open" | "inner";
  featured: boolean;
  summary: string | null;
  wordCount: number;
  category: SubjectRef | null;
  authors: AuthorRef[];
  subjects: SubjectRef[];
  rights: RightsSummary;
};

const CONF_ORDER = { high: 2, medium: 1, low: 0 } as const;

export function summariseRights(rows: { status: string; confidence: "high" | "medium" | "low" }[]): RightsSummary {
  const confidence = rows.reduce<"high" | "medium" | "low">(
    (min, r) => (CONF_ORDER[r.confidence] < CONF_ORDER[min] ? r.confidence : min),
    "high",
  );
  if (rows.some((r) => r.status === "restricted")) return { label: "Restricted", tone: "restricted", confidence };
  if (rows.length === 0 || rows.some((r) => r.status === "needs_review")) return { label: "Rights review", tone: "review", confidence };
  if (rows.every((r) => r.status === "public_domain_worldwide")) return { label: "Public domain", tone: "clear", confidence };
  if (rows.every((r) => r.status.startsWith("public_domain"))) return { label: "Public domain · US", tone: "clear", confidence };
  return { label: "Licensed", tone: "clear", confidence };
}

const SHELF_CODE: Record<string, string> = {
  witchcraft: "WIT",
  alchemy: "ALC",
  esoterica: "ESO",
  magic: "MAG",
  mysticism: "MYS",
  "ancient-religion": "ANC",
  "secret-societies": "SOC",
};

/**
 * The archive's class mark (call number): shelf · date · author mark.
 * e.g. "WIT 1616 .R64" — shelf code, year of first publication, and a
 * Cutter-style mark from the first author's surname.
 */
export function classMark(item: Pick<WorkListItem, "category" | "originalYear" | "authors">) {
  const shelf = SHELF_CODE[item.category?.slug ?? ""] ?? "GEN";
  const person = item.authors.find((a) => a.role === "author" || a.role === "editor") ?? item.authors[0];
  const surname = (person?.name ?? "Anon").replace(/^Sir /, "").split(" ").slice(-1)[0].replace(/[^A-Za-z]/g, "");
  const cutter = surname ? `${surname[0].toUpperCase()}${cutterDigits(surname.slice(1))}` : "A00";
  return `${shelf} ${item.originalYear ?? "n.d."} .${cutter}`;
}
function cutterDigits(rest: string) {
  const r = rest.toLowerCase();
  const d = (c?: string) => (c ? Math.min(9, Math.max(1, Math.floor(((c.charCodeAt(0) - 97) / 26) * 9) + 1)) : 1);
  return `${d(r[0])}${d(r[1])}`;
}

export function yearLabel(year: number | null, basis?: string | null) {
  if (!year) return "Undated";
  return basis === "curatorial" ? `c. ${year}` : String(year);
}

/** Attach authors, subjects, category and rights to a set of works. */
async function hydrate(rows: (typeof s.works.$inferSelect)[]): Promise<WorkListItem[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [authorRows, subjectRows, rightsRows, categories] = await Promise.all([
    db
      .select({ workId: s.workAuthors.workId, slug: s.authors.slug, name: s.authors.name, role: s.workAuthors.role })
      .from(s.workAuthors)
      .innerJoin(s.authors, eq(s.authors.id, s.workAuthors.authorId))
      .where(inArray(s.workAuthors.workId, ids))
      .orderBy(asc(s.workAuthors.position)),
    db
      .select({ workId: s.workSubjects.workId, slug: s.subjects.slug, name: s.subjects.name })
      .from(s.workSubjects)
      .innerJoin(s.subjects, eq(s.subjects.id, s.workSubjects.subjectId))
      .where(inArray(s.workSubjects.workId, ids))
      .orderBy(asc(s.subjects.name)),
    db
      .select({ workId: s.rightsRecords.workId, status: s.rightsRecords.status, confidence: s.rightsRecords.confidence })
      .from(s.rightsRecords)
      .where(inArray(s.rightsRecords.workId, ids)),
    db.select({ id: s.subjects.id, slug: s.subjects.slug, name: s.subjects.name }).from(s.subjects).where(eq(s.subjects.kind, "category")),
  ]);
  const cat = new Map(categories.map((c) => [c.id, { slug: c.slug, name: c.name }]));
  return rows.map((w) => ({
    id: w.id,
    accession: w.accession,
    slug: w.slug,
    title: w.title,
    subtitle: w.subtitle,
    originalYear: w.originalYear,
    originalYearBasis: w.originalYearBasis,
    publicationStatus: w.publicationStatus,
    accessLevel: w.accessLevel,
    featured: w.featured,
    summary: w.summary,
    wordCount: w.wordCount,
    category: w.categoryId ? (cat.get(w.categoryId) ?? null) : null,
    authors: authorRows.filter((a) => a.workId === w.id),
    subjects: subjectRows.filter((x) => x.workId === w.id),
    rights: summariseRights(rightsRows.filter((r) => r.workId === w.id)),
  }));
}

export type ArchiveFilters = {
  q?: string;
  category?: string;
  subject?: string;
  author?: string;
  century?: string;
  availability?: "full-text" | "inner" | "record-only";
  sort?: "accession" | "date" | "title";
};

/** Centuries are keyed like "17" for the 1600s. */
export function centuryLabel(key: string) {
  const n = Number(key);
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]} century`;
}

export async function listWorks(f: ArchiveFilters = {}) {
  const where: SQL[] = [inArray(s.works.publicationStatus, VISIBLE)];
  if (f.category) {
    where.push(sql`${s.works.categoryId} = (select id from subjects where slug = ${f.category})`);
  }
  if (f.subject) {
    where.push(
      sql`exists (select 1 from work_subjects ws join subjects x on x.id = ws.subject_id where ws.work_id = ${s.works.id} and x.slug = ${f.subject})`,
    );
  }
  if (f.author) {
    where.push(
      sql`exists (select 1 from work_authors wa join authors a on a.id = wa.author_id where wa.work_id = ${s.works.id} and a.slug = ${f.author})`,
    );
  }
  if (f.century) {
    const c = Number(f.century);
    if (Number.isFinite(c)) where.push(sql`${s.works.originalYear} >= ${(c - 1) * 100} and ${s.works.originalYear} < ${c * 100}`);
  }
  if (f.availability === "full-text") where.push(sql`${s.works.publicationStatus} = 'published' and ${s.works.accessLevel} = 'open'`);
  if (f.availability === "inner") where.push(sql`${s.works.accessLevel} = 'inner'`);
  if (f.availability === "record-only") where.push(sql`${s.works.publicationStatus} <> 'published'`);

  const q = f.q?.trim();
  let rank: SQL | null = null;
  if (q) {
    // Catalogue search over title, subtitle, authors, subjects and summary.
    const doc = sql`(
      setweight(to_tsvector('english', unaccent_immutable(${s.works.title} || ' ' || coalesce(${s.works.subtitle}, ''))), 'A') ||
      setweight(to_tsvector('english', unaccent_immutable(coalesce((select string_agg(a.name, ' ') from work_authors wa join authors a on a.id = wa.author_id where wa.work_id = ${s.works.id}), ''))), 'A') ||
      setweight(to_tsvector('english', coalesce((select string_agg(x.name, ' ') from work_subjects ws join subjects x on x.id = ws.subject_id where ws.work_id = ${s.works.id}), '')), 'B') ||
      setweight(to_tsvector('english', unaccent_immutable(coalesce(${s.works.summary}, '') || ' ' || coalesce(${s.works.historicalContext}, ''))), 'C')
    )`;
    const query = sql`websearch_to_tsquery('english', unaccent_immutable(${q}))`;
    const fileMatch = q.match(/^\s*(?:file\s*)?0*(\d{1,4})\s*$/i);
    where.push(
      fileMatch
        ? sql`(${s.works.accession} = ${Number(fileMatch[1])} or ${doc} @@ ${query})`
        : sql`(${doc} @@ ${query} or ${s.works.title} ilike ${"%" + q + "%"})`,
    );
    rank = sql`ts_rank(${doc}, ${query})`;
  }

  const order =
    rank && !f.sort
      ? [desc(rank), asc(s.works.accession)]
      : f.sort === "date"
        ? [sql`${s.works.originalYear} asc nulls last`, asc(s.works.accession)]
        : f.sort === "title"
          ? [asc(s.works.title)]
          : [asc(s.works.accession)];

  const rows = await db
    .select()
    .from(s.works)
    .where(and(...where))
    .orderBy(...order);
  return hydrate(rows);
}

export const getFacets = cache(async () => {
  const visible = sql`w.publication_status in ('published', 'rights_review')`;
  const [categories, subjects, authors, centuries, availability] = await Promise.all([
    db.execute<{ slug: string; name: string; n: number }>(
      sql`select x.slug, x.name, count(w.id)::int n from subjects x left join works w on w.category_id = x.id and ${visible} where x.kind = 'category' group by x.id having count(w.id) > 0 order by x.name`,
    ),
    db.execute<{ slug: string; name: string; n: number }>(
      sql`select x.slug, x.name, count(*)::int n from subjects x join work_subjects ws on ws.subject_id = x.id join works w on w.id = ws.work_id and ${visible} where x.kind = 'subject' group by x.id order by n desc, x.name`,
    ),
    db.execute<{ slug: string; name: string; sort_name: string; n: number }>(
      sql`select a.slug, a.name, a.sort_name, count(*)::int n from authors a join work_authors wa on wa.author_id = a.id and wa.role = 'author' join works w on w.id = wa.work_id and ${visible} group by a.id order by a.sort_name`,
    ),
    db.execute<{ c: number; n: number }>(
      sql`select (w.original_year / 100 + 1)::int c, count(*)::int n from works w where ${visible} and w.original_year is not null group by 1 order by 1`,
    ),
    db.execute<{ k: string; n: number }>(
      sql`select case when w.publication_status <> 'published' then 'record-only' when w.access_level = 'inner' then 'inner' else 'full-text' end k, count(*)::int n from works w where ${visible} group by 1`,
    ),
  ]);
  return {
    categories: [...categories],
    subjects: [...subjects],
    authors: [...authors],
    centuries: [...centuries].map((c) => ({ key: String(c.c), label: centuryLabel(String(c.c)), n: c.n })),
    availability: Object.fromEntries([...availability].map((a) => [a.k, a.n])) as Record<string, number>,
  };
});

export const getStats = cache(async () => {
  const [row] = await db.execute<{ records: number; texts: number; passages: number; words: number; authors: number; earliest: number }>(sql`
    select
      (select count(*) from works where publication_status in ('published','rights_review'))::int records,
      (select count(*) from works where publication_status = 'published')::int texts,
      (select count(*) from passages)::int passages,
      (select coalesce(sum(word_count),0) from works where publication_status = 'published')::int words,
      (select count(distinct author_id) from work_authors)::int authors,
      (select min(original_year) from works where publication_status in ('published','rights_review'))::int earliest
  `);
  return row;
});

export async function getFeatured(limit = 6) {
  const rows = await db
    .select()
    .from(s.works)
    .where(and(eq(s.works.featured, true), inArray(s.works.publicationStatus, VISIBLE)))
    .orderBy(asc(s.works.accession))
    .limit(limit);
  return hydrate(rows);
}

/* ───────────────────────────── Dossier ───────────────────────────── */

export const getDossier = cache(async (slug: string) => {
  const [work] = await db
    .select()
    .from(s.works)
    .where(and(eq(s.works.slug, slug), inArray(s.works.publicationStatus, VISIBLE)))
    .limit(1);
  if (!work) return null;
  const [item] = await hydrate([work]);

  const [editionRows, rights, sectionRows, plates, physical, relatedRows] = await Promise.all([
    db
      .select({ edition: s.editions, source: s.sources })
      .from(s.editions)
      .leftJoin(s.sources, eq(s.sources.editionId, s.editions.id))
      .where(eq(s.editions.workId, work.id)),
    db.select().from(s.rightsRecords).where(eq(s.rightsRecords.workId, work.id)).orderBy(asc(s.rightsRecords.id)),
    db
      .select({
        id: s.sections.id,
        ordinal: s.sections.ordinal,
        title: s.sections.title,
        level: s.sections.level,
        matter: s.sections.matter,
        wordCount: s.sections.wordCount,
      })
      .from(s.sections)
      .where(eq(s.sections.workId, work.id))
      .orderBy(asc(s.sections.ordinal)),
    db.select().from(s.plates).where(eq(s.plates.workId, work.id)).orderBy(asc(s.plates.ordinal)),
    db.select().from(s.physicalEditions).where(eq(s.physicalEditions.workId, work.id)),
    db
      .select({ workId: s.workRelations.toWorkId, note: s.workRelations.note, kind: s.workRelations.kind })
      .from(s.workRelations)
      .where(eq(s.workRelations.fromWorkId, work.id)),
  ]);

  const related = await getRelated(work.id, relatedRows);
  const authorIds = await db
    .select({ id: s.workAuthors.authorId })
    .from(s.workAuthors)
    .where(eq(s.workAuthors.workId, work.id));
  const authorDetails = authorIds.length
    ? await db.select().from(s.authors).where(inArray(s.authors.id, authorIds.map((a) => a.id)))
    : [];

  return {
    work,
    item,
    edition: editionRows[0]?.edition ?? null,
    source: editionRows[0]?.source ?? null,
    rights,
    sections: sectionRows,
    plates,
    physical: physical[0] ?? null,
    related,
    authorDetails,
  };
});

export type Dossier = NonNullable<Awaited<ReturnType<typeof getDossier>>>;

/**
 * Curated relations first (with the curator's note), then records sharing
 * subjects, ranked by overlap. Every related record says why it is related.
 */
async function getRelated(workId: number, curated: { workId: number; note: string | null }[]) {
  const curatedIds = curated.map((c) => c.workId);
  const shared = await db.execute<{ id: number; overlap: number; names: string }>(sql`
    select w.id, count(*)::int overlap, string_agg(x.name, ', ' order by x.name) names
    from work_subjects a
    join work_subjects b on b.subject_id = a.subject_id and b.work_id <> a.work_id
    join works w on w.id = b.work_id and w.publication_status in ('published','rights_review')
    join subjects x on x.id = a.subject_id
    where a.work_id = ${workId}
    group by w.id
    order by overlap desc, w.accession
    limit 8
  `);
  const ids = [...new Set([...curatedIds, ...[...shared].map((r) => r.id)])].slice(0, 8);
  const items = await hydrate(ids.length ? await db.select().from(s.works).where(inArray(s.works.id, ids)) : []);
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids
    .map((id) => {
      const item = byId.get(id);
      if (!item) return null;
      const c = curated.find((x) => x.workId === id);
      const sh = [...shared].find((x) => x.id === id);
      const reason = c ? (c.note ?? "Curatorial link") : `Shares ${sh?.names}`;
      return { item, reason, curated: Boolean(c) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/* ───────────────────────────── Reader ───────────────────────────── */

export async function getSectionText(workId: number, ordinal: number) {
  const [section] = await db
    .select()
    .from(s.sections)
    .where(and(eq(s.sections.workId, workId), eq(s.sections.ordinal, ordinal)))
    .limit(1);
  if (!section) return null;
  const passages = await db
    .select({ id: s.passages.id, kind: s.passages.kind, text: s.passages.text })
    .from(s.passages)
    .where(eq(s.passages.sectionId, section.id))
    .orderBy(asc(s.passages.ordinal));
  return { section, passages };
}

export async function locatePassage(id: string) {
  const [row] = await db
    .select({ slug: s.works.slug, ordinal: s.sections.ordinal })
    .from(s.passages)
    .innerJoin(s.sections, eq(s.sections.id, s.passages.sectionId))
    .innerJoin(s.works, eq(s.works.id, s.passages.workId))
    .where(eq(s.passages.id, id))
    .limit(1);
  return row ?? null;
}

/** Search within a single work: returns matching passages with their section. */
export async function searchWithinWork(workId: number, q: string, limit = 60) {
  const query = sql`websearch_to_tsquery('english', unaccent_immutable(${q}))`;
  const rows = await db.execute<{ id: string; section: number; section_title: string; snippet: string }>(sql`
    select p.id, sec.ordinal section, sec.title section_title,
      ts_headline('english', p.text, ${query}, 'StartSel=<mark>,StopSel=</mark>,MaxWords=34,MinWords=16,MaxFragments=1') snippet
    from passages p join sections sec on sec.id = p.section_id
    where p.work_id = ${workId} and p.search @@ ${query}
    order by p.ordinal
    limit ${limit}
  `);
  return [...rows];
}

/* ───────────────────────────── Authors & subjects ───────────────────────────── */

export async function getAuthor(slug: string) {
  const [author] = await db.select().from(s.authors).where(eq(s.authors.slug, slug)).limit(1);
  if (!author) return null;
  const rows = await db
    .select({ work: s.works, role: s.workAuthors.role })
    .from(s.workAuthors)
    .innerJoin(s.works, eq(s.works.id, s.workAuthors.workId))
    .where(and(eq(s.workAuthors.authorId, author.id), inArray(s.works.publicationStatus, VISIBLE)))
    .orderBy(asc(s.works.accession));
  const works = await hydrate(rows.map((r) => r.work));
  const roles = new Map(rows.map((r) => [r.work.id, r.role]));
  // Authors who share subjects with this author's works — the next step in the trail.
  const neighbours = await db.execute<{ slug: string; name: string; overlap: number }>(sql`
    select a2.slug, a2.name, count(distinct ws2.subject_id)::int overlap
    from work_authors wa
    join work_subjects ws on ws.work_id = wa.work_id
    join work_subjects ws2 on ws2.subject_id = ws.subject_id and ws2.work_id <> ws.work_id
    join work_authors wa2 on wa2.work_id = ws2.work_id and wa2.role = 'author'
    join authors a2 on a2.id = wa2.author_id and a2.id <> ${author.id}
    join works w on w.id = ws2.work_id and w.publication_status in ('published','rights_review')
    where wa.author_id = ${author.id}
    group by a2.id order by overlap desc, a2.sort_name limit 6
  `);
  return { author, works: works.map((w) => ({ ...w, role: roles.get(w.id) ?? "author" })), neighbours: [...neighbours] };
}

export async function getSubject(slug: string) {
  const [subject] = await db.select().from(s.subjects).where(eq(s.subjects.slug, slug)).limit(1);
  if (!subject) return null;
  const works = await listWorks(subject.kind === "category" ? { category: slug } : { subject: slug });
  const neighbours = await db.execute<{ slug: string; name: string; n: number }>(sql`
    select x2.slug, x2.name, count(*)::int n
    from work_subjects ws
    join work_subjects ws2 on ws2.work_id = ws.work_id and ws2.subject_id <> ws.subject_id
    join subjects x2 on x2.id = ws2.subject_id
    where ws.subject_id = ${subject.id}
    group by x2.id order by n desc, x2.name limit 10
  `);
  return { subject, works, neighbours: [...neighbours] };
}

export async function listAuthors() {
  const rows = await db.execute<{ slug: string; name: string; birth_year: number | null; death_year: number | null; n: number }>(sql`
    select a.slug, a.name, a.birth_year, a.death_year, count(w.id)::int n
    from authors a join work_authors wa on wa.author_id = a.id
    join works w on w.id = wa.work_id and w.publication_status in ('published','rights_review')
    group by a.id order by a.sort_name
  `);
  return [...rows];
}

export function lifeDates(birth: number | null, death: number | null) {
  if (birth && death) return `${birth}–${death}`;
  if (death) return `d. ${death}`;
  if (birth) return `b. ${birth}`;
  return null;
}
