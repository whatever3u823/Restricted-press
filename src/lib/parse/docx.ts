/** Word (.docx) → blocks, via mammoth's HTML conversion. Browser only. */
import { strFromU8, unzipSync } from "fflate";
import { htmlToBlocks, parseHtml } from "./html";
import { yearFrom } from "./model";

export async function parseDocx(data: Uint8Array) {
  const mammoth = await import("mammoth");
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const doc = parseHtml(`<body>${html}</body>`);
  const blocks = htmlToBlocks(doc.body);

  // Title, author and date from the document's own properties.
  let title: string | null = null;
  let author: string | null = null;
  let year: number | null = null;
  try {
    const core = unzipSync(data, { filter: (f) => f.name === "docProps/core.xml" })["docProps/core.xml"];
    if (core) {
      const xml = parseHtml(strFromU8(core), "application/xml");
      const get = (name: string) =>
        Array.from(xml.getElementsByTagName("*")).find((e) => e.localName === name)?.textContent?.trim() || null;
      title = get("title");
      author = get("creator");
      year = yearFrom(get("created"));
    }
  } catch {}
  return { blocks, title, author, year };
}
