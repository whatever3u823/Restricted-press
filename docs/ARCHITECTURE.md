# Architecture

The smallest system that proves the product: one Next.js application, one
Postgres database, an optional language-model provider. No queues, no vector
store, no separate services.

```
Browser ──► Next.js (server components, route handlers, server actions)
              │
              ├── src/lib/archive.ts        catalogue queries (works, dossiers, reader)
              ├── src/lib/search/           controlled vocabulary + Retriever interface
              ├── src/lib/archivist/        understand → retrieve → answer → verify
              ├── src/lib/viewer.ts         session → plan → features (all gating)
              └── src/db/                   Drizzle schema + client
                        │
                     Postgres  (tsvector GIN index on passages, unaccent, pg_trgm)

content/works/*.yaml ─┐
content/texts/*.txt ──┴─► scripts/ingest.ts ─► Postgres
```

## Data model

| Entity | Purpose |
|---|---|
| `works` | The archive record. Accession number (FILE 0017), catalogue fields, curatorial prose with a review status, publication status (`draft`, `rights_review`, `published`, `withheld`) and access level (`open`, `inner`). |
| `authors`, `work_authors` | People, with roles (author, editor, translator, introducer). |
| `subjects`, `work_subjects` | One table for shelves (category) and subject headings. |
| `editions`, `sources` | The printed edition transcribed, and where the digital text came from (provider, id, retrieval date, checksum, transcribers' notes). |
| `rights_records` | Rights **per component** — status, confidence, jurisdiction, basis, notes, reviewer. |
| `sections`, `passages` | Full text. Passages are paragraphs with stable IDs `{accession}.{section}.{paragraph}` and a generated `tsvector`. The unit of search, citation and saving. |
| `work_relations` | Curated links with a note on why; computed links come from shared subjects. |
| `plates`, `physical_editions` | Illustrations; Restricted Editions (price per edition). |
| `user`, `session`, `account`, `verification` | Better Auth. |
| `entitlements` | Plan grants with a `source` (`dev` now; `stripe`, `seal` later). |
| `saved_works`, `saved_passages` | The personal library. |
| `research_queries` | Every Archivist exchange, and the basis for quotas. |

Deliberately not built yet: named collections, reading paths, embeddings,
order fulfilment.

## Page map

| Route | |
|---|---|
| `/` | Landing — register of the archive, featured records, live Archivist retrieval sample, membership, editions |
| `/archive` | Catalogue search and filters (shelf, period, availability, subject, author); **Passages** tab searches inside texts |
| `/archive/[slug]` | Dossier — cover sheet, about, context, contents, bibliographic record, source & provenance, rights table, archivist's notes, related records |
| `/archive/[slug]/read/[section]` | Reader — contents rail, in-text search, stable passage anchors, save/ask per passage |
| `/p/[id]` | Permanent passage link → reader, scrolled and highlighted |
| `/archivist` | The Archivist (scoped to a record with `?scope=`, to a passage with `?passage=`) |
| `/authors`, `/authors/[slug]`, `/subjects/[slug]` | Discovery trails |
| `/membership`, `/editions`, `/library`, `/account`, `/sign-in`, `/sign-up`, `/about` | |

## Retrieval and the Archivist

```
question
  └─ understand   controlled vocabulary expands concepts and historical
                  spellings; detects records the question names; in deep mode
                  Claude produces a structured search plan
  └─ retrieve     Retriever.retrieve() — Postgres FTS, ranked by concept
                  coverage then cover-density rank, capped per work so answers
                  stay cross-textual; a pinned passage always comes first
  └─ answer       passages sent to Claude as search_result blocks, one text
                  block per sentence, citations enabled
  └─ verify       each citation resolves to exact archive sentences (else
                  dropped + noted); quotations in prose are checked against
                  the passages (else flagged); no citations → "insufficient"
```

- **Grounding guarantee.** Quoted text shown to readers is always taken from
  the database, never from model output. `npm run check:archivist` tests this.
- **Provider-agnostic.** The pipeline depends on `AnswerProvider`
  (`src/lib/archivist/provider.ts`); Claude is one implementation.
- **Semantic search, later.** `Retriever` is the seam. A vector retriever
  (pgvector, on the same `passages` rows) can be added and fused with the
  lexical one by reciprocal-rank fusion without changing callers. The
  controlled vocabulary stays useful: embeddings handle early-modern spelling
  poorly.
- **Degrades honestly.** No API key → retrieval-only answers.

## Premium gating

`getViewer()` resolves the session to a plan (`visitor`, `reader`, `inner`)
and exposes `can(feature)`. Features: `archivist.deep`, `archivist.unlimited`,
`search.expanded`, `library.save`, `passages.save`, `text.inner`. Quotas are in
`config.ts`; visitor quotas use a cookie plus a salted hash of the client
address.

## Ingestion

Two stages with a reviewable artefact between them:

1. **fetch** — download, decode, strip the provider wrapper and notices, lift
   producer credits and transcriber's notes into provenance, restore ligature
   codes. Output is committed to `content/texts/` so every cleanup is a diff.
2. **load** — split into sections (per-record regex hints) and passages,
   validate, upsert by stable ID, record provenance and rights.

This is where OCR, automated metadata extraction and quality scoring slot in
later: they produce the same clean text and YAML record.

## Known risks

- **Rights.** US-only assessments; several records carry medium confidence
  (undated or reprint sources). The provider's trademark terms have been
  handled by removal, but crediting the provider in provenance should be
  confirmed by counsel.
- **Curatorial prose** is draft and marked as such until reviewed.
- **Lexical retrieval** misses paraphrase; the vocabulary mitigates but does
  not solve this. Embeddings are the next step once the corpus grows.
- **Model cost.** Default `claude-opus-5`; standard answers run at `medium`
  effort and deep research at `high`. Quotas cap free usage.
- **Structure detection** is regex-per-record; fine for 100 texts, not for
  thousands without heuristics or model assistance.
