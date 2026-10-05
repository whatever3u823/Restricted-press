/**
 * PDF → blocks. Browser only.
 *
 * A PDF stores positioned runs of text, not paragraphs. We rebuild lines
 * from positions, drop running headers, footers and page numbers, find
 * headings by type size (or from the PDF's own bookmarks), and join lines
 * into paragraphs using spacing, indentation and punctuation — mending
 * words hyphenated across line breaks.
 */
import { getDocumentProxy } from "unpdf";
import type { Block } from "./model";
import { tidy } from "./model";

type Line = { text: string; x: number; y: number; right: number; size: number; page: number; top: boolean; bottom: boolean };

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const JUNK_TITLE = /^(microsoft\s|untitled|document\d*$|.+\.(docx?|pdf|tex|indd|rtf)$|slide|presentation|title$|\s*$)/i;

export async function parsePdf(data: Uint8Array, onProgress?: (done: number, total: number) => void) {
  const pdf = await getDocumentProxy(data);
  const total = pdf.numPages;
  const lines: Line[] = [];

  for (let p = 1; p <= total; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageLines: Line[] = [];
    let cur: Line | null = null;
    for (const raw of content.items) {
      if (!("str" in raw)) continue;
      const item = raw as { str: string; transform: number[]; width: number; hasEOL: boolean };
      const t = item.transform;
      const size = Math.round((Math.hypot(t[2], t[3]) || Math.hypot(t[0], t[1]) || 10) * 2) / 2;
      const x = t[4];
      const y = t[5];
      if (item.str) {
        if (cur && Math.abs(y - cur.y) <= Math.max(size, cur.size) * 0.45 && x >= cur.right - cur.size * 2) {
          const gap = x - cur.right;
          if (gap > size * 0.15 && !cur.text.endsWith(" ") && !item.str.startsWith(" ")) cur.text += " ";
          cur.text += item.str;
          cur.right = Math.max(cur.right, x + item.width);
          cur.size = Math.max(cur.size, size);
        } else {
          if (cur) pageLines.push(cur);
          cur = { text: item.str, x, y, right: x + item.width, size, page: p, top: false, bottom: false };
        }
      }
      if (item.hasEOL && cur) {
        pageLines.push(cur);
        cur = null;
      }
    }
    if (cur) pageLines.push(cur);
    const kept = pageLines.filter((l) => l.text.trim());
    kept.slice(0, 2).forEach((l) => (l.top = true));
    kept.slice(-2).forEach((l) => (l.bottom = true));
    lines.push(...kept);
    page.cleanup();
    onProgress?.(p, total);
    // Let the page breathe on long documents.
    if (p % 8 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  const chars = lines.reduce((n, l) => n + l.text.length, 0);
  if (chars < Math.max(200, total * 40)) {
    throw new Error(
      "This PDF contains little or no selectable text — it is probably scanned page images. Athenaeum cannot read scanned PDFs yet; run it through OCR first.",
    );
  }

  // Running headers and footers: the same line (digits aside) at the top or bottom of many pages.
  const sig = (l: Line) => norm(l.text).replace(/\d+/g, "#");
  const edgeCounts = new Map<string, number>();
  for (const l of lines) if (l.top || l.bottom) edgeCounts.set(sig(l), (edgeCounts.get(sig(l)) ?? 0) + 1);
  const threshold = Math.max(3, Math.floor(total * 0.25));
  const pageNumber = /^\s*(page\s*)?(\d{1,4}|[ivxlc]{1,7})(\s*(of|\/)\s*\d+)?\s*$/i;
  const body = lines.filter((l) => {
    if (!(l.top || l.bottom)) return true;
    if (pageNumber.test(l.text)) return false;
    return total < 4 || (edgeCounts.get(sig(l)) ?? 0) < threshold;
  });

  // Typical type size, line spacing and line width for body text.
  const sizeWeight = new Map<number, number>();
  for (const l of body) sizeWeight.set(l.size, (sizeWeight.get(l.size) ?? 0) + l.text.length);
  const bodySize = [...sizeWeight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
  const gaps: number[] = [];
  for (let i = 1; i < body.length; i++) {
    const a = body[i - 1];
    const b = body[i];
    if (a.page === b.page && Math.abs(a.size - bodySize) < 0.6 && Math.abs(b.size - bodySize) < 0.6 && a.y > b.y) gaps.push(a.y - b.y);
  }
  const lineGap = median(gaps.filter((g) => g < bodySize * 3)) || bodySize * 1.25;
  const fullWidth = percentile(body.filter((l) => Math.abs(l.size - bodySize) < 0.6).map((l) => l.right - l.x), 0.85) || 400;

  // Headings by size: distinct larger sizes, ranked.
  const isHeadingLine = (l: Line) => l.size >= bodySize * 1.18 && l.text.trim().length <= 160 && /\p{L}/u.test(l.text);
  const headingSizes = [...new Set(body.filter(isHeadingLine).map((l) => l.size))].sort((a, b) => b - a);
  const sizeLevel = (s: number) => Math.min(4, headingSizes.indexOf(s) + 1);

  // The PDF's own bookmarks, when it has a usable set.
  const outline = await readOutline(pdf);
  const useOutline = outline.length >= 3;

  const blocks: Block[] = [];
  let para: Line[] = [];
  const flush = () => {
    if (!para.length) return;
    let text = "";
    for (const l of para) {
      const s = l.text.trim();
      if (!text) text = s;
      else if (/\p{L}-$/u.test(text) && /^\p{Ll}/u.test(s)) text = text.slice(0, -1) + s;
      else text += " " + s;
    }
    blocks.push({ kind: "paragraph", text: tidy(text), page: para[0].page });
    para = [];
  };

  const pending = [...outline];
  let headingRun: Line[] = [];
  const flushHeading = () => {
    if (!headingRun.length) return;
    const text = tidy(headingRun.map((l) => l.text).join(" "));
    const matched = useOutline && blocks.some((b) => b.kind === "heading" && b.level! <= 2 && norm(b.text) === norm(text));
    if (!matched) blocks.push({ kind: "heading", level: useOutline ? 2 + sizeLevel(headingRun[0].size) : sizeLevel(headingRun[0].size), text, page: headingRun[0].page });
    headingRun = [];
  };

  for (let i = 0; i < body.length; i++) {
    const l = body[i];
    const prev = body[i - 1];

    // Outline entries open at the first line of their page that names them, or at the page start.
    while (useOutline && pending.length && pending[0].page <= l.page) {
      const entry = pending[0];
      const onPage = body.slice(i).filter((x) => x.page === entry.page);
      const key = norm(entry.title).slice(0, 24);
      const at = key ? onPage.findIndex((x) => norm(x.text).startsWith(key.slice(0, Math.min(key.length, 12)))) : -1;
      if (entry.page < l.page || at <= 0) {
        flush();
        flushHeading();
        blocks.push({ kind: "heading", level: entry.level, text: entry.title, page: entry.page });
        pending.shift();
      } else break;
    }

    if (isHeadingLine(l)) {
      flush();
      if (headingRun.length && (headingRun[0].size !== l.size || headingRun[0].page !== l.page)) flushHeading();
      headingRun.push(l);
      continue;
    }
    if (headingRun.length) flushHeading();

    if (para.length && prev) {
      const last = para[para.length - 1];
      const endsSentence = /[.!?:;"”’)\]]$/.test(last.text.trim());
      const newColumnOrPage = l.page !== last.page || l.y > last.y + lineGap * 0.5;
      const dy = last.y - l.y;
      const sameColumn = Math.abs(l.x - last.x) < fullWidth * 0.5;
      let brk = false;
      if (newColumnOrPage) brk = endsSentence && !/^\p{Ll}/u.test(l.text.trim());
      else if (dy > lineGap * 1.45) brk = true;
      else if (Math.abs(l.size - last.size) > 1) brk = true;
      else if (sameColumn && l.x - last.x > l.size * 0.8 && l.x - last.x < l.size * 8) brk = true;
      else if (last.right - last.x < fullWidth * 0.72 && endsSentence) brk = true;
      if (brk) flush();
    }
    para.push(l);
  }
  flush();
  flushHeading();
  for (const entry of pending) blocks.push({ kind: "heading", level: entry.level, text: entry.title, page: entry.page });

  let title: string | null = null;
  let author: string | null = null;
  try {
    const meta = await pdf.getMetadata();
    const info = meta.info as Record<string, unknown>;
    const t = typeof info.Title === "string" ? info.Title.trim() : "";
    const a = typeof info.Author === "string" ? info.Author.trim() : "";
    if (t && !JUNK_TITLE.test(t) && t.length >= 3) title = t;
    if (a && !/^(user|admin|owner|microsoft|unknown|author)$/i.test(a) && a.length > 2) author = a;
  } catch {}
  if (!title) {
    const first = blocks.find((b) => b.kind === "heading" && (b.page ?? 1) <= 2 && b.text.length >= 4 && b.text.length <= 200);
    if (first) title = first.text;
  }
  await pdf.cleanup();
  return { blocks, title, author, pages: total };
}

type OutlineEntry = { title: string; page: number; level: number };

async function readOutline(pdf: Awaited<ReturnType<typeof getDocumentProxy>>): Promise<OutlineEntry[]> {
  try {
    const outline = await pdf.getOutline();
    if (!outline?.length) return [];
    const out: OutlineEntry[] = [];
    const visit = async (items: typeof outline, level: number) => {
      for (const item of items) {
        let page: number | null = null;
        try {
          const dest = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
          if (Array.isArray(dest) && dest[0]) {
            page = typeof dest[0] === "number" ? dest[0] + 1 : (await pdf.getPageIndex(dest[0])) + 1;
          }
        } catch {}
        const title = tidy(item.title ?? "");
        if (page && title) out.push({ title, page, level });
        if (level < 2 && item.items?.length) await visit(item.items, level + 1);
      }
    };
    await visit(outline, 1);
    return out.sort((a, b) => a.page - b.page);
  } catch {
    return [];
  }
}
