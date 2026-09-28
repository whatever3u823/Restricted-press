import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Neon and Supabase integrations on Vercel may set either name. */
export function databaseUrl() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set — connect a Postgres database.");
  return url;
}

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

// Reuse one connection pool across hot reloads in development. On serverless
// hosts keep the pool small and skip prepared statements, so pooled
// (PgBouncer-style) connection strings work.
const serverless = Boolean(process.env.VERCEL);
const client =
  globalForDb.sql ??
  postgres(databaseUrl(), { max: serverless ? 3 : 10, prepare: !serverless });
if (process.env.NODE_ENV !== "production") globalForDb.sql = client;

export const db = drizzle(client, { schema });
export { schema };
