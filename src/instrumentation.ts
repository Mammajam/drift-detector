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

    if (process.env.SEED_DEMO_ON_START === "1") {
      const [{ getDb }, { seedDemo }] = await Promise.all([import("@/server/db"), import("@/server/db/queries")]);
      const seeded = await seedDemo(getDb(), process.env.PROJECT_NAME ?? "Drift Detector");
      console.log(seeded ? "[db] demo data loaded" : "[db] demo data skipped (project already has routes)");
    }

    // Optional shared account so judges can skip signup. Created once; an existing email is left alone.
    const demoEmail = process.env.SEED_DEMO_USER_EMAIL;
    const demoPassword = process.env.SEED_DEMO_USER_PASSWORD;
    if (demoEmail && demoPassword) {
      const [{ getDb }, { createUser, findUserByEmail }, { hashPassword }] = await Promise.all([
        import("@/server/db"),
        import("@/server/db/queries"),
        import("@/server/password"),
      ]);
      if (!(await findUserByEmail(getDb(), demoEmail))) {
        await createUser(getDb(), {
          email: demoEmail,
          name: process.env.SEED_DEMO_USER_NAME ?? "Demo reviewer",
          passwordHash: await hashPassword(demoPassword),
        });
        console.log("[db] demo account created");
      }
    }
  } catch (error) {
    // Don't take the whole app down; /api/health still reports the database state.
    console.error("[db] migration failed", error);
  }
}
