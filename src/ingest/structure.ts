/**
 * Stage 2 — divide a clean archive text into sections and passages.
 *
 * Passages are paragraphs. They are the unit of search, citation and saving,
 * so each receives a stable ID: "{accession}.{section}.{paragraph}".
 */
import type { WorkRecord } from "./record";

export type PassageKind = "paragraph" | "verse" | "quote" | "note" | "illustration" | "rule";

export type ParsedPassage = {
  id: string;
  ordinal: number;
  kind: PassageKind;
  text: string;
  wordCount: number;
};

export type ParsedSection = {
  ordinal: number;
  title: string;
  level: number;
  matter: "front" | "body";
  passages: ParsedPassage[];
};

export type StructureReport = {
  sections: ParsedSection[];
  warnings: string[];
};

const pad = (n: number, width: number) => String(n).padStart(width, "0");

export function countWords(s: string) {
  return (s.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? []).length;
}

/** Classify a raw (still line-wrapped) paragraph and normalise its whitespace. */
export function shapeParagraph(raw: string): { kind: PassageKind; text: string } {
  const lines = raw.split("\n").filter((l) => l.trim());
  const trimmed = lines.map((l) => l.trim()).join(" ");

  if (/^\*(\s+\*)+$/.test(trimmed)) return { kind: "rule", text: "* * *" };
  if (/^\[Illustration/i.test(trimmed)) return { kind: "illustration", text: trimmed };
  if (/^\[(Footnote|Sidenote|\d+\]|[a-z]\])/i.test(trimmed) || /^\[\d+\]/.test(trimmed)) {
    return { kind: "note", text: trimmed };
  }

  const indented = lines.length > 0 && lines.every((l) => /^\s{2,}/.test(l));
  const maxLen = Math.max(...lines.map((l) => l.trim().length));
  if (lines.length > 1 && indented) {
    // Short indented lines are verse or set-out matter: keep the line breaks.
    if (maxLen < 62) return { kind: "verse", text: dedent(lines).join("\n") };
    return { kind: "quote", text: trimmed };
  }
  if (lines.length > 2 && maxLen < 48) {
    // Ragged short lines (title pages, lists, tables of contents).
    return { kind: "verse", text: dedent(lines).join("\n") };
  }
  return { kind: "paragraph", text: trimmed };
}

function dedent(lines: string[]) {
  const indent = Math.min(...lines.map((l) => l.match(/^\s*/)![0].length));
  return lines.map((l) => l.slice(indent).replace(/\s+$/, ""));
}

// Headings are short blocks (set-out headings can span a few lines); they
// are matched with their lines joined.
const flat = (p: string) => p.trim().split(/\s*\n\s*/).join(" ");
const isShort = (p: string) => p.trim().split("\n").length <= 10 && flat(p).length <= 420;

export function structure(record: WorkRecord, cleanText: string): StructureReport {
  const cfg = record.structure;
  const warnings: string[] = [];
  let paragraphs = cleanText.split(/\n\s*\n/).filter((p) => p.trim());

  if (cfg?.drop.length) {
    const drop = new Set(cfg.drop.map((d) => d.trim()));
    paragraphs = paragraphs.filter((p) => !drop.has(p.trim()));
  }

  let bodyStart = 0;
  if (cfg?.body_start) {
    const re = new RegExp(cfg.body_start);
    let seen = 0;
    bodyStart = -1;
    for (let i = 0; i < paragraphs.length; i++) {
      if (re.test(flat(paragraphs[i])) && ++seen === cfg.body_start_occurrence) {
        bodyStart = i;
        break;
      }
    }
    if (bodyStart < 0) {
      warnings.push(`body_start pattern not found: ${cfg.body_start}`);
      bodyStart = 0;
    }
  }

  // end_at is searched only after the body starts, so a table of contents
  // listing "INDEX" cannot truncate the text.
  if (cfg?.end_at) {
    const re = new RegExp(cfg.end_at);
    const idx = paragraphs.findIndex((p, i) => i > bodyStart && re.test(flat(p)));
    if (idx >= 0) paragraphs = paragraphs.slice(0, idx);
    else warnings.push(`end_at pattern not found: ${cfg.end_at}`);
  }

  const heading = cfg ? new RegExp(cfg.heading) : null;
  const subheading = cfg?.subheading ? new RegExp(cfg.subheading) : null;

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  const open = (title: string, level: number, matter: "front" | "body") => {
    current = { ordinal: sections.length + 1, title, level, matter, passages: [] };
    sections.push(current);
    return current;
  };

  if (bodyStart > 0) {
    const front = open("Front Matter", 1, "front");
    for (const p of paragraphs.slice(0, bodyStart)) front.passages.push(toPassage(p));
    current = null;
  }

  for (let i = bodyStart; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const t = flat(p);
    if (heading && isShort(p) && heading.test(t)) {
      let title = t;
      if (cfg?.heading_title_next && i + 1 < paragraphs.length) {
        const next = flat(paragraphs[i + 1]);
        const nextIsHeading = heading.test(next) || (subheading?.test(next) ?? false);
        if (isShort(paragraphs[i + 1]) && next.length < 160 && !nextIsHeading) {
          title = `${t.replace(/[.:]$/, "")}. ${next}`;
          i++;
        }
      }
      open(title, 1, "body");
      continue;
    }
    if (subheading && isShort(p) && subheading.test(t)) {
      open(t, 2, "body");
      continue;
    }
    if (!current) open("Opening", 1, "body");
    current!.passages.push(toPassage(p));
  }

  // Assign stable IDs and global ordinals; drop empty sections.
  const acc = pad(record.accession, 4);
  let ordinal = 0;
  // Keep an empty section only when it heads subsections (e.g. "PART I").
  const result = sections.filter(
    (s, i) => s.passages.length > 0 || (s.level === 1 && sections[i + 1]?.level === 2),
  );
  result.forEach((s, si) => {
    s.ordinal = si + 1;
    s.passages.forEach((pp, pi) => {
      pp.id = `${acc}.${pad(s.ordinal, 3)}.${pad(pi + 1, 4)}`;
      pp.ordinal = ++ordinal;
    });
  });

  const bodySections = result.filter((s) => s.matter === "body");
  if (heading && bodySections.length < 2) warnings.push("fewer than two body sections detected");
  const huge = result.flatMap((s) => s.passages).filter((p) => p.wordCount > 1200);
  if (huge.length) warnings.push(`${huge.length} passage(s) over 1,200 words`);

  return { sections: result, warnings };
}

function toPassage(raw: string): ParsedPassage {
  const { kind, text } = shapeParagraph(raw);
  return { id: "", ordinal: 0, kind, text, wordCount: kind === "rule" ? 0 : countWords(text) };
}
