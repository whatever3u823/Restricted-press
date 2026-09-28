/**
 * Stage 1 — turn a raw provider file into a clean archive text.
 *
 * Deliberately conservative: we remove the provider's wrapper (licence
 * header/footer, producer credits, notices that refer to the provider) and
 * expand the transcribers' ASCII ligature conventions back to the original
 * glyphs. Spelling, punctuation, capitalisation and line breaks are left as
 * they are in the transcription.
 */

export type CleanResult = {
  text: string;
  /** Producer credits and transcriber's notes lifted out of the text body. */
  transcriptionNotes: string[];
  /** Paragraphs removed because they refer to the provider. */
  removed: string[];
};

const LIGATURES: [RegExp, string][] = [
  [/\[oe\]/g, "œ"],
  [/\[OE\]/g, "Œ"],
  [/\[ae\]/g, "æ"],
  [/\[AE\]/g, "Æ"],
];

const CREDIT = /^(Produced by|E-text prepared by|This etext was produced|This e-text was produced|Transcribed from|Scanned and proofed)/i;
const PROVIDER = /project gutenberg|gutenberg\.(org|net)|pgdp\.net|distributed proofread/i;

export function decode(buf: Buffer, encoding: "utf-8" | "latin1"): string {
  let text = encoding === "latin1" ? buf.toString("latin1") : buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replace(/\r\n?/g, "\n");
}

export function clean(raw: string): CleanResult {
  let text = raw;

  // Licence wrapper. The start marker can wrap over several lines.
  const start = text.match(/\*{3}\s*START OF[\s\S]*?\*{3}/i);
  if (start) text = text.slice(start.index! + start[0].length);
  const endCandidates = [
    /\*{3}\s*END OF/i,
    /^End of (the )?Project Gutenberg/im,
    /^End of Project Gutenberg's/im,
  ]
    .map((re) => text.search(re))
    .filter((i) => i >= 0);
  if (endCandidates.length) text = text.slice(0, Math.min(...endCandidates));

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s+$/g, "")).filter((p) => p.trim());

  const transcriptionNotes: string[] = [];
  const removed: string[] = [];
  const kept: string[] = [];

  // Producer credits and bracketed transcriber's notes at the very top.
  let i = 0;
  while (i < paragraphs.length) {
    const p = paragraphs[i].trim();
    if (CREDIT.test(p)) {
      transcriptionNotes.push(unwrap(p));
      i++;
      continue;
    }
    if (/^\[Transcriber['’]?s? ?note/i.test(p) || /^Transcriber['’]?s note/i.test(p)) {
      // A bracketed note may run over several paragraphs.
      const block = [p];
      while (/^\[/.test(p) && !/\]\s*$/.test(block[block.length - 1]) && i + 1 < paragraphs.length) {
        i++;
        block.push(paragraphs[i].trim());
      }
      // A bare "Transcriber's notes" heading is followed by indented notes.
      while (!/^\[/.test(p) && i + 1 < paragraphs.length && /^\s{2,}/.test(paragraphs[i + 1])) {
        i++;
        block.push(paragraphs[i].trim());
      }
      transcriptionNotes.push(block.map(unwrap).join("\n"));
      i++;
      continue;
    }
    break;
  }

  for (; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (PROVIDER.test(p)) {
      removed.push(p.trim());
      continue;
    }
    kept.push(p);
  }

  let out = kept.join("\n\n") + "\n";
  for (const [re, glyph] of LIGATURES) out = out.replace(re, glyph);
  return { text: out, transcriptionNotes, removed };
}

function unwrap(p: string) {
  return p
    .split("\n")
    .map((l) => l.trim())
    .join(" ");
}
