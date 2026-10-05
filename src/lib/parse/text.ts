/** Plain text and Markdown → blocks. */
import type { Block } from "./model";

/** Remove a Project Gutenberg-style licence wrapper, if present. */
function unwrapLicence(text: string) {
  let t = text;
  const start = t.match(/\*{3}\s*START OF[\s\S]*?\*{3}/i);
  if (start) t = t.slice(start.index! + start[0].length);
  const end = t.search(/\*{3}\s*END OF|^End of (the )?Project Gutenberg/im);
  if (end >= 0) t = t.slice(0, end);
  return t;
}

const ROMAN = /^(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})\.?$/;

function headingLevel(line: string): number | null {
  const t = line.trim();
  if (t.length > 90 || t.split(/\s+/).length > 12 || /[,;]$/.test(t)) return null;
  if (/^(part|book|volume)\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|the\s+\w+)\b/i.test(t)) return 1;
  if (/^(chapter|section|letter|lecture|essay|canto|act|scene|appendix|preface|introduction|prologue|epilogue|foreword|afterword|conclusion)\b/i.test(t)) return 2;
  if (ROMAN.test(t.replace(/\.$/, ""))) return 2;
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 4 && letters === letters.toUpperCase() && !/[.!?]["”’)]?$/.test(t)) return 3;
  return null;
}

/** A line-wrapped paragraph: verse keeps its line breaks, prose is joined. */
function shape(raw: string): Block {
  const lines = raw.split("\n").filter((l) => l.trim());
  const joined = lines.map((l) => l.trim()).join(" ");
  const indented = lines.length > 1 && lines.every((l) => /^\s{2,}/.test(l));
  const maxLen = Math.max(...lines.map((l) => l.trim().length));
  if (lines.length > 1 && indented) {
    if (maxLen < 62) return { kind: "verse", text: dedent(lines).join("\n") };
    return { kind: "quote", text: joined };
  }
  if (lines.length > 2 && maxLen < 48) return { kind: "verse", text: dedent(lines).join("\n") };
  return { kind: "paragraph", text: joined };
}

function dedent(lines: string[]) {
  const indent = Math.min(...lines.map((l) => l.match(/^\s*/)![0].length));
  return lines.map((l) => l.slice(indent).replace(/\s+$/, ""));
}

export function textToBlocks(input: string): Block[] {
  const text = unwrapLicence(input.replace(/^﻿/, "").replace(/\r\n?/g, "\n"));
  let paragraphs = text.split(/\n[ \t]*\n/).filter((p) => p.trim());
  // Files without blank lines between paragraphs: one line, one paragraph.
  if (paragraphs.length < 3 && text.split("\n").length > 20) paragraphs = text.split("\n").filter((l) => l.trim());

  const blocks: Block[] = [];
  for (const p of paragraphs) {
    const single = p.trim().split("\n").length === 1;
    const level = single ? headingLevel(p) : null;
    if (level) blocks.push({ kind: "heading", level, text: p.trim() });
    else blocks.push(shape(p));
  }
  return blocks;
}

/** Strip inline Markdown: emphasis, links, images, inline code marks. */
function inline(s: string) {
  return s
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![\p{L}\p{N}])([*_])(.+?)\1(?![\p{L}\p{N}])/gu, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "");
}

export function markdownToBlocks(input: string): Block[] {
  const lines = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/^---\n[\s\S]*?\n---\n/, "").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "paragraph", text: inline(para.join(" ")) });
    if (quote.length) blocks.push({ kind: "quote", text: inline(quote.join(" ")) });
    para = [];
    quote = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i]);
      if (code.join("").trim()) blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      flush();
      blocks.push({ kind: "heading", level: h[1].length, text: inline(h[2]) });
      continue;
    }
    // Setext headings: a line followed by === or ---.
    if (para.length === 1 && /^\s*(=+|-+)\s*$/.test(line) && line.trim().length >= 3) {
      const title = para[0];
      para = [];
      blocks.push({ kind: "heading", level: line.trim()[0] === "=" ? 1 : 2, text: inline(title) });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) {
      if (para.length) flush();
      quote.push(q[1]);
      continue;
    }
    const li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      flush();
      blocks.push({ kind: "paragraph", text: inline(`${/\d/.test(li[1]) ? li[1] + " " : "• "}${li[2]}`) });
      continue;
    }
    if (quote.length) flush();
    para.push(line.trim());
  }
  flush();
  return blocks;
}
