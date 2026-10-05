/** EPUB → blocks, in reading (spine) order. Browser only. */
import { strFromU8, unzipSync } from "fflate";
import { htmlToBlocks, parseHtml } from "./html";
import type { Block } from "./model";
import { yearFrom } from "./model";

function resolve(base: string, href: string) {
  const parts = (base ? base.split("/") : []).concat(decodeURIComponent(href.split("#")[0]).split("/"));
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

export function parseEpub(data: Uint8Array) {
  const files = unzipSync(data);
  const read = (path: string) => {
    const f = files[path] ?? files[Object.keys(files).find((k) => k.toLowerCase() === path.toLowerCase()) ?? ""];
    return f ? strFromU8(f) : null;
  };

  const container = read("META-INF/container.xml");
  if (!container) throw new Error("This EPUB is missing its table of contents and could not be read.");
  const opfPath = parseHtml(container, "application/xml").querySelector("rootfile")?.getAttribute("full-path");
  const opfSource = opfPath ? read(opfPath) : null;
  if (!opfPath || !opfSource) throw new Error("This EPUB is damaged: its package file could not be found.");
  const opf = parseHtml(opfSource, "application/xml");
  const base = dirOf(opfPath);

  const meta = (name: string) => {
    const el = Array.from(opf.getElementsByTagName("*")).find((e) => e.localName === name);
    return el?.textContent?.trim() || null;
  };
  const creators = Array.from(opf.getElementsByTagName("*"))
    .filter((e) => e.localName === "creator")
    .map((e) => e.textContent?.trim())
    .filter(Boolean) as string[];

  const manifest = new Map<string, { href: string; type: string; props: string }>();
  for (const item of Array.from(opf.getElementsByTagName("*")).filter((e) => e.localName === "item")) {
    manifest.set(item.getAttribute("id") ?? "", {
      href: resolve(base, item.getAttribute("href") ?? ""),
      type: item.getAttribute("media-type") ?? "",
      props: item.getAttribute("properties") ?? "",
    });
  }
  const spine = Array.from(opf.getElementsByTagName("*"))
    .filter((e) => e.localName === "itemref" && e.getAttribute("linear") !== "no")
    .map((e) => manifest.get(e.getAttribute("idref") ?? ""))
    .filter((m): m is { href: string; type: string; props: string } => Boolean(m && /html|xml/.test(m.type)));

  // Chapter titles from the table of contents (EPUB 3 nav, or EPUB 2 NCX).
  const tocTitles = new Map<string, string>();
  const nav = [...manifest.values()].find((m) => m.props.split(" ").includes("nav"));
  const navSource = nav ? read(nav.href) : null;
  if (navSource && nav) {
    const doc = parseHtml(navSource, "application/xhtml+xml");
    const toc = Array.from(doc.querySelectorAll("nav")).find((n) => (n.getAttribute("epub:type") ?? "").includes("toc")) ?? doc.querySelector("nav");
    toc?.querySelectorAll("a[href]").forEach((a) => {
      const href = resolve(dirOf(nav.href), a.getAttribute("href") ?? "");
      if (!tocTitles.has(href)) tocTitles.set(href, (a.textContent ?? "").replace(/\s+/g, " ").trim());
    });
  } else {
    const ncx = [...manifest.values()].find((m) => m.type === "application/x-dtbncx+xml");
    const ncxSource = ncx ? read(ncx.href) : null;
    if (ncx && ncxSource) {
      const doc = parseHtml(ncxSource, "application/xml");
      for (const point of Array.from(doc.getElementsByTagName("*")).filter((e) => e.localName === "navPoint")) {
        const label = Array.from(point.children).find((c) => c.localName === "navLabel")?.textContent?.replace(/\s+/g, " ").trim();
        const src = Array.from(point.children).find((c) => c.localName === "content")?.getAttribute("src");
        if (label && src) {
          const href = resolve(dirOf(ncx.href), src);
          if (!tocTitles.has(href)) tocTitles.set(href, label);
        }
      }
    }
  }

  const blocks: Block[] = [];
  for (const item of spine) {
    if (item.props.split(" ").includes("nav")) continue;
    const source = read(item.href);
    if (!source) continue;
    const doc = parseHtml(source, "application/xhtml+xml");
    const body = doc.querySelector("body") ?? doc.documentElement;
    const chapter = htmlToBlocks(body);
    if (!chapter.some((b) => b.kind !== "heading")) continue;
    const tocTitle = tocTitles.get(item.href);
    const first = chapter.find((b) => b.kind === "heading");
    // Give the chapter its table-of-contents title unless it already opens with a heading.
    if (tocTitle && (!first || chapter.indexOf(first) > 2)) blocks.push({ kind: "heading", level: 1, text: tocTitle });
    blocks.push(...chapter);
  }

  return {
    blocks,
    title: meta("title"),
    author: creators.length ? creators.join("; ") : null,
    year: yearFrom(meta("date")),
  };
}
