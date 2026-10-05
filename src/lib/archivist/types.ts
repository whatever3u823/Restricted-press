/** Shapes shared by the Archivist pipeline, API and UI. */

export type ArchivistMode = "standard" | "deep";

export type AnswerSpan = {
  text: string;
  /** Source numbers (1-based, matching `sources[].n`) that support this span. */
  cites: number[];
};

export type AnswerSource = {
  n: number;
  passageId: string;
  documentId: number;
  title: string;
  author: string | null;
  year: number | null;
  sectionOrdinal: number;
  sectionTitle: string;
  page: number | null;
  /** The full passage as stored in the library. */
  text: string;
  /** Exact sentences the answer cites from this passage. Always substrings of `text`. */
  quoted: string[];
};

export type ArchivistStatus =
  | "answered" // generated answer with citations
  | "insufficient" // the library does not support an answer
  | "retrieval_only" // no language model configured: passages only
  | "no_results";

export type ArchivistResult = {
  id?: number;
  question: string;
  mode: ArchivistMode;
  status: ArchivistStatus;
  /** Paragraphs of spans. Empty in retrieval-only mode. */
  paragraphs: AnswerSpan[][];
  /** Passages cited in the answer, numbered in order of first citation. */
  sources: AnswerSource[];
  /** Passages retrieved but not cited — shown as "also consulted". */
  consulted: AnswerSource[];
  /** The terms the library was searched for. */
  searchedFor: string[];
  /** Documents the question was confined to, if any. */
  scope: { id: number; title: string }[];
  /** Integrity notes, e.g. a quotation that could not be verified. */
  notes: string[];
  model: string | null;
  elapsedMs: number;
};

export type QuotaState = {
  plan: "member" | "fellow";
  limit: number | null;
  used: number;
  remaining: number | null;
};
