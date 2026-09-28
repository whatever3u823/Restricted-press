/**
 * Connection string for build-time scripts (migrations, archive load).
 * Prefers the direct (unpooled) connection that Neon/Supabase integrations
 * provide, since schema changes should not go through a connection pooler.
 */
export function scriptDatabaseUrl() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!url) {
    console.error(
      "\n✗ No database is connected.\n" +
        "  Connect a Postgres database to this project (Vercel: Storage → Neon → Connect),\n" +
        "  then redeploy. Expected DATABASE_URL or POSTGRES_URL to be set.\n",
    );
    process.exit(1);
  }
  const host = url.replace(/^[^@]*@/, "").replace(/[/?].*$/, "");
  console.log(`Using database at ${host}`);
  return url;
}
