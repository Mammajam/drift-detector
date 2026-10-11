import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("is ok when the database answers", async () => {
    const report = await checkHealth({ ping: async () => {}, production: true });
    expect(report).toEqual({ httpStatus: 200, body: { status: "ok", database: "ok" } });
  });

  it("is degraded, without leaking the error, when the database fails", async () => {
    const report = await checkHealth({
      ping: async () => {
        throw new Error("password authentication failed for user admin at db.internal");
      },
      production: true,
    });
    expect(report.httpStatus).toBe(503);
    expect(JSON.stringify(report)).not.toContain("admin");
  });

  it("is degraded when the database hangs", async () => {
    const report = await checkHealth({ ping: () => new Promise(() => {}), production: true, timeoutMs: 20 });
    expect(report.body.database).toBe("unreachable");
  });

  it("tolerates a missing database locally but not in production", async () => {
    expect((await checkHealth({ ping: null, production: false })).httpStatus).toBe(200);
    expect((await checkHealth({ ping: null, production: true })).httpStatus).toBe(503);
  });
});
