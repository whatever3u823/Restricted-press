/**
 * Escape text for HTML, then allow back only the <mark> tags that Postgres
 * ts_headline inserts. Use for every search snippet rendered as HTML.
 */
export function markedSnippet(snippet: string) {
  return snippet
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;mark&gt;/g, "<mark>")
    .replace(/&lt;\/mark&gt;/g, "</mark>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");
}
