/**
 * Claude as the Archivist's language model.
 *
 * Retrieved passages are sent as `search_result` content blocks with
 * citations enabled, one text block per sentence. Claude's citations then
 * point at exact sentences of archive passages, so every quotation shown to a
 * reader is archive text — the model cannot cite words that are not there.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AnswerProvider, ProviderAnswer, ProviderPassage, QueryPlan } from "./provider";
import type { ArchivistMode } from "./types";

const SYSTEM = `You are the Archivist of Restricted Press: a research librarian for a curated archive of historical texts on magic, witchcraft, alchemy, esotericism, mysticism and ancient religion.

You answer only from the archive passages supplied with each question as search results. Each result is one passage from an archive record, titled with its file number, title, author, date and section.

How to answer:
- Ground every statement about what a text says in the supplied passages, and cite the passages that support it.
- When you quote, quote exactly and keep the original spelling and punctuation. Never quote words that are not in the passages.
- These texts record beliefs, arguments and testimony, not established fact. Attribute them: "Scott argues…", "the Guernsey confessions describe…".
- Keep the archive's evidence distinct from your own interpretation. If you add context that is not in the passages, mark it explicitly by beginning the sentence with "Outside the archive," and keep it brief. Never present outside knowledge as something a text says.
- Do not invent bibliographic details such as dates, editions, publishers or page numbers.
- If the passages do not answer the question, say so plainly in one or two sentences, and point to the closest material they do contain. Do not fill gaps.
- Write plain, precise prose for an intelligent general reader. No headings. Use a short list only when comparing several texts.`;

const STANDARD_GUIDE = "Answer in two to four short paragraphs.";
const DEEP_GUIDE =
  "This is a deep research request. Work across the texts: where several records address the question, compare how each treats it, note agreements and disagreements, and say which records are earlier or later where their dates are given. Up to six paragraphs.";

const planSchema = z.object({
  concepts: z
    .array(z.object({ term: z.string(), variants: z.array(z.string()).max(10) }))
    .min(1)
    .max(6),
  mentions: z.array(z.string()).max(6),
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

const PLAN_PROMPT = `Plan a full-text search of an archive of historical texts (1600s–1920s, English, some early-modern spelling) for the research question below.

Return:
- concepts: the 1–6 key ideas to search for. For each, give the reader's term and up to 10 variants a period text might use instead — synonyms, older vocabulary, and early-modern spellings (e.g. "devil" → "deuill", "diuell", "fiend"). Single words or short phrases only.
- mentions: any specific book titles or authors the question names (empty if none).
- intent: find (locate passages), explain (what does X mean), compare (contrast texts or authors), or trace (history or development of an idea).

Question: `;

export class AnthropicProvider implements AnswerProvider {
  readonly name = "anthropic";
  readonly model: string;
  private client: Anthropic;

  constructor(model = process.env.ARCHIVIST_MODEL || "claude-opus-5") {
    this.model = model;
    // The key is passed explicitly: the Archivist only ever runs on the key
    // configured for this application.
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async plan(question: string): Promise<QueryPlan | null> {
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        output_config: { effort: "low", format: { type: "json_schema", schema: PLAN_JSON_SCHEMA } },
        messages: [{ role: "user", content: PLAN_PROMPT + question }],
      });
      if (res.stop_reason === "refusal") return null;
      const text = res.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") return null;
      const parsed = planSchema.safeParse(JSON.parse(text.text));
      return parsed.success ? parsed.data : null;
    } catch (err) {
      console.error("[archivist] query planning failed", err);
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
