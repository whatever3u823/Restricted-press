/**
 * Language-model providers for the Archivist.
 *
 * The pipeline depends only on this interface. A provider receives the
 * question and the retrieved passages, and must return answer spans whose
 * citations refer to those passages by index — it never returns passage text
 * of its own. Quoted text shown to readers is always taken from the library.
 */
import type { ArchivistMode } from "./types";

export type ProviderPassage = {
  /** Label shown to the model, e.g. "The Prince — Machiavelli — Chapter XVIII — p. 71". */
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
  /** Concepts to search, each with synonyms and related vocabulary. */
  concepts: { term: string; variants: string[] }[];
  /** Documents in the library the question names, by their exact catalogue titles. */
  mentions: string[];
  intent: "find" | "explain" | "compare" | "trace";
};

export type CatalogueEntry = { abstract: string; subjects: string[] };

export interface AnswerProvider {
  readonly name: string;
  readonly model: string;
  /** Plan a search of the library. `catalogue` lists the reader's documents as "Title — Author". */
  plan(question: string, catalogue: string[]): Promise<QueryPlan | null>;
  answer(input: { question: string; mode: ArchivistMode; passages: ProviderPassage[] }): Promise<ProviderAnswer>;
  /** Write a short catalogue entry for a newly arrived document. */
  catalogue?(input: { title: string; author: string | null; excerpt: string }): Promise<CatalogueEntry | null>;
}
