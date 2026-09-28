/**
 * The curated archive record — one YAML file per work in content/works/.
 * This is the human-reviewable source of truth for metadata, provenance and
 * rights. The ingestion script validates it with this schema.
 */
import { z } from "zod";

const rightsComponent = z.object({
  component: z.enum(["text", "translation", "introduction", "illustrations", "annotations", "edition"]),
  status: z.enum(["public_domain_us", "public_domain_worldwide", "needs_review", "restricted", "licensed"]),
  confidence: z.enum(["high", "medium", "low"]),
  jurisdiction: z.string().default("US"),
  basis: z.string(),
  notes: z.string().optional(),
  reviewed_by: z.string().optional(),
  reviewed_at: z.string().optional(),
});

const yearBasis = z.enum(["title_page", "curatorial", "unknown"]);

export const workRecordSchema = z.object({
  accession: z.number().int().positive(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  subtitle: z.string().optional(),
  authors: z
    .array(z.object({ slug: z.string(), role: z.enum(["author", "translator", "editor", "introducer"]).default("author") }))
    .min(1),
  category: z.string(),
  subjects: z.array(z.string()).default([]),
  original_year: z.number().int().optional(),
  original_year_basis: yearBasis.default("unknown"),
  original_language: z.string().optional(),
  publication_status: z.enum(["draft", "rights_review", "published", "withheld"]),
  access_level: z.enum(["open", "inner"]).default("open"),
  featured: z.boolean().default(false),
  content_status: z.enum(["curatorial_draft", "reviewed"]).default("curatorial_draft"),
  summary: z.string(),
  historical_context: z.string().optional(),
  archivist_notes: z.string().optional(),
  archivist_questions: z.array(z.string()).default([]),
  edition: z.object({
    label: z.string(),
    publisher: z.string().optional(),
    place: z.string().optional(),
    year: z.number().int().optional(),
    year_basis: yearBasis.default("unknown"),
    edition_statement: z.string().optional(),
    imprint: z.string().optional(),
    notes: z.string().optional(),
  }),
  source: z.object({
    provider: z.string(),
    identifier: z.string(),
    url: z.string().url(),
    /** Raw file to fetch. */
    fetch_url: z.string().url(),
    encoding: z.enum(["utf-8", "latin1"]).default("utf-8"),
    transcription_notes: z.string().optional(),
    provider_subjects: z.array(z.string()).default([]),
  }),
  rights: z.array(rightsComponent).min(1),
  structure: z
    .object({
      /** Regex matching the first paragraph of the body. Earlier text is front matter. */
      body_start: z.string().optional(),
      /** Which match of body_start to use (to skip a table of contents). */
      body_start_occurrence: z.number().int().default(1),
      /** Regex for level-1 headings (tested against single-line paragraphs). */
      heading: z.string(),
      /** Regex for level-2 headings. */
      subheading: z.string().optional(),
      /** When the heading is only a number ("CHAPTER IV"), take the next short line as its title. */
      heading_title_next: z.boolean().default(false),
      /** Regex: text from the matching paragraph onward is dropped (indexes, advertisements). */
      end_at: z.string().optional(),
      /** Literal paragraphs to drop anywhere (e.g. page furniture). */
      drop: z.array(z.string()).default([]),
    })
    .optional(),
  related: z
    .array(z.object({ slug: z.string(), kind: z.string().default("related"), note: z.string().optional() }))
    .default([]),
  plates: z.array(z.object({ path: z.string(), caption: z.string() })).default([]),
  physical_edition: z
    .object({
      name: z.string(),
      status: z.enum(["planned", "available", "sold_out"]),
      description: z.string().optional(),
      price_cents: z.number().int().optional(),
    })
    .optional(),
});

export type WorkRecord = z.infer<typeof workRecordSchema>;

export const authorRecordSchema = z.object({
  slug: z.string(),
  name: z.string(),
  sort_name: z.string(),
  birth_year: z.number().int().optional(),
  death_year: z.number().int().optional(),
  note: z.string().optional(),
});

export const subjectRecordSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: z.enum(["category", "subject"]),
  description: z.string().optional(),
});
