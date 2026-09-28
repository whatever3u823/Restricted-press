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
const trustedOrigins = [baseURL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null].filter(
  (o): o is string => Boolean(o),
);

export const auth = betterAuth({
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
