import "server-only";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Applies pending migrations from ./drizzle. Safe to run on every start: applied ones are skipped. */
export async function runMigrations(url: string, folder = path.join(process.cwd(), "drizzle")) {
  const client = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    await migrate(drizzle(client), { migrationsFolder: folder });
  } finally {
    await client.end({ timeout: 5 });
  }
}
