/**
 * Restricted Press — data model.
 *
 * Catalogue:   works ← editions ← sources, with authors/subjects attached to
 *              works and rights recorded per component (text, translation,
 *              introduction, illustrations...). Full text is stored as
 *              sections → passages; passages are the unit of search,
 *              citation and saving, and carry stable IDs.
 * Readers:     Better Auth tables (user/session/account/verification) plus
 *              entitlements, collections, saved passages and research sessions.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ────────────────────────────── Catalogue ────────────────────────────── */

export const authors = pgTable("authors", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortName: text("sort_name").notNull(),
  birthYear: integer("birth_year"),
  deathYear: integer("death_year"),
  /** Short biographical note. */
  note: text("note"),
  /** "curatorial_draft" until a human editor has reviewed the prose. */
  noteStatus: text("note_status").notNull().default("curatorial_draft"),
  ...timestamps,
});

/** Categories (broad shelves) and subjects (finer headings) share one table. */
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").$type<"category" | "subject">().notNull(),
  description: text("description"),
});

export type PublicationStatus = "draft" | "rights_review" | "published" | "withheld";

export const works = pgTable(
  "works",
  {
    id: serial("id").primaryKey(),
    /** Accession number, displayed as FILE 0017. Never reused. */
    accession: integer("accession").notNull().unique(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    /** Year the work first appeared, where known. */
    originalYear: integer("original_year"),
    /** How originalYear was established: title_page | curatorial | unknown. */
    originalYearBasis: text("original_year_basis").notNull().default("unknown"),
    originalLanguage: text("original_language"),
    categoryId: integer("category_id").references(() => subjects.id),
    summary: text("summary"),
    historicalContext: text("historical_context"),
    archivistNotes: text("archivist_notes"),
    /** Editorial prose status: curatorial_draft | reviewed. */
    contentStatus: text("content_status").notNull().default("curatorial_draft"),
    publicationStatus: text("publication_status").$type<PublicationStatus>().notNull().default("draft"),
    /** open: anyone may read. inner: Inner Archive members only. */
    accessLevel: text("access_level").$type<"open" | "inner">().notNull().default("open"),
    featured: boolean("featured").notNull().default(false),
    /** Suggested research questions shown on the dossier. */
    archivistQuestions: jsonb("archivist_questions").$type<string[]>().notNull().default([]),
    wordCount: integer("word_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("works_status_idx").on(t.publicationStatus)],
);

export const workAuthors = pgTable(
  "work_authors",
  {
    workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
    authorId: integer("author_id").notNull().references(() => authors.id, { onDelete: "cascade" }),
    /** author | translator | editor | introducer */
    role: text("role").notNull().default("author"),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workId, t.authorId, t.role] })],
);

export const workSubjects = pgTable(
  "work_subjects",
  {
    workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.workId, t.subjectId] })],
);

/** A specific printed edition; the archive text is transcribed from one of these. */
export const editions = pgTable("editions", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  publisher: text("publisher"),
  place: text("place"),
  year: integer("year"),
  yearBasis: text("year_basis").notNull().default("unknown"),
  editionStatement: text("edition_statement"),
  /** Exact imprint as it appears on the title page, where transcribed. */
  imprint: text("imprint"),
  notes: text("notes"),
  isArchiveText: boolean("is_archive_text").notNull().default(true),
});

/** Where the digital text came from. */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  editionId: integer("edition_id").notNull().references(() => editions.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("transcription"),
  provider: text("provider").notNull(),
  identifier: text("identifier"),
  url: text("url"),
  retrievedFrom: text("retrieved_from"),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
  checksum: text("checksum"),
  transcriptionNotes: text("transcription_notes"),
  /** Library-of-Congress subject headings etc. recorded by the provider. */
  providerSubjects: jsonb("provider_subjects").$type<string[]>().notNull().default([]),
});

export type RightsStatus =
  | "public_domain_us"
  | "public_domain_worldwide"
  | "needs_review"
  | "restricted"
  | "licensed";

/** Rights are recorded per component — never per book. */
export const rightsRecords = pgTable("rights_records", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
  /** text | translation | introduction | illustrations | annotations | edition */
  component: text("component").notNull(),
  status: text("status").$type<RightsStatus>().notNull(),
  confidence: text("confidence").$type<"high" | "medium" | "low">().notNull(),
  jurisdiction: text("jurisdiction").notNull().default("US"),
  basis: text("basis").notNull(),
  notes: text("notes"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const sections = pgTable(
  "sections",
  {
    id: serial("id").primaryKey(),
    workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    title: text("title").notNull(),
    /** 1 = part/chapter, 2 = subsection. */
    level: integer("level").notNull().default(1),
    /** front | body | back */
    matter: text("matter").notNull().default("body"),
    wordCount: integer("word_count").notNull().default(0),
  },
  (t) => [uniqueIndex("sections_work_ordinal").on(t.workId, t.ordinal)],
);

/**
 * The atomic unit of the archive. id is stable and human-readable:
 * "{accession}.{section}.{paragraph}", e.g. "0017.003.0012".
 */
export const passages = pgTable(
  "passages",
  {
    id: text("id").primaryKey(),
    workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
    sectionId: integer("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
    /** Order within the work. */
    ordinal: integer("ordinal").notNull(),
    /** paragraph | verse | heading | note | table */
    kind: text("kind").notNull().default("paragraph"),
    text: text("text").notNull(),
    wordCount: integer("word_count").notNull(),
    search: tsvector("search").generatedAlwaysAs(sql`to_tsvector('english', unaccent_immutable(text))`),
  },
  (t) => [
    index("passages_search_idx").using("gin", t.search),
    index("passages_work_ordinal_idx").on(t.workId, t.ordinal),
  ],
);

export const workRelations = pgTable(
  "work_relations",
  {
    fromWorkId: integer("from_work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
    toWorkId: integer("to_work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
    /** related | responds_to | cites | same_tradition */
    kind: text("kind").notNull().default("related"),
    note: text("note"),
    basis: text("basis").notNull().default("curatorial"),
  },
  (t) => [primaryKey({ columns: [t.fromWorkId, t.toWorkId, t.kind] })],
);

/** Plates, title pages and illustrations. */
export const plates = pgTable("plates", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  caption: text("caption"),
  ordinal: integer("ordinal").notNull().default(0),
});

/** Restricted Editions — physical books. Prices live here, per edition. */
export const physicalEditions = pgTable("physical_editions", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
  /** planned | available | sold_out */
  status: text("status").notNull().default("planned"),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents"),
  currency: text("currency").notNull().default("USD"),
});

/* ──────────────────────────── Better Auth ──────────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ─────────────────────────────── Readers ─────────────────────────────── */

/**
 * What a reader is entitled to. A row with plan "inner" and status "active"
 * grants Inner Archive features; source records how it was granted
 * (dev | stripe | seal | comp) so payments and Archive Seals can plug in later.
 */
export const entitlements = pgTable(
  "entitlements",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    status: text("status").notNull().default("active"),
    source: text("source").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("entitlements_user_idx").on(t.userId)],
);

/** Saved records (the personal library). */
export const savedWorks = pgTable(
  "saved_works",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workId] })],
);

export const savedPassages = pgTable(
  "saved_passages",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    passageId: text("passage_id").notNull().references(() => passages.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_passages_user_passage").on(t.userId, t.passageId)],
);

/** Every Archivist exchange; also the basis for free-tier quotas. */
export const researchQueries = pgTable(
  "research_queries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** Anonymous visitor id from a cookie, for visitors without accounts. */
    visitorId: text("visitor_id"),
    /** Salted hash of the client address, so clearing cookies does not reset a visitor's quota. */
    clientHash: text("client_hash"),
    question: text("question").notNull(),
    mode: text("mode").notNull(),
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("research_queries_user_idx").on(t.userId, t.createdAt),
    index("research_queries_visitor_idx").on(t.visitorId, t.createdAt),
    index("research_queries_client_idx").on(t.clientHash, t.createdAt),
  ],
);
