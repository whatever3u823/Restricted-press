/**
 * Language-model providers for the Archivist.
 *
 * The pipeline depends only on this interface. A provider receives the
 * question and the retrieved passages, and must return answer spans whose
 * citations refer to those passages by index — it never returns passage text
 * of its own. Quoted text shown to readers is always taken from the archive.
 */
import type { ArchivistMode } from "./types";

export type ProviderPassage = {
  /** Label shown to the model, e.g. "FILE 0006 — The Kybalion (1908), Chapter II". */
  title: string;
  /** Stable reference, e.g. the passage URL. */
  source: string;
  /** The passage split into citable sentences. */
  sentences: string[];
};

export type ProviderSpan = {
  text: string;
  /** Citations as (passage index, first sentence, end sentence exclusive). */
  citations: { passage: number; start: number; end: number }[];
};

export type ProviderAnswer = {
  spans: ProviderSpan[];
  model: string;
  stopReason: string | null;
};

export type QueryPlan = {
  /** Concepts to search, each with historical synonyms or spellings. */
  concepts: { term: string; variants: string[] }[];
  /** Titles or authors the question names, if any. */
  mentions: string[];
  intent: "find" | "explain" | "compare" | "trace";
};

export interface AnswerProvider {
  readonly name: string;
  readonly model: string;
  plan(question: string): Promise<QueryPlan | null>;
  answer(input: { question: string; mode: ArchivistMode; passages: ProviderPassage[] }): Promise<ProviderAnswer>;
}
