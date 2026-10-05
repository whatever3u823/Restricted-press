/**
 * Turning a reader's words into search concepts.
 *
 * A concept is a term plus the variants that should also count as a match.
 * Here the variants are only the reader's own words; when a language model
 * is configured the Archivist's search plan adds synonyms and related
 * vocabulary for the subject at hand (see lib/archivist).
 */

const STOP = new Set(
  (
    "a an and are as at be been but by can could did do does find for from had has have how i if in into is it its " +
    "me more most my no not of on or our show so some tell than that the their them then there these they this those " +
    "to up us was we were what when where which who whom why will with would you your about any library document documents " +
    "book books paper papers article articles text texts passage passages say says said describe describes discuss discussing discusses " +
    "compare between among concept idea ideas mention mentions mentioned according explain explains author authors " +
    "before after during upon onto within without also such very much many used using use way ways kind kinds " +
    "thing things anything something did does done make makes made get give given my mine i've i'm"
  ).split(" "),
);

export type Concept = { term: string; terms: string[] };

export function tokenize(text: string) {
  const phrases: string[] = [];
  const stripped = text.replace(/["“]([^"”]{2,80})["”]/g, (_, p: string) => {
    phrases.push(p.toLowerCase());
    return " ";
  });
  const words = stripped
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^\p{L}\p{N}'-]+/u)
    .map((w) => w.replace(/^['-]+|['-]+$/g, "").replace(/'s$/, ""))
    .filter((w) => w.length > 1 && !STOP.has(w));
  return { phrases, words };
}

/** Free text → concepts: quoted phrases first, then the remaining words. */
export function toConcepts(text: string): Concept[] {
  const { phrases, words } = tokenize(text);
  const concepts: Concept[] = phrases.map((p) => ({ term: p, terms: [p] }));
  const seen = new Set<string>();
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    concepts.push({ term: w, terms: [w] });
  }
  return concepts.slice(0, 8);
}
