/** HTML (EPUB chapters, Word documents via mammoth, saved web pages) → blocks. Browser only. */
import type { Block } from "./model";

const SKIP = new Set(["script", "style", "noscript", "template", "svg", "math", "head", "iframe", "object", "button", "form", "nav", "aside"]);
const BLOCK = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "li", "dd", "dt", "figcaption", "caption",
  "div", "section", "article", "main", "body", "header", "footer", "ul", "ol", "dl", "figure", "table",
  "thead", "tbody", "tfoot", "tr", "td", "th", "hr", "address", "center", "hgroup",
]);

/** Text of an element; <br> becomes a line break; footnote markers are dropped. */
function textOf(el: Element): string {
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent ?? "";
    else if (n.nodeType === 1) {
      const e = n as Element;
      const tag = e.localName.toLowerCase();
      if (SKIP.has(tag)) return;
      if (tag === "br") out += "\n";
      else if (tag === "sup" && (e.querySelector("a") || /noteref/.test(e.getAttribute("epub:type") ?? ""))) return;
      else if (tag === "a" && /noteref/.test(e.getAttribute("epub:type") ?? e.getAttribute("role") ?? "")) return;
      else if (tag === "img") return;
      else out += textOf(e);
    }
  });
  return out;
}

function hasBlockChild(el: Element) {
  for (const c of Array.from(el.children)) if (BLOCK.has(c.localName.toLowerCase())) return true;
  return false;
}

export function htmlToBlocks(root: Element): Block[] {
  const blocks: Block[] = [];
  const walk = (el: Element, inQuote: boolean) => {
    const tag = el.localName.toLowerCase();
    if (SKIP.has(tag)) return;
    if (/^h[1-6]$/.test(tag)) {
      const t = textOf(el).replace(/\s+/g, " ").trim();
      if (t) blocks.push({ kind: "heading", level: Number(tag[1]), text: t });
      return;
    }
    if (tag === "pre") {
      blocks.push({ kind: "code", text: el.textContent ?? "" });
      return;
    }
    if (tag === "tr") {
      const cells = Array.from(el.children).map((c) => textOf(c).replace(/\s+/g, " ").trim()).filter(Boolean);
      if (cells.length) blocks.push({ kind: "paragraph", text: cells.join(" · ") });
      return;
    }
    if (tag === "blockquote") {
      if (hasBlockChild(el)) Array.from(el.children).forEach((c) => walk(c, true));
      else push(textOf(el), true);
      return;
    }
    if (!hasBlockChild(el) || tag === "p") {
      const raw = textOf(el);
      if (tag === "li") push(`• ${raw.trim()}`, inQuote);
      else push(raw, inQuote);
      return;
    }
    // Mixed content: text directly inside a container counts as its own paragraph.
    let loose = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === 1 && BLOCK.has((n as Element).localName.toLowerCase())) {
        if (loose.trim()) push(loose, inQuote);
        loose = "";
        walk(n as Element, inQuote);
      } else if (n.nodeType === 1) loose += textOf(n as Element);
      else if (n.nodeType === 3) loose += n.textContent ?? "";
    });
    if (loose.trim()) push(loose, inQuote);
  };
  const push = (raw: string, quote: boolean) => {
    const lines = raw.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!lines.length) return;
    // Several short lines separated by <br>: verse or set-out matter.
    if (lines.length > 1 && lines.every((l) => l.length < 70)) blocks.push({ kind: "verse", text: lines.join("\n") });
    else blocks.push({ kind: quote ? "quote" : "paragraph", text: lines.join(" ") });
  };
  walk(root, false);
  return blocks;
}

export function parseHtml(source: string, type: DOMParserSupportedType = "text/html") {
  const doc = new DOMParser().parseFromString(source, type);
  if (doc.querySelector("parsererror") && type !== "text/html") return new DOMParser().parseFromString(source, "text/html");
  return doc;
}
