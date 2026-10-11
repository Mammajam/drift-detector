import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

function createDb(url: string) {
  // Small pool: the app runs next to a managed Postgres with a low connection cap (override with DB_POOL_MAX).
  const max = Number(process.env.DB_POOL_MAX) || 5;
  const client = postgres(url, { max, idle_timeout: 20, connect_timeout: 10 });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as { __driftDb?: Db };

export const isDatabaseConfigured = () => Boolean(process.env.DATABASE_URL);

/** Lazily connects with DATABASE_URL; reused across hot reloads in dev. */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return (globalForDb.__driftDb ??= createDb(url));
}
