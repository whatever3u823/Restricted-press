import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { scriptDatabaseUrl } from "./db-url";

const client = postgres(scriptDatabaseUrl(), { max: 1, connect_timeout: 30, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} catch (err) {
  const e = err as { message?: string; cause?: { message?: string } };
  console.error("\n✗ Database setup failed:", e.cause?.message ?? e.message ?? err, "\n");
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
