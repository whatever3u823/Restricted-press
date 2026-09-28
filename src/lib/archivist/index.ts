/**
 * The Archivist: question → understanding → retrieval → answer → verification.
 *
 *   1. Understand   map the question onto archive concepts (controlled
 *                   vocabulary; in deep mode also an LLM search plan) and
 *                   detect records the question names.
 *   2. Retrieve     gather passages through the Retriever.
 *   3. Answer       the provider answers from those passages only, citing
 *                   them sentence by sentence.
 *   4. Verify       every quotation shown is archive text; citations that do
 *                   not resolve are dropped; unsupported quotations are flagged.
 *
 * With no language model configured the Archivist returns step 2 only
 * ("retrieval only"), which is still a useful, honest answer.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ARCHIVIST } from "@/lib/config";
import { getPassageHits, retriever, type PassageHit } from "@/lib/search/retriever";
import { toConcepts, type Concept } from "@/lib/search/vocabulary";
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

const fileNo = (n: number) => `FILE ${String(n).padStart(4, "0")}`;

/* ───────────────────────────── Understanding ───────────────────────────── */

type WorkKey = { id: number; slug: string; title: string; accession: number; keys: string[] };

const TITLE_STOP = new Set(["the", "of", "and", "a", "an", "in", "on", "from", "to", "with", "its", "their", "dr", "or"]);

async function workKeys(): Promise<WorkKey[]> {
  const rows = await db.execute<{ id: number; slug: string; title: string; accession: number; surnames: string | null }>(sql`
    select w.id, w.slug, w.title, w.accession,
      string_agg(split_part(a.sort_name, ',', 1), '|') surnames
    from works w
    left join work_authors wa on wa.work_id = w.id and wa.role = 'author'
    left join authors a on a.id = wa.author_id
    where w.publication_status = 'published'
    group by w.id
  `);
  return [...rows].map((r) => {
    const titleWords = r.title
      .toLowerCase()
      .replace(/[^\p{L}\s'-]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !TITLE_STOP.has(w));
    // A title is recognised by its full form or its most distinctive words.
    const keys = [r.title.toLowerCase(), ...titleWords.filter((w) => DISTINCTIVE.has(w))];
    for (const s of (r.surnames ?? "").split("|")) {
      const surname = s.trim().toLowerCase();
      if (surname && surname !== "three initiates" && !AMBIGUOUS_SURNAMES.has(surname)) keys.push(surname);
    }
    return { id: r.id, slug: r.slug, title: r.title, accession: r.accession, keys };
  });
}

/** Title words specific enough to identify a record on their own. */
const DISTINCTIVE = new Set([
  "kybalion",
  "necromancers",
  "golden",
  "bough",
  "rosicrucian",
  "freemasonry",
  "demonology",
  "elizabethan",
  "magus",
  "guernsey",
  "channel",
  "diary",
  "treatise",
]);
const AMBIGUOUS_SURNAMES = new Set(["williams", "roberts", "scott"]);

function detectMentions(question: string, keys: WorkKey[], extra: string[] = []) {
  const q = ` ${question.toLowerCase()} `;
  const found = new Map<number, WorkKey>();
  const file = [...question.matchAll(/file\s*0*(\d{1,4})/gi)].map((m) => Number(m[1]));
  for (const k of keys) {
    if (file.includes(k.accession)) found.set(k.id, k);
    for (const key of k.keys) {
      const re = new RegExp(`[^\\p{L}]${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}('s)?[^\\p{L}]`, "u");
      if (re.test(q)) found.set(k.id, k);
    }
    for (const m of extra) {
      const ml = m.toLowerCase();
      if (k.title.toLowerCase().includes(ml) || k.keys.some((key) => ml.includes(key))) found.set(k.id, k);
    }
  }
  return [...found.values()];
}

/* ───────────────────────────── Passages for the model ───────────────────────────── */

/** Split a passage into citable sentences, conservatively. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/(?<=[.!?]["”’)\]]?)\s+(?=["“‘(\[_]?[A-Z0-9])/)) {
    if (part.split(/\s+/).length > 90) {
      // Very long early-modern periods: break at semicolons too.
      out.push(...part.split(/(?<=;)\s+/));
    } else {
      out.push(part);
    }
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

function providerPassage(h: PassageHit): ProviderPassage {
  const date = h.year ? `, ${h.year}` : "";
  return {
    title: `${fileNo(h.accession)} — ${h.title}${h.author ? ` — ${h.author}` : ""}${date} — ${h.sectionTitle}`,
    source: `/p/${h.id}`,
    sentences: splitSentences(h.text),
  };
}

function toSource(h: PassageHit, n: number, quoted: string[] = []): AnswerSource {
  return {
    n,
    passageId: h.id,
    accession: h.accession,
    slug: h.slug,
    title: h.title,
    author: h.author,
    year: h.year,
    sectionOrdinal: h.sectionOrdinal,
    sectionTitle: h.sectionTitle,
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
  mode: ArchivistMode;
  includeInner: boolean;
  scopeSlug?: string | null;
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

  // 1. Understand
  const keys = await workKeys();
  let plan: QueryPlan | null = null;
  if (deep && provider) plan = await provider.plan(question);

  let scope: WorkKey | null = null;
  if (opts.scopeSlug) scope = keys.find((k) => k.slug === opts.scopeSlug) ?? null;
  const mentioned = scope ? [scope] : detectMentions(question, keys, plan?.mentions ?? []);

  // Words that only name a record should not also be searched for.
  let conceptText = question;
  for (const m of mentioned) for (const key of m.keys) conceptText = conceptText.replace(new RegExp(key, "gi"), " ");
  let concepts: Concept[] = toConcepts(conceptText, true);
  if (plan) {
    const planned: Concept[] = plan.concepts.map((c) => ({
      term: c.term,
      terms: [...new Set([c.term, ...c.variants, ...(toConcepts(c.term, true)[0]?.terms ?? [])])].slice(0, 24),
    }));
    // The model's plan leads; vocabulary concepts it missed are kept.
    const plannedTerms = new Set(planned.flatMap((c) => c.terms.map((t) => t.toLowerCase())));
    concepts = [...planned, ...concepts.filter((c) => !plannedTerms.has(c.term.toLowerCase()))].slice(0, 8);
  }
  const pinned = opts.passageId ? await getPassageHits([opts.passageId], opts.includeInner) : [];
  if (pinned.length) {
    // Find where else the archive treats the pinned passage's subject:
    // search on its most distinctive (longest) words, alongside the question's own.
    const words = [...new Set(pinned[0].text.toLowerCase().match(/[a-z]{7,}/g) ?? [])]
      .sort((a, b) => b.length - a.length)
      .slice(0, 5);
    concepts = [...concepts, ...toConcepts(words.join(" "), false)].slice(0, 8);
  }
  if (!concepts.length && mentioned.length) {
    // "Tell me about The Kybalion": search the record's own title words.
    concepts = toConcepts(mentioned.map((m) => m.title).join(" "), false);
  }

  // 2. Retrieve
  let hits: PassageHit[] = [];
  if (mentioned.length) {
    const each = Math.max(4, Math.floor(limit / mentioned.length));
    for (const m of mentioned) {
      hits.push(
        ...(await retriever.retrieve({ concepts, limit: each, workIds: [m.id], includeInner: opts.includeInner })),
      );
    }
    const comparing = plan?.intent === "compare" || mentioned.length > 1 || Boolean(scope);
    if (!comparing && hits.length < limit) {
      const others = await retriever.retrieve({
        concepts,
        limit: limit - hits.length,
        perWorkCap: ARCHIVIST.perWorkCap,
        includeInner: opts.includeInner,
      });
      hits.push(...others.filter((o) => !hits.some((h) => h.id === o.id)));
    }
  } else {
    hits = await retriever.retrieve({ concepts, limit, perWorkCap: ARCHIVIST.perWorkCap, includeInner: opts.includeInner });
  }
  hits = [...pinned, ...hits.filter((h) => !pinned.some((p) => p.id === h.id))].slice(0, limit);

  const base = {
    question,
    mode: opts.mode,
    searchedFor: concepts.map((c) => c.term),
    scope: scope ? { slug: scope.slug, title: scope.title } : null,
    notes,
  };

  if (!hits.length) {
    return {
      ...base,
      status: "no_results",
      paragraphs: [],
      sources: [],
      consulted: [],
      model: null,
      elapsedMs: Date.now() - started,
    };
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
  const passages = hits.map(providerPassage);
  const answer = await provider.answer({ question, mode: opts.mode, passages });

  // 4. Verify and number sources in order of first citation.
  const numberOf = new Map<number, number>();
  const quotedBy = new Map<number, Set<string>>();
  const spans: AnswerSpan[] = answer.spans.map((span) => {
    const cites: number[] = [];
    for (const c of span.citations) {
      const hit = hits[c.passage];
      const sentences = passages[c.passage]?.sentences;
      if (!hit || !sentences || c.start < 0 || c.end > sentences.length || c.start >= c.end) {
        notes.push("A citation that did not resolve to an archive passage was removed.");
        continue;
      }
      const quoted = sentences.slice(c.start, c.end).join(" ");
      if (!norm(hit.text).includes(norm(quoted))) {
        notes.push(`A citation to ${fileNo(hit.accession)} could not be matched to the passage text and was removed.`);
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
