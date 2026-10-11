import "server-only";

export type HealthReport = {
  httpStatus: 200 | 503;
  body: { status: "ok" | "degraded"; database: "ok" | "unreachable" | "not-configured" };
};

type HealthInput = {
  /** Resolves if the database answers; null when DATABASE_URL isn't set. */
  ping: (() => Promise<void>) | null;
  production: boolean;
  timeoutMs?: number;
};

/** Health for Deployxa's checks. Never includes error text, hosts or credentials. */
export async function checkHealth({ ping, production, timeoutMs = 3000 }: HealthInput): Promise<HealthReport> {
  if (!ping) {
    // Running without a database is fine locally, but a production deploy must have one.
    return production
      ? { httpStatus: 503, body: { status: "degraded", database: "not-configured" } }
      : { httpStatus: 200, body: { status: "ok", database: "not-configured" } };
  }
  try {
    await Promise.race([
      ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    return { httpStatus: 200, body: { status: "ok", database: "ok" } };
  } catch {
    return { httpStatus: 503, body: { status: "degraded", database: "unreachable" } };
  }
}
