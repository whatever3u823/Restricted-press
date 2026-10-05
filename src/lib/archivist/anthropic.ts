/**
 * Claude as the Archivist's language model.
 *
 * Retrieved passages are sent as `search_result` content blocks with
 * citations enabled, one text block per sentence. Claude's citations then
 * point at exact sentences of the reader's documents, so every quotation
 * shown is library text — the model cannot cite words that are not there.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AnswerProvider, CatalogueEntry, ProviderAnswer, ProviderPassage, QueryPlan } from "./provider";
import type { ArchivistMode } from "./types";

const SYSTEM = `You are the Archivist of Athenaeum: the private librarian of one reader's personal library — the books, articles, research papers and notes they have collected and uploaded. You have perfect recall of that library, and you serve one purpose: to sharpen the reader's research.

You answer only from the library passages supplied with each question as search results. Each result is one passage, titled with its document's title, author, date where known, section and page.

How to answer:
- Ground every statement about what a document says in the supplied passages, and cite the passages that support it.
- When you quote, quote exactly. Never quote words that are not in the passages.
- Attribute claims to their authors: "Machiavelli argues…", "the 2019 survey reports…". Treat the documents as arguments and evidence, not as settled fact.
- Look for connections the reader may not have seen: where different authors agree, disagree, build on or answer one another, say so plainly and cite both sides.
- Keep the library's evidence distinct from your own knowledge. If you add context that is not in the passages, mark it explicitly by beginning the sentence with "Outside your library," and keep it brief. Never present outside knowledge as something a document says.
- Do not invent bibliographic details such as dates, editions, publishers or page numbers.
- If the passages do not answer the question, say so plainly in one or two sentences, and point to the closest material they do contain. Do not fill gaps.
- Write with precision and economy, for an intelligent reader who values their time. No headings, no preamble. Use a short list only when comparing several documents.`;

const STANDARD_GUIDE = "Answer in two to four short paragraphs.";
const DEEP_GUIDE =
  "This is a deep research request. Work across the documents: where several address the question, compare how each treats it, note agreements, tensions and lines of influence between authors, and say which are earlier or later where their dates are given. Up to six paragraphs.";

const planSchema = z.object({
  concepts: z
    .array(z.object({ term: z.string(), variants: z.array(z.string()).max(12) }))
    .min(1)
    .max(6),
  mentions: z.array(z.string()).max(8),
  intent: z.enum(["find", "explain", "compare", "trace"]),
});

const PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["concepts", "mentions", "intent"],
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "variants"],
        properties: {
          term: { type: "string" },
          variants: { type: "array", items: { type: "string" } },
        },
      },
    },
    mentions: { type: "array", items: { type: "string" } },
    intent: { type: "string", enum: ["find", "explain", "compare", "trace"] },
  },
} as const;

const PLAN_PROMPT = `Plan a full-text keyword search of a reader's personal library for the research question below. The search engine matches words (with English stemming), not meanings, so your terms must be words that would literally appear in a passage that answers the question.

Return:
- concepts: the 1–6 key ideas to search for. For each, give the reader's term and up to 12 variants a document might use instead — synonyms, technical vocabulary, related terms, abbreviations, names. Single words or short phrases only.
- mentions: documents from the catalogue below that the question refers to, by title or author — copy each title exactly as catalogued. Empty if none.
- intent: find (locate passages), explain (what does X mean), compare (contrast documents or authors), or trace (history or development of an idea).

Catalogue (Title — Author):
`;

const catalogueSchema = z.object({
  abstract: z.string().min(10).max(1200),
  subjects: z.array(z.string().min(2).max(60)).min(1).max(8),
});

const CATALOGUE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["abstract", "subjects"],
  properties: {
    abstract: { type: "string" },
    subjects: { type: "array", items: { type: "string" } },
  },
} as const;

export class AnthropicProvider implements AnswerProvider {
  readonly name = "anthropic";
  readonly model: string;
  private client: Anthropic;

  constructor(model = process.env.ARCHIVIST_MODEL || "claude-opus-5-5") {
    this.model = model;
    // The key is passed explicitly: the Archivist only ever runs on the key
    // configured for this application.
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  private async json(prompt: string, schema: Record<string, unknown>) {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal") return null;
    const text = res.content.find((b) => b.type === "text");
    return text && text.type === "text" ? JSON.parse(text.text) : null;
  }

  async plan(question: string, catalogue: string[]): Promise<QueryPlan | null> {
    try {
      const listing = catalogue.slice(0, 400).join("\n") || "(empty)";
      const raw = await this.json(`${PLAN_PROMPT}${listing}\n\nQuestion: ${question}`, PLAN_JSON_SCHEMA);
      const parsed = planSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    } catch (err) {
      console.error("[archivist] query planning failed", err);
      return null;
    }
  }

  async catalogue({ title, author, excerpt }: { title: string; author: string | null; excerpt: string }): Promise<CatalogueEntry | null> {
    try {
      const raw = await this.json(
        `You are cataloguing a document that has just arrived in a reader's private library. From the excerpt below, write:
- abstract: two or three sentences saying what the document is and what it argues or covers, written plainly for the reader who owns it. Do not begin with "This document".
- subjects: three to six short subject headings (e.g. "Stoicism", "Political realism", "Transformer models").

Title: ${title}
Author: ${author ?? "unknown"}

Excerpt:
${excerpt}`,
        CATALOGUE_JSON_SCHEMA,
      );
      const parsed = catalogueSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    } catch (err) {
      console.error("[archivist] cataloguing failed", err);
      return null;
    }
  }

  async answer({
    question,
    mode,
    passages,
  }: {
    question: string;
    mode: ArchivistMode;
    passages: ProviderPassage[];
  }): Promise<ProviderAnswer> {
    const results: Anthropic.Beta.BetaSearchResultBlockParam[] = passages.map((p) => ({
      type: "search_result",
      source: p.source,
      title: p.title,
      content: p.sentences.map((text) => ({ type: "text" as const, text })),
      citations: { enabled: true },
    }));

    const res = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: mode === "deep" ? "high" : "medium" },
      messages: [
        {
          role: "user",
          content: [
            ...results,
            { type: "text", text: `${mode === "deep" ? DEEP_GUIDE : STANDARD_GUIDE}\n\nQuestion: ${question}` },
          ],
        },
      ],
    });

    if (res.stop_reason === "refusal") {
      return {
        spans: [{ text: "The Archivist declined to answer this question.", citations: [] }],
        model: res.model,
        stopReason: "refusal",
      };
    }

    const spans = res.content.flatMap((block) => {
      if (block.type !== "text") return [];
      const citations = (block.citations ?? []).flatMap((c) =>
        c.type === "search_result_location"
          ? [{ passage: c.search_result_index, start: c.start_block_index, end: c.end_block_index }]
          : [],
      );
      return [{ text: block.text, citations }];
    });

    return { spans, model: res.model, stopReason: res.stop_reason };
  }
}
