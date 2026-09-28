import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

// Reuse one connection pool across hot reloads in development. On serverless
// hosts keep the pool small and skip prepared statements, so pooled
// (PgBouncer-style) connection strings work.
const serverless = Boolean(process.env.VERCEL);
const client =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, { max: serverless ? 3 : 10, prepare: !serverless });
if (process.env.NODE_ENV !== "production") globalForDb.sql = client;

export const db = drizzle(client, { schema });
export { schema };
