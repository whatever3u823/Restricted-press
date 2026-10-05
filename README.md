# Athenaeum

A private library and research instrument for serious readers. Readers upload
their own books, papers and articles; read them in a reading room built for
concentration; and question them with **the Archivist** — a librarian with
perfect recall of the reader's library, which answers only from it and cites
the exact sentences behind every claim.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design.

## What it does

- **Collect** — upload PDF, EPUB, Word (.docx), text, Markdown and HTML.
  Files are parsed in the browser; their text is divided into sections and
  passages, indexed for full-text search, and (with a model configured)
  catalogued by the Archivist with an abstract and subject headings.
- **Organise** — collections, reading status, notes, and editable details.
- **Read** — a reading room with three lighting modes, adjustable type and
  measure, contents, find-in-document, highlights with notes, and a kept place.
- **Interrogate** — the Archivist answers from the reader's library alone,
  with sentence-level citations (and page numbers for PDFs). Deep research
  compares authors across documents.
- **Connect** — documents and authors that share distinctive ground are
  surfaced, and any connection can be traced by the Archivist.

Everything is private to the reader's account: every query is scoped by owner.

## Stack

Next.js 16 (App Router, TypeScript) · Postgres (full-text search, `unaccent`)
· Drizzle ORM · Better Auth (email + password) · Anthropic SDK (Claude,
optional) · unpdf / fflate / mammoth for in-browser parsing · self-hosted
fonts (Newsreader, Inter Tight, IBM Plex Mono).

## Running locally

Requires Node 22+ and Postgres 14+ with the `unaccent` and `pg_trgm`
extensions available (both ship with standard Postgres).

```bash
npm install
cp .env.example .env.local           # then set DATABASE_URL and BETTER_AUTH_SECRET
createdb athenaeum                   # or point DATABASE_URL at Neon/Supabase
npm run db:migrate                   # schema + extensions
npm run dev                          # http://localhost:3000
```

### The Archivist and Claude

Without `ANTHROPIC_API_KEY` the Archivist runs in **sources-only mode**: it
returns the ranked, linked passages it would read, with no generated prose,
and documents are not catalogued. Set the key to enable written, cited answers
and catalogue entries. The model is `ARCHIVIST_MODEL` (default
`claude-opus-5-5`); answers use the server-side refusal fallback
(`fallbacks: "default"`).

### Membership in development

Payments are not connected. With `ALLOW_DEV_UPGRADE=true`, a signed-in reader
can activate a preview Fellowship from `/membership` (no charge).

## Deploying to Vercel

`vercel.json` runs `npm run vercel-build`, which applies migrations and builds
Next.js. Connect a Postgres database (Storage → Neon), which sets
`DATABASE_URL`.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables written Archivist answers and cataloguing (otherwise sources-only) |
| `ARCHIVIST_MODEL` | Optional model override (default `claude-opus-5-5`) |
| `ALLOW_DEV_UPGRADE=true` | Lets signed-in readers try the Fellowship free (private previews only) |
| `BETTER_AUTH_SECRET` | Explicit session secret; otherwise derived from the database URL |
| `BETTER_AUTH_URL` | Canonical site URL; otherwise the Vercel production domain |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run check:archivist` | Verify the Archivist's grounding and privacy guarantees (no API key needed) |

## Business configuration

The Fellowship price, library and question limits, retrieval sizes and upload
limits live in `src/lib/config.ts`. Feature access for each plan is defined
once, in `src/lib/viewer.ts`.
