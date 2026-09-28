/**
 * Restricted Press ingestion.
 *
 *   npm run ingest -- fetch [slug...]   download source → clean → content/texts/<slug>.txt
 *   npm run ingest -- report [slug...]  show detected structure and validation warnings
 *   npm run ingest -- load [slug...]    write records, sections and passages to the database
 *
 * Records live in content/works/*.yaml (metadata, provenance, rights, structure hints).
 * Clean texts in content/texts/ are committed so every cleanup is reviewable in a diff.
 * Works whose status is not "published" are loaded as records without full text.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import YAML from "yaml";
import { z } from "zod";
import * as s from "../src/db/schema";
import { clean, decode } from "../src/ingest/clean";
import {
  authorRecordSchema,
  subjectRecordSchema,
  workRecordSchema,
  type WorkRecord,
} from "../src/ingest/record";
import { structure } from "../src/ingest/structure";
import { scriptDatabaseUrl } from "./db-url";

const ROOT = process.cwd();
const WORKS_DIR = path.join(ROOT, "content/works");
const TEXTS_DIR = path.join(ROOT, "content/texts");
const MANIFEST = path.join(TEXTS_DIR, "manifest.json");

type Manifest = Record<
  string,
  { retrievedFrom: string; retrievedAt: string; sha256: string; transcriptionNotes: string[]; removed: string[] }
>;

async function loadRecords(only: string[]) {
  const files = (await readdir(WORKS_DIR)).filter((f) => f.endsWith(".yaml")).sort();
  const records: WorkRecord[] = [];
  for (const f of files) {
    const parsed = workRecordSchema.safeParse(YAML.parse(await readFile(path.join(WORKS_DIR, f), "utf8")));
    if (!parsed.success) {
      console.error(`✗ ${f}\n${z.prettifyError(parsed.error)}`);
      process.exitCode = 1;
      continue;
    }
    if (parsed.data.slug + ".yaml" !== f) console.warn(`! ${f}: slug "${parsed.data.slug}" does not match filename`);
    records.push(parsed.data);
  }
  const accessions = new Map<number, string>();
  for (const r of records) {
    if (accessions.has(r.accession)) throw new Error(`Accession ${r.accession} used by ${accessions.get(r.accession)} and ${r.slug}`);
    accessions.set(r.accession, r.slug);
  }
  return only.length ? records.filter((r) => only.includes(r.slug)) : records;
}

async function readManifest(): Promise<Manifest> {
  return existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : {};
}

const hasText = (r: WorkRecord) => r.publication_status === "published";

/* ─────────────────────────────── fetch ─────────────────────────────── */

async function fetchTexts(records: WorkRecord[]) {
  await mkdir(TEXTS_DIR, { recursive: true });
  const manifest = await readManifest();
  for (const r of records.filter(hasText)) {
    const res = await fetch(r.source.fetch_url);
    if (!res.ok) {
      console.error(`✗ ${r.slug}: HTTP ${res.status} from ${r.source.fetch_url}`);
      process.exitCode = 1;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const raw = decode(buf, r.source.encoding);
    if (r.source.encoding === "utf-8" && raw.includes("�")) {
      console.warn(`! ${r.slug}: replacement characters found — is the source latin1?`);
    }
    const result = clean(raw);
    await writeFile(path.join(TEXTS_DIR, `${r.slug}.txt`), result.text);
    manifest[r.slug] = {
      retrievedFrom: r.source.fetch_url,
      retrievedAt: new Date().toISOString(),
      sha256: createHash("sha256").update(buf).digest("hex"),
      transcriptionNotes: result.transcriptionNotes,
      removed: result.removed,
    };
    console.log(`✓ ${r.slug}: ${(result.text.length / 1024).toFixed(0)} KB, ${result.removed.length} provider paragraph(s) removed`);
  }
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

/* ─────────────────────────────── report ─────────────────────────────── */

async function parseText(r: WorkRecord) {
  const file = path.join(TEXTS_DIR, `${r.slug}.txt`);
  if (!existsSync(file)) throw new Error(`${r.slug}: no clean text — run "fetch" first`);
  return structure(r, await readFile(file, "utf8"));
}

async function report(records: WorkRecord[]) {
  for (const r of records) {
    const acc = String(r.accession).padStart(4, "0");
    if (!hasText(r)) {
      console.log(`\nFILE ${acc}  ${r.title}  [${r.publication_status} — record only]`);
      continue;
    }
    const { sections, warnings } = await parseText(r);
    const passages = sections.flatMap((x) => x.passages);
    const words = passages.reduce((n, p) => n + p.wordCount, 0);
    console.log(`\nFILE ${acc}  ${r.title}  — ${sections.length} sections, ${passages.length} passages, ${words.toLocaleString()} words`);
    for (const sec of sections) {
      const w = sec.passages.reduce((n, p) => n + p.wordCount, 0);
      console.log(`  ${String(sec.ordinal).padStart(3)} ${sec.level === 2 ? "  · " : ""}${sec.title.slice(0, 80)}  (${sec.passages.length} ¶, ${w} w)`);
    }
    for (const w of warnings) console.log(`  ! ${w}`);
    const rightsOpen = r.rights.filter((x) => x.status === "needs_review" || x.confidence === "low");
    for (const x of rightsOpen) console.log(`  ! rights: ${x.component} is ${x.status} (${x.confidence} confidence)`);
  }
}

/* ──────────────────────────────── load ──────────────────────────────── */

async function load(records: WorkRecord[]) {
  const client = postgres(scriptDatabaseUrl(), { max: 1, connect_timeout: 30, onnotice: () => {} });
  const db = drizzle(client, { schema: s });
  const manifest = await readManifest();

  const authors = z.array(authorRecordSchema).parse(YAML.parse(await readFile(path.join(ROOT, "content/authors.yaml"), "utf8")));
  const subjects = z.array(subjectRecordSchema).parse(YAML.parse(await readFile(path.join(ROOT, "content/subjects.yaml"), "utf8")));

  for (const a of authors) {
    const values = {
      slug: a.slug,
      name: a.name,
      sortName: a.sort_name,
      birthYear: a.birth_year ?? null,
      deathYear: a.death_year ?? null,
      note: a.note ?? null,
    };
    await db.insert(s.authors).values(values).onConflictDoUpdate({ target: s.authors.slug, set: values });
  }
  for (const x of subjects) {
    const values = { slug: x.slug, name: x.name, kind: x.kind, description: x.description ?? null };
    await db.insert(s.subjects).values(values).onConflictDoUpdate({ target: s.subjects.slug, set: values });
  }
  const authorIds = new Map((await db.select().from(s.authors)).map((a) => [a.slug, a.id]));
  const subjectIds = new Map((await db.select().from(s.subjects)).map((x) => [x.slug, x.id]));
  const need = <T>(map: Map<string, T>, key: string, what: string, where: string) => {
    const v = map.get(key);
    if (v === undefined) throw new Error(`${where}: unknown ${what} "${key}"`);
    return v;
  };

  for (const r of records) {
    const parsed = hasText(r) ? await parseText(r) : null;
    const wordCount = parsed ? parsed.sections.flatMap((x) => x.passages).reduce((n, p) => n + p.wordCount, 0) : 0;

    await db.transaction(async (tx) => {
      const values = {
        accession: r.accession,
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle ?? null,
        originalYear: r.original_year ?? null,
        originalYearBasis: r.original_year_basis,
        originalLanguage: r.original_language ?? null,
        categoryId: need(subjectIds, r.category, "category", r.slug),
        summary: r.summary.trim(),
        historicalContext: r.historical_context?.trim() ?? null,
        archivistNotes: r.archivist_notes?.trim() ?? null,
        contentStatus: r.content_status,
        publicationStatus: r.publication_status,
        accessLevel: r.access_level,
        featured: r.featured,
        archivistQuestions: r.archivist_questions,
        wordCount,
        updatedAt: new Date(),
      };
      const [work] = await tx
        .insert(s.works)
        .values(values)
        .onConflictDoUpdate({ target: s.works.accession, set: values })
        .returning({ id: s.works.id });
      const workId = work.id;

      await tx.delete(s.workAuthors).where(eq(s.workAuthors.workId, workId));
      await tx.insert(s.workAuthors).values(
        r.authors.map((a, i) => ({ workId, authorId: need(authorIds, a.slug, "author", r.slug), role: a.role, position: i })),
      );
      await tx.delete(s.workSubjects).where(eq(s.workSubjects.workId, workId));
      if (r.subjects.length) {
        await tx.insert(s.workSubjects).values(r.subjects.map((x) => ({ workId, subjectId: need(subjectIds, x, "subject", r.slug) })));
      }

      await tx.delete(s.editions).where(eq(s.editions.workId, workId));
      const [edition] = await tx
        .insert(s.editions)
        .values({
          workId,
          label: r.edition.label,
          publisher: r.edition.publisher ?? null,
          place: r.edition.place ?? null,
          year: r.edition.year ?? null,
          yearBasis: r.edition.year_basis,
          editionStatement: r.edition.edition_statement ?? null,
          imprint: r.edition.imprint ?? null,
          notes: r.edition.notes ?? null,
        })
        .returning({ id: s.editions.id });
      const m = manifest[r.slug];
      const notes = [r.source.transcription_notes?.trim(), ...(m?.transcriptionNotes ?? [])].filter(Boolean).join("\n\n");
      await tx.insert(s.sources).values({
        editionId: edition.id,
        provider: r.source.provider,
        identifier: r.source.identifier,
        url: r.source.url,
        retrievedFrom: m?.retrievedFrom ?? null,
        retrievedAt: m ? new Date(m.retrievedAt) : null,
        checksum: m?.sha256 ?? null,
        transcriptionNotes: notes || null,
        providerSubjects: r.source.provider_subjects,
      });

      await tx.delete(s.rightsRecords).where(eq(s.rightsRecords.workId, workId));
      await tx.insert(s.rightsRecords).values(
        r.rights.map((x) => ({
          workId,
          component: x.component,
          status: x.status,
          confidence: x.confidence,
          jurisdiction: x.jurisdiction,
          basis: x.basis,
          notes: x.notes ?? null,
          reviewedBy: x.reviewed_by ?? null,
          reviewedAt: x.reviewed_at ? new Date(x.reviewed_at) : null,
        })),
      );

      await tx.delete(s.plates).where(eq(s.plates.workId, workId));
      if (r.plates.length) {
        await tx.insert(s.plates).values(r.plates.map((p, i) => ({ workId, path: p.path, caption: p.caption, ordinal: i })));
      }
      await tx.delete(s.physicalEditions).where(eq(s.physicalEditions.workId, workId));
      if (r.physical_edition) {
        const pe = r.physical_edition;
        await tx.insert(s.physicalEditions).values({
          workId,
          name: pe.name,
          status: pe.status,
          description: pe.description ?? null,
          priceCents: pe.price_cents ?? null,
        });
      }

      // Text: upsert sections and passages so passage IDs (and anything that
      // references them, such as readers' saved passages) survive re-ingestion.
      const keepPassages: string[] = [];
      const keepSections: number[] = [];
      for (const sec of parsed?.sections ?? []) {
        const secValues = {
          workId,
          ordinal: sec.ordinal,
          title: sec.title,
          level: sec.level,
          matter: sec.matter,
          wordCount: sec.passages.reduce((n, p) => n + p.wordCount, 0),
        };
        const [row] = await tx
          .insert(s.sections)
          .values(secValues)
          .onConflictDoUpdate({ target: [s.sections.workId, s.sections.ordinal], set: secValues })
          .returning({ id: s.sections.id });
        keepSections.push(sec.ordinal);
        for (let i = 0; i < sec.passages.length; i += 500) {
          const batch = sec.passages.slice(i, i + 500).map((p) => ({
            id: p.id,
            workId,
            sectionId: row.id,
            ordinal: p.ordinal,
            kind: p.kind,
            text: p.text,
            wordCount: p.wordCount,
          }));
          await tx
            .insert(s.passages)
            .values(batch)
            .onConflictDoUpdate({
              target: s.passages.id,
              set: {
                sectionId: sql`excluded.section_id`,
                ordinal: sql`excluded.ordinal`,
                kind: sql`excluded.kind`,
                text: sql`excluded.text`,
                wordCount: sql`excluded.word_count`,
              },
            });
          keepPassages.push(...batch.map((b) => b.id));
        }
      }
      await tx
        .delete(s.passages)
        .where(keepPassages.length ? and(eq(s.passages.workId, workId), notInArray(s.passages.id, keepPassages)) : eq(s.passages.workId, workId));
      await tx
        .delete(s.sections)
        .where(keepSections.length ? and(eq(s.sections.workId, workId), notInArray(s.sections.ordinal, keepSections)) : eq(s.sections.workId, workId));
    });
    console.log(`✓ FILE ${String(r.accession).padStart(4, "0")} ${r.title}${parsed ? ` — ${wordCount.toLocaleString()} words` : " — record only"}`);
  }

  // Relations are resolved after all works exist. Stored in both directions.
  const all = await loadRecords([]);
  const ids = new Map((await db.select({ id: s.works.id, slug: s.works.slug }).from(s.works)).map((w) => [w.slug, w.id]));
  const touched = records.map((r) => ids.get(r.slug)!).filter(Boolean);
  if (touched.length) await db.delete(s.workRelations).where(inArray(s.workRelations.fromWorkId, touched));
  for (const r of all) {
    for (const rel of r.related) {
      const from = ids.get(r.slug);
      const to = ids.get(rel.slug);
      if (!from || !to) {
        console.warn(`! ${r.slug}: related record "${rel.slug}" not loaded`);
        continue;
      }
      for (const [a, b] of [[from, to], [to, from]]) {
        await db
          .insert(s.workRelations)
          .values({ fromWorkId: a, toWorkId: b, kind: rel.kind, note: rel.note ?? null })
          .onConflictDoNothing();
      }
    }
  }
  await client.end();
}

/* ─────────────────────────────── main ─────────────────────────────── */

const [command, ...slugs] = process.argv.slice(2);
const records = await loadRecords(slugs);
switch (command) {
  case "fetch":
    await fetchTexts(records);
    break;
  case "report":
    await report(records);
    break;
  case "load":
    await load(records);
    break;
  default:
    console.log("usage: npm run ingest -- <fetch|report|load> [slug...]");
    process.exitCode = 1;
}
