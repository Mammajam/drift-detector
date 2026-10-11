import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { AddressInfo } from "node:net";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";

describe("runMigrations (over a Postgres connection)", () => {
  let pglite: PGlite;
  let server: PGLiteSocketServer;
  let url: string;

  beforeAll(async () => {
    pglite = await PGlite.create();
    server = new PGLiteSocketServer({ db: pglite, port: 0, host: "127.0.0.1" });
    await server.start();
    const { port } = (server as unknown as { server: { address(): AddressInfo } }).server.address();
    url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  });

  afterAll(async () => {
    await server.stop();
    await pglite.close();
  });

  it("creates the tables, and a second run is a no-op", async () => {
    await runMigrations(url);
    await runMigrations(url);

    const sql = postgres(url, { max: 1 });
    const rows = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
    await sql.end({ timeout: 5 });
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(["projects", "routes", "captures", "capture_images", "drifts", "signoffs"]),
    );
  });
});
