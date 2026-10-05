/**
 * Read a file in the browser and reduce it to a ParsedDocument.
 * Supported: PDF, EPUB, Word (.docx), plain text, Markdown, HTML.
 */
import { UPLOAD } from "@/lib/config";
import { parseHtml, htmlToBlocks } from "./html";
import {
  blocksToSections,
  countWords,
  guessKind,
  titleFromFilename,
  type Block,
  type DocumentFormat,
  type ParsedDocument,
} from "./model";
import { markdownToBlocks, textToBlocks } from "./text";

export { ACCEPT } from "./accept";

export function formatOf(file: File): DocumentFormat | null {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (ext === "epub" || file.type === "application/epub+zip") return "epub";
  if (ext === "docx") return "docx";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "html" || ext === "htm" || file.type === "text/html") return "html";
  if (ext === "txt" || file.type.startsWith("text/")) return "txt";
  return null;
}

export type ParseProgress = { stage: "reading" | "extracting" | "structuring"; done?: number; total?: number };

export async function parseFile(file: File, onProgress?: (p: ParseProgress) => void): Promise<ParsedDocument> {
  const format = formatOf(file);
  if (!format) {
    if (/\.doc$/i.test(file.name)) throw new Error("Older Word (.doc) files are not supported. Save it as .docx or PDF and try again.");
    throw new Error("Athenaeum reads PDF, EPUB, Word (.docx), text, Markdown and HTML files.");
  }
  if (file.size > UPLOAD.maxFileBytes) throw new Error("This file is larger than 150 MB and cannot be read in the browser.");
  if (file.size === 0) throw new Error("This file is empty.");

  onProgress?.({ stage: "reading" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const warnings: string[] = [];
  let blocks: Block[] = [];
  let title: string | null = null;
  let author: string | null = null;
  let year: number | null = null;

  onProgress?.({ stage: "extracting" });
  if (format === "pdf") {
    const { parsePdf } = await import("./pdf");
    const r = await parsePdf(bytes, (done, total) => onProgress?.({ stage: "extracting", done, total }));
    ({ blocks, title, author } = r);
  } else if (format === "epub") {
    const { parseEpub } = await import("./epub");
    ({ blocks, title, author, year } = parseEpub(bytes));
  } else if (format === "docx") {
    const { parseDocx } = await import("./docx");
    ({ blocks, title, author, year } = await parseDocx(bytes));
  } else {
    const text = new TextDecoder("utf-8").decode(bytes);
    if (format === "md") blocks = markdownToBlocks(text);
    else if (format === "html") {
      const doc = parseHtml(text);
      title = doc.querySelector("title")?.textContent?.trim() || null;
      author = doc.querySelector('meta[name="author"]')?.getAttribute("content")?.trim() || null;
      blocks = htmlToBlocks(doc.querySelector("article") ?? doc.querySelector("main") ?? doc.body);
    } else blocks = textToBlocks(text);
    if (format === "md" && !title) title = blocks.find((b) => b.kind === "heading" && b.level === 1)?.text ?? null;
  }

  onProgress?.({ stage: "structuring" });
  const finalTitle = (title ?? "").trim() || titleFromFilename(file.name);
  const sections = blocksToSections(blocks, finalTitle);
  const wordCount = sections.reduce((n, s) => n + s.blocks.reduce((m, b) => m + countWords(b.text), 0), 0);
  if (wordCount < 20) throw new Error("No readable text was found in this file.");
  if (wordCount > UPLOAD.maxWords) throw new Error("This document is longer than two million words, which is beyond what a single upload can hold.");
  const sample = sections.flatMap((s) => s.blocks.map((b) => b.text)).join(" ").slice(0, 60000);

  return {
    title: finalTitle.slice(0, 300),
    author: author?.slice(0, 300) ?? null,
    year,
    format,
    filename: file.name,
    kind: guessKind(format, wordCount, sample),
    sections,
    wordCount,
    warnings,
  };
}
