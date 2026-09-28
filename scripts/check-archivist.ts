/**
 * Verifies the Archivist's grounding guarantees with a scripted provider
 * (no API key or network needed):
 *   - citations resolve to exact archive sentences
 *   - out-of-range citations are dropped and noted
 *   - quotations not present in the passages are flagged
 *   - an answer with no citations is reported as "insufficient"
 *
 *   npx tsx --env-file=.env.local scripts/check-archivist.ts
 */
import assert from "node:assert/strict";
import { runArchivist, splitSentences } from "../src/lib/archivist";
import type { AnswerProvider, ProviderSpan } from "../src/lib/archivist/provider";

const scripted = (spans: ProviderSpan[]): AnswerProvider => ({
  name: "scripted",
  model: "scripted",
  plan: async () => null,
  answer: async () => ({ spans, model: "scripted", stopReason: "end_turn" }),
});

const question = "What did witches confess about the Devil's mark?";

// 1. Grounded answer + one bad citation + one fabricated quotation.
const r1 = await runArchivist(question, {
  mode: "standard",
  includeInner: false,
  provider: scripted([
    { text: "The archive's sources describe the mark in testimony.", citations: [{ passage: 0, start: 0, end: 1 }] },
    { text: " A second claim.", citations: [{ passage: 99, start: 0, end: 1 }] },
    { text: '\n\nOne writer says "the moon is made of green cheese and witches ride upon it nightly".', citations: [] },
  ]),
});
assert.equal(r1.status, "answered");
assert.equal(r1.sources.length, 1, "one resolvable source");
const src = r1.sources[0];
assert.ok(src.quoted.length === 1 && src.text.replace(/\s+/g, " ").includes(src.quoted[0].replace(/\s+/g, " ")), "quoted text is archive text");
assert.equal(src.quoted[0], splitSentences(src.text)[0], "quote is the first sentence of the passage");
assert.ok(r1.notes.some((n) => n.includes("did not resolve")), "bad citation noted");
assert.ok(r1.notes.some((n) => n.startsWith("Unverified quotation")), "fabricated quotation flagged");
assert.equal(r1.paragraphs.length, 2, "paragraph break preserved");
console.log("✓ grounded answer:", src.passageId, "—", src.quoted[0].slice(0, 80) + "…");
console.log("✓ integrity notes:", r1.notes);

// 2. An answer with no citations is not presented as an answer.
const r2 = await runArchivist(question, {
  mode: "standard",
  includeInner: false,
  provider: scripted([{ text: "The passages provided do not address this.", citations: [] }]),
});
assert.equal(r2.status, "insufficient");
console.log("✓ uncited answer reported as insufficient");

// 3. Retrieval-only mode.
const r3 = await runArchivist(question, { mode: "standard", includeInner: false, provider: null });
assert.equal(r3.status, "retrieval_only");
assert.ok(r3.consulted.length > 0);
console.log("✓ retrieval-only returns", r3.consulted.length, "passages");

// 4. A pinned passage is always read first.
const r4 = await runArchivist("What is this passage saying?", { mode: "standard", includeInner: false, provider: null, passageId: "0006.004.0003" });
assert.equal(r4.consulted[0].passageId, "0006.004.0003");
console.log("✓ pinned passage leads retrieval; related:", r4.consulted.slice(1, 4).map((s) => s.passageId).join(", "));

// 5. Inner Archive texts are not retrieved for non-members.
const r5 = await runArchivist("How is the priest of Nemi explained?", { mode: "standard", includeInner: false, provider: null });
assert.ok(r5.consulted.every((s) => s.slug !== "the-golden-bough"));
const r6 = await runArchivist("How is the priest of Nemi explained?", { mode: "standard", includeInner: true, provider: null });
assert.ok(r6.consulted.some((s) => s.slug === "the-golden-bough"));
console.log("✓ Inner Archive texts gated in retrieval");

console.log("\nAll Archivist checks passed.");
process.exit(0);
