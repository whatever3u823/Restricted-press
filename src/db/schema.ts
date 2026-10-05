/**
 * Athenaeum — data model.
 *
 * Library:   every document belongs to one reader. Its extracted text is
 *            stored as sections → passages; passages are the unit of search,
 *            citation and highlighting, and carry stable IDs
 *            "{document}.{section}.{paragraph}". Collections organise
 *            documents; highlights keep passages with the reader's notes.
 * Accounts:  Better Auth tables (user/session/account/verification) plus
 *            entitlements (plans) and the Archivist's query history.
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
 * What a reader is entitled to. A row with plan "fellow" and status "active"
 * grants Fellowship features; source records how it was granted
 * (dev | stripe | comp) so payments can plug in later.
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

/** Every Archivist exchange; also the basis for free-tier quotas. */
export const researchQueries = pgTable(
  "research_queries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    question: text("question").notNull(),
    mode: text("mode").notNull(),
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("research_queries_user_idx").on(t.userId, t.createdAt),
  ],
);


/* ─────────────────────────────── Library ─────────────────────────────── */

export type DocumentKind = "book" | "article" | "paper" | "notes" | "other";
export type ReadingStatus = "unread" | "reading" | "finished";
export type KeyTerm = { term: string; n: number };

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Free text; several authors separated by semicolons. */
    author: text("author"),
    year: integer("year"),
    kind: text("kind").$type<DocumentKind>().notNull().default("book"),
    /** Source format of the upload: pdf | epub | docx | txt | md | html. */
    format: text("format").notNull(),
    filename: text("filename"),
    /** processing while sections are still arriving; ready once complete. */
    status: text("status").$type<"processing" | "ready">().notNull().default("processing"),
    readingStatus: text("reading_status").$type<ReadingStatus>().notNull().default("unread"),
    /** The Archivist's catalogue entry, written on arrival when a model is configured. */
    abstract: text("abstract"),
    subjects: jsonb("subjects").$type<string[]>().notNull().default([]),
    /** The document's most characteristic words, for connections between documents. */
    keyTerms: jsonb("key_terms").$type<KeyTerm[]>().notNull().default([]),
    /** The reader's own notes on the document. */
    notes: text("notes"),
    wordCount: integer("word_count").notNull().default(0),
    sectionCount: integer("section_count").notNull().default(0),
    lastSection: integer("last_section"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("documents_owner_idx").on(t.ownerId, t.createdAt)],
);

export const sections = pgTable(
  "sections",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    title: text("title").notNull(),
    /** 1 = part/chapter, 2 = subsection. */
    level: integer("level").notNull().default(1),
    wordCount: integer("word_count").notNull().default(0),
  },
  (t) => [uniqueIndex("sections_document_ordinal").on(t.documentId, t.ordinal)],
);

/**
 * The atomic unit of the library. id is stable and human-readable:
 * "{document}.{section}.{paragraph}", e.g. "42.003.0012".
 */
export const passages = pgTable(
  "passages",
  {
    id: text("id").primaryKey(),
    documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    sectionId: integer("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
    /** Denormalised so every search is scoped to its owner without a join. */
    ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    /** Order within the document. */
    ordinal: integer("ordinal").notNull(),
    /** paragraph | heading | verse | quote | code */
    kind: text("kind").notNull().default("paragraph"),
    text: text("text").notNull(),
    wordCount: integer("word_count").notNull(),
    /** Page in the original file, where the format has pages (PDF). */
    page: integer("page"),
    search: tsvector("search").generatedAlwaysAs(sql`to_tsvector('english', unaccent_immutable(text))`),
  },
  (t) => [
    index("passages_search_idx").using("gin", t.search),
    index("passages_document_ordinal_idx").on(t.documentId, t.ordinal),
    index("passages_owner_idx").on(t.ownerId),
  ],
);

export const collections = pgTable(
  "collections",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("collections_owner_name").on(t.ownerId, t.name)],
);

export const collectionDocuments = pgTable(
  "collection_documents",
  {
    collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
    documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.documentId] })],
);

/** Passages the reader has marked, with optional notes. */
export const highlights = pgTable(
  "highlights",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    passageId: text("passage_id").notNull().references(() => passages.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("highlights_user_passage").on(t.userId, t.passageId)],
);
