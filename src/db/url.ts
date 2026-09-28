/**
 * Find the Postgres connection string. Database integrations on Vercel set
 * DATABASE_URL or POSTGRES_URL, but may add a custom prefix
 * (e.g. STORAGE_DATABASE_URL), so any variable holding a postgres:// URL is
 * accepted. `direct` prefers unpooled connections (for migrations).
 */
export function findDatabaseUrl({ direct = false } = {}): string | undefined {
  const env = process.env;
  const preferred = direct
    ? ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL", "POSTGRES_URL"]
    : ["DATABASE_URL", "POSTGRES_URL"];
  for (const k of preferred) if (env[k]) return env[k];
  const candidates = Object.entries(env)
    .filter(([, v]) => typeof v === "string" && /^postgres(ql)?:\/\//.test(v))
    .map(([k, v]) => ({ k, v: v as string }));
  const pick = (re: RegExp) => candidates.find((c) => re.test(c.k))?.v;
  return direct
    ? (pick(/UNPOOLED|NON_POOLING/) ?? pick(/DATABASE_URL$|POSTGRES_URL$/) ?? candidates[0]?.v)
    : (pick(/DATABASE_URL$|POSTGRES_URL$/) ?? candidates.find((c) => !/UNPOOLED|NON_POOLING/.test(c.k))?.v ?? candidates[0]?.v);
}
