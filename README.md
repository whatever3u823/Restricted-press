# Restricted Press — The Archive

A curated digital archive of obscure and historically significant texts, with
**the Archivist**: a retrieval-grounded research assistant that answers only
from the archive and cites the exact sentences behind every claim.

This repository is the MVP: archive browsing and search, dossiers, a reader,
the Archivist, accounts, Inner Archive gating, and a seed collection of
18 records (17 public-domain full texts, ~1.37M words, one record held for
rights review).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design.

## Stack

Next.js 16 (App Router, TypeScript) · Postgres (full-text search, `pg_trgm`,
`unaccent`) · Drizzle ORM · Better Auth (email + password) · Anthropic SDK
(Claude, optional) · self-hosted fonts (EB Garamond, IBM Plex).

## Running locally

Requires Node 22+ and Postgres 14+ with the `unaccent` and `pg_trgm`
extensions available (both ship with standard Postgres).

```bash
npm install
cp .env.example .env.local           # then set DATABASE_URL and BETTER_AUTH_SECRET
createdb restricted_press            # or point DATABASE_URL at Neon/Supabase
npm run db:migrate                   # schema + extensions
npm run ingest -- load               # load the committed archive texts
npm run dev                          # http://localhost:3000
```

The migration creates the `unaccent` and `pg_trgm` extensions; on a managed
database the connecting role needs permission to do so (or create them once as
an administrator).

### The Archivist and Claude

Without `ANTHROPIC_API_KEY` the Archivist runs in **retrieval-only mode**: it
returns the ranked, linked passages it would read, with no generated prose.
Set the key to enable written, cited answers. The model is `ARCHIVIST_MODEL`
(default `claude-opus-5`); requests use the server-side refusal fallback
(`fallbacks: "default"`).

### Membership in development

Payments are not connected. With `ALLOW_DEV_UPGRADE=true`, a signed-in reader
can activate a preview Inner Archive membership from `/membership` (no charge).
Set it to `false` in any public deployment.

## Deploying to Vercel

The repository deploys with no manual configuration beyond a database.
`vercel.json` runs `npm run vercel-build`, which applies migrations, loads the
archive texts (idempotent, ~10s), then builds Next.js.

1. Import the GitHub repo at vercel.com/new and deploy. (The first build fails
   until a database is connected — expected.)
2. In the project, **Storage → Create Database → Neon** (free), connect it to
   the project. This sets `DATABASE_URL`.
3. **Deployments → ⋯ → Redeploy.**

Optional environment variables:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables written Archivist answers (otherwise retrieval-only) |
| `ALLOW_DEV_UPGRADE=true` | Lets signed-in readers try the Inner Archive free (private previews only) |
| `BETTER_AUTH_SECRET` | Explicit session secret; otherwise derived from the database URL |
| `BETTER_AUTH_URL` | Canonical site URL; otherwise the Vercel production domain |

Every build runs migrations against the connected database. Neon's Vercel
integration gives preview deployments their own database branch; keep it that
way so previews cannot change production data.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run ingest -- fetch [slug…]` | Download source → clean → `content/texts/<slug>.txt` |
| `npm run ingest -- report [slug…]` | Show detected sections/passages and warnings |
| `npm run ingest -- load [slug…]` | Write records, rights, sections and passages to the DB |
| `npm run check:archivist` | Verify the Archivist's grounding guarantees (no API key needed) |

## Adding a text

1. Create `content/works/<slug>.yaml` (copy an existing record). Fill in the
   bibliographic record from the **title page**, and record how every date is
   known (`title_page`, `curatorial`, `unknown`).
2. Record rights **per component** (text, translation, introduction,
   illustrations, edition) with basis and confidence. If anything is uncertain,
   set `publication_status: rights_review` — the record is catalogued but its
   text is withheld.
3. `npm run ingest -- fetch <slug>` and review the diff of
   `content/texts/<slug>.txt`.
4. `npm run ingest -- report <slug>` and adjust `structure:` hints until the
   sections are right.
5. `npm run ingest -- load <slug>`.

Passage IDs (`0017.003.0012`) are stable across re-ingestion as long as the
structure is unchanged, so readers' saved passages survive reloads.

## Business configuration

Membership price, Archivist quotas and retrieval sizes live in
`src/lib/config.ts`. Physical edition prices live on each record. Feature
access for each plan is defined once, in `src/lib/viewer.ts`.

## Content & rights

Texts are transcriptions from Project Gutenberg (retrieved via the GITenberg
mirror), recorded as public domain in the United States. Provider licence
text and references are removed at ingestion, as the provider's trademark
terms require for redistribution. Rights notes in each dossier are
preliminary curatorial research, not legal advice. Summaries and context
marked "Curatorial draft" await editorial review.
