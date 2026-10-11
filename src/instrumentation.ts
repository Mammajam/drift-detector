// Runs once when the Next.js server starts (not during `next build`).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Only in production, so local dev never touches a database unless you run `npm run db:migrate`.
  if (process.env.NODE_ENV !== "production") return;
  const url = process.env.DATABASE_URL;
  if (!url || process.env.RUN_MIGRATIONS_ON_START === "0") return;

  try {
    const { runMigrations } = await import("@/server/db/migrate");
    await runMigrations(url);
    console.log("[db] migrations up to date");
  } catch (error) {
    // Don't take the whole app down; /api/health still reports the database state.
    console.error("[db] migration failed", error);
  }
}
