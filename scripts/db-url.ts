/**
 * Connection string for build-time scripts (migrations, archive load).
 * Prefers the direct (unpooled) connection that Neon/Supabase integrations
 * provide, since schema changes should not go through a connection pooler.
 */
import { findDatabaseUrl } from "../src/db/url";

export function scriptDatabaseUrl() {
  const url = findDatabaseUrl({ direct: true });
  if (!url) {
    console.error(
      "\n✗ No database is connected.\n" +
        "  Connect a Postgres database to this project (Vercel: Storage → Neon → Connect),\n" +
        "  then redeploy. No environment variable containing a postgres:// address was found.\n" +
        `  Database-looking variables present: ${Object.keys(process.env).filter((k) => /DATABASE|POSTGRES|PG|NEON/i.test(k)).join(", ") || "none"}\n`,
    );
    process.exit(1);
  }
  const host = url.replace(/^[^@]*@/, "").replace(/[/?].*$/, "");
  console.log(`Using database at ${host}`);
  return url;
}
