/**
 * The shape every upload is reduced to, whatever its format.
 *
 * Parsing happens in the reader's browser (see ./index.ts): the file itself
 * never leaves their machine — only its text, organised into sections of
 * blocks, is sent to the library. This module is shared by the browser
 * parsers and the server, which re-validates and stores the result.
 */

export type BlockKind = "paragraph" | "heading" | "verse" | "quote" | "code";

export type Block = {
  kind: BlockKind;
  text: string;
  /** Heading depth (1 = chapter), for headings only. */
  level?: number;
  /** Page of the original file, where it has pages. */
  page?: number;
};

export type ParsedSection = {
  title: string;
  level: number;
  blocks: Block[];
};

export type DocumentFormat = "pdf" | "epub" | "docx" | "txt" | "md" | "html";

export type ParsedDocument = {
  title: string;
  author: string | null;
  year: number | null;
  format: DocumentFormat;
  filename: string;
  kind: "book" | "article" | "paper" | "notes" | "other";
  sections: ParsedSection[];
  wordCount: number;
  /** Things the reader should know about the extraction, e.g. pages with no text. */
  warnings: string[];
};

export function countWords(s: string) {
  return (s.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? []).length;
}

/** Collapse whitespace the way a reader expects; keep line breaks only where they matter. */
export function tidy(text: string, keepLines = false) {
  const t = text.replace(/­/g, "").replace(/[   ]/g, " ");
  if (keepLines) {
    return t
      .split("\n")
      .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
      .join("\n")
      .replace(/^\n+|\n+$/g, "");
  }
  return t.replace(/\s+/g, " ").trim();
}

/** "the_prince-machiavelli (1).pdf" → "The Prince Machiavelli" */
export function titleFromFilename(name: string) {
  const base = name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\s*\(\d+\)$/, "")
    .replace(/[_]+/g, " ")
    .replace(/(?<=\p{L})-(?=\p{L})/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Untitled";
  if (base !== base.toLowerCase()) return base;
  const small = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "via", "with"]);
  return base
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function yearFrom(value: string | null | undefined): number | null {
  const m = value?.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return y > 1000 && y <= new Date().getFullYear() + 1 ? y : null;
}

const TARGET_SECTION_WORDS = 4000;
const MAX_SECTION_WORDS = 12000;

/**
 * Turn a flat stream of blocks into readable sections.
 *
 * Headings open sections. The shallowest heading level in use becomes
 * level 1, the next level 2; deeper headings stay inside as heading blocks.
 * A document with no usable headings is divided into parts of about
 * 4,000 words at paragraph boundaries, and any very long section is split.
 */
export function blocksToSections(blocks: Block[], fallbackTitle: string): ParsedSection[] {
  const clean = blocks
    .map((b) => ({ ...b, text: tidy(b.text, b.kind === "verse" || b.kind === "code") }))
    .filter((b) => b.text && /[\p{L}\p{N}]/u.test(b.text));

  const headingLevels = [...new Set(clean.filter((b) => b.kind === "heading").map((b) => b.level ?? 1))].sort((a, b) => a - b);
  const top = headingLevels.slice(0, 2);
  const sectionLevel = (b: Block) => (b.kind === "heading" && top.includes(b.level ?? 1) ? top.indexOf(b.level ?? 1) + 1 : 0);
  const usable = clean.filter((b) => sectionLevel(b)).length >= 2;

  let sections: ParsedSection[] = [];
  if (usable) {
    let current: ParsedSection | null = null;
    for (const b of clean) {
      const lvl = sectionLevel(b);
      if (lvl) {
        const title = b.text.length > 160 ? `${b.text.slice(0, 157)}…` : b.text;
        // Consecutive headings ("PART I" then "CHAPTER 1") merge unless the first heads subsections.
        if (current && current.blocks.length === 0 && lvl >= current.level && lvl === 1) {
          current.title = `${current.title} · ${title}`;
          continue;
        }
        current = { title, level: lvl, blocks: [] };
        sections.push(current);
        continue;
      }
      if (!current) {
        current = { title: "Opening", level: 1, blocks: [] };
        sections.push(current);
      }
      current.blocks.push(b);
    }
    // An empty section survives only when it heads subsections.
    sections = sections.filter((s, i) => s.blocks.length > 0 || (s.level === 1 && sections[i + 1]?.level === 2));
  } else {
    sections = chunk(clean, fallbackTitle);
  }

  // Split anything too long to read comfortably as one page.
  const out: ParsedSection[] = [];
  for (const s of sections) {
    const words = s.blocks.reduce((n, b) => n + countWords(b.text), 0);
    if (words <= MAX_SECTION_WORDS) {
      out.push(s);
      continue;
    }
    const parts = chunk(s.blocks, s.title);
    parts.forEach((p, i) => out.push({ ...p, title: i === 0 ? s.title : `${s.title} (continued, ${i + 1})`, level: s.level }));
  }
  return out.length ? out : [{ title: fallbackTitle, level: 1, blocks: [] }];
}

function chunk(blocks: Block[], title: string): ParsedSection[] {
  const total = blocks.reduce((n, b) => n + countWords(b.text), 0);
  if (total <= TARGET_SECTION_WORDS * 1.5) return [{ title: blocks.length ? title : title, level: 1, blocks }];
  const parts: ParsedSection[] = [];
  let current: Block[] = [];
  let words = 0;
  for (const b of blocks) {
    current.push(b);
    words += countWords(b.text);
    if (words >= TARGET_SECTION_WORDS && b.kind !== "heading") {
      parts.push({ title: "", level: 1, blocks: current });
      current = [];
      words = 0;
    }
  }
  if (current.length) {
    if (words < TARGET_SECTION_WORDS / 4 && parts.length) parts[parts.length - 1].blocks.push(...current);
    else parts.push({ title: "", level: 1, blocks: current });
  }
  return parts.map((p, i) => ({ ...p, title: `Part ${i + 1}` }));
}

/** Guess what kind of document this is from its shape. */
export function guessKind(format: DocumentFormat, words: number, sample: string): ParsedDocument["kind"] {
  if (/\babstract\b/i.test(sample.slice(0, 4000)) && /\b(references|bibliography|doi|et al\.)/i.test(sample) && words < 40000) {
    return "paper";
  }
  if (format === "epub" || words > 30000) return "book";
  if (format === "md" || format === "txt") return words < 3000 ? "notes" : "article";
  return words < 15000 ? "article" : "book";
}
