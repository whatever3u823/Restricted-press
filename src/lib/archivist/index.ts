/**
 * The Archivist: question → understanding → retrieval → answer → verification.
 *
 *   1. Understand   map the question onto search concepts (the reader's
 *                   words, widened by a model-written search plan when a
 *                   model is configured) and detect documents it names.
 *   2. Retrieve     gather passages from the reader's library only.
 *   3. Answer       the provider answers from those passages only, citing
 *                   them sentence by sentence.
 *   4. Verify       every quotation shown is library text; citations that do
 *                   not resolve are dropped; unsupported quotations are flagged.
 *
 * With no language model configured the Archivist returns step 2 only
 * ("retrieval only"), which is still a useful, honest answer.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, passages, sections } from "@/db/schema";
import { ARCHIVIST } from "@/lib/config";
import { getPassageHits, retriever, type PassageHit } from "@/lib/search/retriever";
import { toConcepts, type Concept } from "@/lib/search/query";
import { AnthropicProvider } from "./anthropic";
import type { AnswerProvider, ProviderPassage, QueryPlan } from "./provider";
import type { AnswerSource, AnswerSpan, ArchivistMode, ArchivistResult } from "./types";

export function getProvider(): AnswerProvider | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new AnthropicProvider();
}

export function archivistConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/* ───────────────────────────── Understanding ───────────────────────────── */

type DocKey = { id: number; title: string; author: string | null; keys: string[] };

const SURNAME_STOP = new Set(["jr", "sr", "ed", "eds", "trans", "et", "al", "and", "the", "von", "van", "de"]);

async function libraryKeys(ownerId: string): Promise<DocKey[]> {
  const rows = await db
    .select({ id: documents.id, title: documents.title, author: documents.author })
    .from(documents)
    .where(and(eq(documents.ownerId, ownerId), eq(documents.status, "ready")));
  return rows.map((r) => {
    const title = r.title.toLowerCase();
    const keys = [title];
    // "Meditations: A New Translation" is recognised by "meditations".
    const main = title.split(/[:—–(]/)[0].trim();
    if (main.length >= 6 && main !== title) keys.push(main);
    for (const name of (r.author ?? "").split(/;|\band\b|&/)) {
      const parts = name.trim().toLowerCase().split(/[\s,]+/).filter((p) => p.length > 3 && !SURNAME_STOP.has(p));
      // "Aurelius, Marcus" and "Marcus Aurelius" both yield "aurelius".
      const surname = name.includes(",") ? parts[0] : parts[parts.length - 1];
      if (surname) keys.push(surname);
    }
    return { id: r.id, title: r.title, author: r.author, keys: [...new Set(keys)] };
  });
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function detectMentions(question: string, keys: DocKey[], planned: string[] = []) {
  const q = ` ${question.toLowerCase()} `;
  const found = new Map<number, DocKey>();
  for (const k of keys) {
    for (const key of k.keys) {
      if (new RegExp(`[^\\p{L}]${escape(key)}('s)?[^\\p{L}]`, "u").test(q)) found.set(k.id, k);
    }
    for (const m of planned) {
      if (k.title.toLowerCase() === m.toLowerCase().trim()) found.set(k.id, k);
    }
  }
  return [...found.values()];
}

/* ───────────────────────────── Passages for the model ───────────────────────────── */

/** Split a passage into citable sentences, conservatively. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/(?<=[.!?]["”’)\]]?)\s+(?=["“‘(\[_]?[\p{Lu}0-9])/u)) {
    if (part.split(/\s+/).length > 90) out.push(...part.split(/(?<=;)\s+/));
    else out.push(part);
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

export function locationLabel(h: { sectionTitle: string; page: number | null }) {
  return `${h.sectionTitle}${h.page ? ` — p. ${h.page}` : ""}`;
}

function providerPassage(h: PassageHit): ProviderPassage {
  const by = h.author ? ` — ${h.author}` : "";
  const date = h.year ? ` (${h.year})` : "";
  return {
    title: `${h.title}${by}${date} — ${locationLabel(h)}`,
    source: `/p/${h.id}`,
    sentences: splitSentences(h.text),
  };
}

function toSource(h: PassageHit, n: number, quoted: string[] = []): AnswerSource {
  return {
    n,
    passageId: h.id,
    documentId: h.documentId,
    title: h.title,
    author: h.author,
    year: h.year,
    sectionOrdinal: h.sectionOrdinal,
    sectionTitle: h.sectionTitle,
    page: h.page,
    text: h.text,
    quoted,
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/_/g, "")
    .replace(/\s+/g, " ")
    .trim();

/* ───────────────────────────── Run ───────────────────────────── */

export type RunOptions = {
  ownerId: string;
  mode: ArchivistMode;
  /** Confine the question to these documents. */
  documentIds?: number[];
  /** A passage the reader is asking about; always included first. */
  passageId?: string | null;
  /** Override the configured provider (tests, alternative models). */
  provider?: AnswerProvider | null;
};

export async function runArchivist(question: string, opts: RunOptions): Promise<ArchivistResult> {
  const started = Date.now();
  const provider = opts.provider !== undefined ? opts.provider : getProvider();
  const deep = opts.mode === "deep";
  const limit = deep ? ARCHIVIST.deepPassages : ARCHIVIST.standardPassages;
  const notes: string[] = [];
  const { ownerId } = opts;

  // 1. Understand
  const keys = await libraryKeys(ownerId);
  const scope = opts.documentIds?.length ? keys.filter((k) => opts.documentIds!.includes(k.id)) : [];
  let plan: QueryPlan | null = null;
  if (provider && keys.length) {
    plan = await provider.plan(
      question,
      keys.map((k) => `${k.title}${k.author ? ` — ${k.author}` : ""}`),
    );
  }
  const mentioned = scope.length ? scope : detectMentions(question, keys, plan?.mentions ?? []);

  // Words that only name a document should not also be searched for.
  let conceptText = question;
  for (const m of mentioned) for (const key of m.keys) conceptText = conceptText.replace(new RegExp(escape(key), "gi"), " ");
  let concepts: Concept[] = toConcepts(conceptText);
  if (plan) {
    const planned: Concept[] = plan.concepts.map((c) => ({
      term: c.term,
      terms: [...new Set([c.term, ...c.variants].map((t) => t.trim()).filter(Boolean))].slice(0, 16),
    }));
    // The plan leads; the reader's own words it missed are kept.
    const plannedTerms = new Set(planned.flatMap((c) => c.terms.map((t) => t.toLowerCase())));
    concepts = [...planned, ...concepts.filter((c) => !plannedTerms.has(c.term.toLowerCase()))].slice(0, 8);
  }
  const pinned = opts.passageId ? await getPassageHits(ownerId, [opts.passageId]) : [];
  if (pinned.length) {
    // Find where else the library takes up the pinned passage's subject:
    // search on its most distinctive (longest) words, alongside the question's own.
    const words = [...new Set(pinned[0].text.toLowerCase().match(/\p{L}{7,}/gu) ?? [])]
      .sort((a, b) => b.length - a.length)
      .slice(0, 5);
    concepts = [...concepts, ...toConcepts(words.join(" "))].slice(0, 8);
  }
  if (!concepts.length && mentioned.length) {
    // "Tell me about The Prince": search the document's own title words.
    concepts = toConcepts(mentioned.map((m) => m.title).join(" "));
  }

  // 2. Retrieve
  let hits: PassageHit[] = [];
  if (mentioned.length) {
    const each = Math.max(4, Math.floor(limit / mentioned.length));
    for (const m of mentioned) {
      hits.push(...(await retriever.retrieve({ ownerId, concepts, limit: each, documentIds: [m.id] })));
    }
    const comparing = plan?.intent === "compare" || mentioned.length > 1 || scope.length > 0;
    if (!comparing && hits.length < limit) {
      const others = await retriever.retrieve({ ownerId, concepts, limit: limit - hits.length, perDocumentCap: ARCHIVIST.perDocumentCap });
      hits.push(...others.filter((o) => !hits.some((h) => h.id === o.id)));
    }
  } else {
    hits = await retriever.retrieve({ ownerId, concepts, limit, perDocumentCap: ARCHIVIST.perDocumentCap });
  }
  hits = [...pinned, ...hits.filter((h) => !pinned.some((p) => p.id === h.id))].slice(0, limit);

  const base = {
    question,
    mode: opts.mode,
    searchedFor: concepts.map((c) => c.term),
    scope: scope.map((s) => ({ id: s.id, title: s.title })),
    notes,
  };

  if (!hits.length) {
    return { ...base, status: "no_results", paragraphs: [], sources: [], consulted: [], model: null, elapsedMs: Date.now() - started };
  }

  if (!provider) {
    return {
      ...base,
      status: "retrieval_only",
      paragraphs: [],
      sources: [],
      consulted: hits.map((h, i) => toSource(h, i + 1)),
      model: null,
      elapsedMs: Date.now() - started,
    };
  }

  // 3. Answer
  const forModel = hits.map(providerPassage);
  const answer = await provider.answer({ question, mode: opts.mode, passages: forModel });

  // 4. Verify and number sources in order of first citation.
  const numberOf = new Map<number, number>();
  const quotedBy = new Map<number, Set<string>>();
  const spans: AnswerSpan[] = answer.spans.map((span) => {
    const cites: number[] = [];
    for (const c of span.citations) {
      const hit = hits[c.passage];
      const sentences = forModel[c.passage]?.sentences;
      if (!hit || !sentences || c.start < 0 || c.end > sentences.length || c.start >= c.end) {
        notes.push("A citation that did not resolve to a passage in your library was removed.");
        continue;
      }
      const quoted = sentences.slice(c.start, c.end).join(" ");
      if (!norm(hit.text).includes(norm(quoted))) {
        notes.push(`A citation to “${hit.title}” could not be matched to the passage text and was removed.`);
        continue;
      }
      if (!numberOf.has(c.passage)) numberOf.set(c.passage, numberOf.size + 1);
      const n = numberOf.get(c.passage)!;
      if (!cites.includes(n)) cites.push(n);
      if (!quotedBy.has(c.passage)) quotedBy.set(c.passage, new Set());
      quotedBy.get(c.passage)!.add(quoted);
    }
    return { text: span.text, cites };
  });

  // Quotations in the answer's own prose must exist somewhere in the retrieved passages.
  const corpus = hits.map((h) => norm(h.text));
  const answerText = spans.map((s) => s.text).join("");
  for (const m of answerText.matchAll(/[“"]([^”"]{24,400})[”"]/g)) {
    const q = norm(m[1]).replace(/^[.,;:…\s]+|[.,;:…\s]+$/g, "");
    const fragments = q.split(/\s*(?:\.\.\.|…)\s*/).filter((f) => f.length > 12);
    if (fragments.length && !fragments.every((f) => corpus.some((c) => c.includes(f)))) {
      notes.push(`Unverified quotation — not found in the passages consulted: “${m[1].slice(0, 120)}${m[1].length > 120 ? "…" : ""}”`);
    }
  }

  const sources = [...numberOf.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([idx, n]) => toSource(hits[idx], n, [...(quotedBy.get(idx) ?? [])]));
  const consulted = hits
    .map((h, idx) => ({ h, idx }))
    .filter(({ idx }) => !numberOf.has(idx))
    .map(({ h }, i) => toSource(h, sources.length + i + 1));

  return {
    ...base,
    status: answer.stopReason === "refusal" || sources.length === 0 ? "insufficient" : "answered",
    paragraphs: toParagraphs(spans),
    sources,
    consulted,
    notes: [...new Set(notes)],
    model: answer.model,
    elapsedMs: Date.now() - started,
  };
}

/** Split spans into paragraphs at blank lines, keeping citations with their text. */
function toParagraphs(spans: AnswerSpan[]): AnswerSpan[][] {
  const paragraphs: AnswerSpan[][] = [[]];
  for (const span of spans) {
    const parts = span.text.split(/\n\s*\n/);
    parts.forEach((part, i) => {
      if (i > 0) paragraphs.push([]);
      if (part) paragraphs[paragraphs.length - 1].push({ text: part.replace(/\n/g, " "), cites: i === parts.length - 1 ? span.cites : [] });
    });
  }
  return paragraphs
    .map((p) => p.filter((s) => s.text.trim() || s.cites.length))
    .filter((p) => p.some((s) => s.text.trim()));
}

/* ───────────────────────────── Cataloguing ───────────────────────────── */

/**
 * Write the Archivist's catalogue entry (abstract and subjects) for a newly
 * arrived document. Runs after the upload response; failure is harmless.
 */
export async function catalogueDocument(id: number) {
  const provider = getProvider();
  if (!provider?.catalogue) return;
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return;
  const rows = await db
    .select({ text: passages.text, title: sections.title })
    .from(passages)
    .innerJoin(sections, eq(sections.id, passages.sectionId))
    .where(and(eq(passages.documentId, id), sql`${passages.kind} <> 'code'`))
    .orderBy(asc(passages.ordinal));
  // The opening, plus samples from across the document, within ~12,000 words.
  const opening: string[] = [];
  let words = 0;
  for (const r of rows) {
    if (words > 7000) break;
    opening.push(r.text);
    words += r.text.split(/\s+/).length;
  }
  const rest = rows.slice(opening.length);
  const step = Math.max(1, Math.floor(rest.length / 24));
  const samples = rest.filter((_, i) => i % step === 0).slice(0, 24).map((r) => `[${r.title}] ${r.text.split(/\s+/).slice(0, 180).join(" ")}`);
  const contents = [...new Set(rows.map((r) => r.title))].slice(0, 60).join(" · ");
  const excerpt = `Contents: ${contents}\n\n${opening.join("\n\n")}\n\n…\n\n${samples.join("\n\n")}`;
  const entry = await provider.catalogue({ title: doc.title, author: doc.author, excerpt });
  if (entry) {
    await db.update(documents).set({ abstract: entry.abstract, subjects: entry.subjects, updatedAt: new Date() }).where(eq(documents.id, id));
  }
}
