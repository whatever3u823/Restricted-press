# Athenaeum — architecture

## Shape

One Next.js application (App Router) on Postgres. Server components read the
database directly through `src/lib/library.ts`; mutations are server actions
(`src/app/actions.ts`) or route handlers under `src/app/api/`. Every query is
scoped to the signed-in reader (`owner_id`), so no document, passage,
highlight or question is visible across accounts.

## Data model (`src/db/schema.ts`)

- `documents` — one per upload, owned by a reader: title, author, year, kind,
  format, reading status and place, the Archivist's abstract and subjects,
  key terms, the reader's notes, counts.
- `sections` → `passages` — the extracted text. Passages are the unit of
  search, citation and highlighting. IDs are stable and readable:
  `{document}.{section}.{paragraph}`, e.g. `42.003.0012`. Each carries its
  owner (denormalised for scoped search), its kind, and the PDF page where
  known. A generated `tsvector` column backs full-text search.
- `collections`, `collection_documents`, `highlights` — organisation.
- `entitlements` — plans (`fellow`), with a `source` so payments can plug in.
- `research_queries` — every Archivist exchange: history and daily quotas.
- Better Auth tables for accounts and sessions.

## Upload pipeline

1. **Parse in the browser** (`src/lib/parse/`). PDF via unpdf (pdf.js): lines
   are rebuilt from text positions; running headers, footers and page numbers
   are removed; headings come from the PDF outline or from type size; lines
   join into paragraphs by spacing, indentation and punctuation, mending
   hyphenation. EPUB via fflate (spine order, table-of-contents titles). Word
   via mammoth. Text and Markdown by their own rules. Everything becomes a
   `ParsedDocument` of sections of blocks (`model.ts`), split into readable
   sections when a document has no usable headings.
2. **Send in batches** (`POST /api/documents`, `…/sections`, `…/finalize`) so a
   large book stays under request size limits. The server re-validates every
   batch (zod), splits very long paragraphs at sentence boundaries, numbers
   passages, and enforces plan limits.
3. **Finalise**: counts and key terms (`src/lib/terms.ts`); then, after the
   response, the Archivist writes a catalogue entry (abstract + subjects).

## Retrieval and the Archivist

`src/lib/search/retriever.ts` is the single seam between a question and
evidence: Postgres full-text search over the reader's passages, ranked by how
many of the question's concepts a passage touches, with a per-document cap so
answers stay cross-textual. A semantic retriever can implement the same
interface later.

`src/lib/archivist/` runs question → understanding → retrieval → answer →
verification:

1. A model-written search plan widens the reader's words with synonyms and
   names the documents the question refers to (matched against the reader's
   own catalogue).
2. Passages are retrieved — per named document when the question names some.
3. Claude answers from the passages, sent as `search_result` blocks with
   citations enabled, one block per sentence.
4. Every citation is resolved back to an exact sentence of a stored passage;
   unresolvable citations are dropped and quotations not found in the
   passages are flagged. An answer with no citations is reported as
   insufficient. Without an API key, the Archivist returns the ranked
   passages ("sources only").

`npm run check:archivist` verifies these guarantees and the privacy boundary
with a scripted provider.

## Connections

Each document's key terms (frequent, non-generic words) are stored on
arrival. Connections weigh them by TF-IDF across the reader's library and
compare documents (and authors, by summing their documents) by cosine
similarity, reporting the shared terms. The Archivist can then trace any
connection through the text.

## Plans

`src/lib/viewer.ts` defines what each plan can do; `src/lib/config.ts` holds
limits and prices. Members: a capped library and a daily question limit.
Fellows: no practical limits, and deep research.
