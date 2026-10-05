/**
 * Key terms: the words that characterise a document.
 *
 * Computed once when a document arrives and stored with it. Connections
 * between documents (and between their authors) are scored by the terms
 * they share, weighted so that words common across the reader's whole
 * library count for less than words that are distinctive to a few documents.
 */
import type { KeyTerm } from "@/db/schema";

// Common English words that say nothing about a document's subject.
const STOP = new Set(
  (
    "a about above across after again against all almost alone along already also although always am among an and another any anybody anyone anything anywhere are area areas around as ask asked asking asks at away back backed backing backs be became because become becomes been before began behind being beings best better between big both but by came can cannot case cases certain certainly clear clearly come could did differ different differently do does done down downed downing downs during each early either end ended ending ends enough even evenly ever every everybody everyone everything everywhere face faces fact facts far felt few find finds first for four from full fully further furthered furthering furthers gave general generally get gets give given gives go going good goods got great greater greatest group grouped grouping groups had has have having he her here herself high higher highest him himself his how however i if important in interest interested interesting interests into is it its itself just keep keeps kind knew know known knows large largely last later latest least less let lets like likely long longer longest made make making man many may me member members men might more most mostly mr mrs much must my myself necessary need needed needing needs never new newer newest next no nobody non noone not nothing now nowhere number numbers of off often old older oldest on once one only open opened opening opens or order ordered ordering orders other others our out over own part parted parting parts per perhaps place places point pointed pointing points possible present presented presenting presents problem problems put puts quite rather really right room rooms said same saw say says second seconds see seem seemed seeming seems sees several shall she should show showed showing shows side sides since small smaller smallest so some somebody someone something somewhere state states still such sure take taken than that the their them then there therefore these they thing things think thinks this those though thought thoughts three through thus to today together too took toward turn turned turning turns two under until up upon us use used uses very want wanted wanting wants was way ways we well wells went were what when where whether which while who whole whose why will with within without work worked working works would year years yet you young younger youngest your yours " +
    "thee thou thy thine hath doth unto shall ye upon whom whereof wherein thereof therein hereby also etc ibid op cit vol pp fig figure table chapter section page pages et al eds ed vol " +
    "however therefore thus hence indeed moreover furthermore whereas although though nevertheless nonetheless rather quite simply merely already almost often sometimes usually always never ever " +
    "something anything nothing everything someone anyone everyone nobody somebody another every each either neither both many much more most less least few several various certain " +
    "upon within without among between through throughout across around against toward towards beyond despite except " +
    "would could should might must shall will may can cannot did does done doing make made makes making take took taken takes come came comes coming goes went gone going get got gets getting give gave given gives " +
    "said says say saying tell told tells know knew known knows think thought thinks see seen saw sees look looked looks looking seem seemed seems find found finds call called calls " +
    "first second third last next former latter one two three four five six seven eight nine ten hundred thousand " +
    "even still yet just only also very well like back away much long little great good new old own same such other " +
    "person persons people matter matters word words form forms aspect aspects term condition conditions process manner means " +
    "effect effects cause causes reason reasons case cases fact instance instances account regard respect sort kind kinds degree " +
    "example examples result results question questions answer answers subject subjects object view views idea name names " +
    "chapter chapters book books page pages volume author authors reader readers text texts note notes line lines"
  ).split(/\s+/),
);

/** Tokenise text into candidate terms. */
function words(text: string) {
  return (text.toLowerCase().match(/\p{L}[\p{L}'’-]*\p{L}/gu) ?? [])
    .map((w) => w.replace(/['’]s$/, "").replace(/['’]/g, "'"))
    .filter((w) => w.length >= 4 && w.length <= 30 && !STOP.has(w) && !/^[ivxlcdm]+$/.test(w));
}

/** The document's characteristic words, most frequent first, plurals folded in. */
export function extractKeyTerms(texts: string[], limit = 80): KeyTerm[] {
  const counts = new Map<string, number>();
  for (const t of texts) for (const w of words(t)) counts.set(w, (counts.get(w) ?? 0) + 1);
  // Fold simple plurals into their singular when both occur.
  for (const [w, n] of [...counts]) {
    const singular = w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : null;
    if (singular && counts.has(singular)) {
      counts.set(singular, counts.get(singular)! + n);
      counts.delete(w);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, n]) => ({ term, n }));
}

export type TermDoc = { id: number; keyTerms: KeyTerm[] };

/** TF-IDF weight vectors over a set of documents (the reader's library). */
export function weigh(docs: TermDoc[]) {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.keyTerms) df.set(t.term, (df.get(t.term) ?? 0) + 1);
  const n = docs.length;
  const vectors = new Map<number, Map<string, number>>();
  for (const d of docs) {
    const max = d.keyTerms[0]?.n ?? 1;
    const v = new Map<string, number>();
    for (const t of d.keyTerms) {
      const tf = 0.5 + (0.5 * t.n) / max;
      const idf = Math.log(1 + n / (df.get(t.term) ?? 1));
      v.set(t.term, tf * idf);
    }
    vectors.set(d.id, v);
  }
  return vectors;
}

/** Cosine similarity of two weight vectors, with the terms that contribute most. */
export function compare(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const shared: { term: string; w: number }[] = [];
  for (const [t, w] of a) {
    na += w * w;
    const wb = b.get(t);
    if (wb !== undefined) {
      dot += w * wb;
      shared.push({ term: t, w: w * wb });
    }
  }
  for (const w of b.values()) nb += w * w;
  const score = na && nb ? dot / Math.sqrt(na * nb) : 0;
  return { score, shared: shared.sort((x, y) => y.w - x.w).map((s) => s.term) };
}
