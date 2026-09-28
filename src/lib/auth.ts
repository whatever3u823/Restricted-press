import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";

/**
 * The site's own address. Set BETTER_AUTH_URL in production; on Vercel it
 * falls back to the production domain, and preview deployments are trusted.
 */
const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const baseURL =
  process.env.BETTER_AUTH_URL ?? (vercelProduction ? `https://${vercelProduction}` : "http://localhost:3000");
/**
 * Trust the configured address plus the address this request was served
 * from (a Vercel site answers on its production, deployment and branch
 * domains). Requests whose Origin is any other site are still rejected.
 */
async function trustedOrigins(request?: Request) {
  const origins = [baseURL];
  const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
  if (host) {
    const proto = request?.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    origins.push(`${proto}://${host}`);
  }
  return origins;
}

/**
 * Session-signing secret. Prefer an explicit BETTER_AUTH_SECRET; otherwise
 * derive a stable one from the (already secret) database URL so a first
 * deployment needs no manual setup. Changing the database password then
 * signs everyone out, which is acceptable at this stage.
 */
const secret =
  process.env.BETTER_AUTH_SECRET ||
  createHash("sha256")
    .update(`restricted-press-auth:${process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "dev"}`)
    .digest("hex");

export const auth = betterAuth({
  secret,
  baseURL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
  },
  plugins: [nextCookies()],
});
