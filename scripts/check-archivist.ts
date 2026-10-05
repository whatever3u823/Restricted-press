/**
 * Verifies the Archivist's guarantees with a scripted provider (no API key
 * or network needed), against two throwaway readers with their own libraries:
 *   - citations resolve to exact sentences of the reader's documents
 *   - out-of-range citations are dropped and noted
 *   - quotations not present in the passages are flagged
 *   - an answer with no citations is reported as "insufficient"
 *   - a reader's questions never reach another reader's documents
 *
 *   npm run check:archivist
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import { runArchivist, splitSentences } from "../src/lib/archivist";
import type { AnswerProvider, ProviderSpan } from "../src/lib/archivist/provider";
import { appendSections, createDocument, finalizeDocument } from "../src/lib/ingest";
import { blocksToSections } from "../src/lib/parse/model";
import { textToBlocks } from "../src/lib/parse/text";
import { extractKeyTerms } from "../src/lib/terms";

const FORTUNE = `CHAPTER I. OF FORTUNE

Fortune is the arbiter of half our actions, but she leaves the other half to be governed by ourselves. The prudent prince prepares for her floods in calm weather, building dykes and embankments.

A ruler who relies entirely on fortune is lost when she changes. Those who adapt their conduct to the times prosper, and those whose conduct is at odds with the times come to ruin.

CHAPTER II. OF VIRTUE

Virtue, for the prince, is the capacity to act boldly and to seize the occasion. It is better to be impetuous than cautious, because fortune favours those who master her.

Many princes have lost their states not through ill fortune but through their own idleness, for they never thought in quiet times that things might change.`;

const PROVIDENCE = `CHAPTER I. WHY GOOD MEN SUFFER

Adversity is the exercise of virtue. The wise man is not overturned by fortune, for he has foreseen every blow she can strike and has made himself ready to bear it.

Fortune gives nothing that she cannot take away. The man who has learned to want little cannot be robbed by her, and so he alone is free.

CHAPTER II. ON ENDURANCE

Fire tests gold, and misfortune tests brave men. A life without trial is a sea without storms, and the pilot never learns his craft.`;

const scripted = (spans: ProviderSpan[]): AnswerProvider => ({
  name: "scripted",
  model: "scripted",
  plan: async () => null,
  answer: async () => ({ spans, model: "scripted", stopReason: "end_turn" }),
});

async function makeReader(label: string) {
  const id = `check-${randomUUID()}`;
  await db.insert(user).values({ id, name: label, email: `${id}@example.invalid` });
  return id;
}

async function addDocument(ownerId: string, title: string, author: string, text: string) {
  const sections = blocksToSections(textToBlocks(text), title);
  const id = await createDocument(ownerId, "member", { title, author, kind: "book", format: "txt", filename: `${title}.txt` });
  await appendSections(ownerId, id, { sections });
  await finalizeDocument(ownerId, id);
  return id;
}

const alice = await makeReader("Alice");
const bob = await makeReader("Bob");
try {
  const prince = await addDocument(alice, "The Prince", "Niccolò Machiavelli", FORTUNE);
  const providence = await addDocument(alice, "On Providence", "Seneca", PROVIDENCE);
  console.log("✓ library built: sections split at chapter headings");

  const question = "What do these authors say about fortune and how to prepare for her?";

  // 1. Grounded answer + one bad citation + one fabricated quotation.
  const r1 = await runArchivist(question, {
    ownerId: alice,
    mode: "standard",
    provider: scripted([
      { text: "Both writers treat fortune as something to prepare for.", citations: [{ passage: 0, start: 0, end: 1 }] },
      { text: " A second claim.", citations: [{ passage: 99, start: 0, end: 1 }] },
      { text: '\n\nOne writer says "the moon is made of green cheese and fortune rides upon it nightly".', citations: [] },
    ]),
  });
  assert.equal(r1.status, "answered");
  assert.equal(r1.sources.length, 1, "one resolvable source");
  const src = r1.sources[0];
  assert.ok(src.text.includes(src.quoted[0]), "quoted text is library text");
  assert.equal(src.quoted[0], splitSentences(src.text)[0], "quote is the first sentence of the passage");
  assert.ok(r1.notes.some((n) => n.includes("did not resolve")), "bad citation noted");
  assert.ok(r1.notes.some((n) => n.startsWith("Unverified quotation")), "fabricated quotation flagged");
  assert.equal(r1.paragraphs.length, 2, "paragraph break preserved");
  console.log("✓ grounded answer:", src.passageId, "—", src.quoted[0].slice(0, 70) + "…");

  // 2. An answer with no citations is not presented as an answer.
  const r2 = await runArchivist(question, { ownerId: alice, mode: "standard", provider: scripted([{ text: "The passages do not address this.", citations: [] }]) });
  assert.equal(r2.status, "insufficient");
  console.log("✓ uncited answer reported as insufficient");

  // 3. Retrieval-only mode draws on both documents.
  const r3 = await runArchivist(question, { ownerId: alice, mode: "standard", provider: null });
  assert.equal(r3.status, "retrieval_only");
  assert.deepEqual(new Set(r3.consulted.map((s) => s.documentId)), new Set([prince, providence]));
  console.log("✓ retrieval-only returns", r3.consulted.length, "passages across both documents");

  // 4. A named author leads retrieval.
  const r4 = await runArchivist("What does Seneca say about adversity?", { ownerId: alice, mode: "standard", provider: null });
  assert.equal(r4.consulted[0].documentId, providence);
  console.log("✓ named author's document leads:", r4.consulted[0].title);

  // 5. Scope confines the question.
  const r5 = await runArchivist("fortune", { ownerId: alice, mode: "standard", provider: null, documentIds: [prince] });
  assert.ok(r5.consulted.length > 0 && r5.consulted.every((s) => s.documentId === prince));
  console.log("✓ scoped question stays within", r5.scope.map((s) => s.title).join(", "));

  // 6. A pinned passage is always read first.
  const pin = r3.consulted[r3.consulted.length - 1].passageId;
  const r6 = await runArchivist("What is this passage saying?", { ownerId: alice, mode: "standard", provider: null, passageId: pin });
  assert.equal(r6.consulted[0].passageId, pin);
  console.log("✓ pinned passage leads retrieval");

  // 7. Privacy: another reader cannot reach Alice's library, even by pinning her passage.
  const r7 = await runArchivist(question, { ownerId: bob, mode: "standard", provider: null, passageId: pin });
  assert.equal(r7.status, "no_results");
  const r8 = await runArchivist(question, { ownerId: bob, mode: "standard", provider: null, documentIds: [prince] });
  assert.equal(r8.status, "no_results");
  console.log("✓ another reader's questions never reach this library");

  // 8. Key terms describe the documents.
  const terms = extractKeyTerms([FORTUNE]).map((t) => t.term);
  assert.ok(terms.includes("fortune") && terms.includes("prince"), "fortune and prince are key terms");
  console.log("✓ key terms:", terms.slice(0, 6).join(", "));

  console.log("\nAll Archivist checks passed.");
} finally {
  await db.delete(user).where(eq(user.id, alice));
  await db.delete(user).where(eq(user.id, bob));
}
process.exit(0);
