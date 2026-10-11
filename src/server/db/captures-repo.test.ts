import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { Capture } from "@/lib/types";
import { getLatestCaptures, saveCaptures, type AnyDb, type RouteInput } from "./captures-repo";
import * as schema from "./schema";

const route: RouteInput = {
  projectName: "Drift Detector",
  path: "/pricing",
  figmaFileKey: "AbC123xyz",
  figmaNodeId: "1:1",
};

const png = (bytes: number[]) => `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;

function capture(overrides: Partial<Capture> = {}): Capture {
  return {
    route: "/pricing",
    previewUrl: "https://pr-42.deployxa.app/pricing",
    commitSha: "a1b2c3d",
    breakpoint: 375,
    theme: "light",
    frame: { width: 375, height: 900 },
    score: 12,
    images: { design: png([1, 2, 3]), build: png([4, 5, 6, 7]) },
    drifts: [
      { id: "d1", label: "Mismatch 1", expected: "#2f5bea", actual: "#e58a1f", bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, status: "open" },
      { id: "d2", label: "Mismatch 2", expected: "10", actual: "6", token: "radius-md", bbox: { x: 0, y: 0, w: 1, h: 0.1 }, status: "wont-fix" },
    ],
    ...overrides,
  };
}

let db: AnyDb;

beforeEach(async () => {
  const client = new PGlite();
  const pg = drizzle(client, { schema });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  db = pg as unknown as AnyDb;
});

describe("captures repository", () => {
  it("round-trips captures, drifts and image bytes", async () => {
    const [saved] = await saveCaptures(db, route, [capture()]);
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);

    const [loaded] = await getLatestCaptures(db, route);
    expect(loaded).toMatchObject({
      id: saved.id,
      breakpoint: 375,
      theme: "light",
      frame: { width: 375, height: 900 },
      score: 12,
      commitSha: "a1b2c3d",
    });
    expect(loaded.drifts).toHaveLength(2);
    expect(loaded.drifts[0].ticketId).toMatch(/^[0-9a-f-]{36}$/);
    expect(loaded.drifts[0]).toMatchObject({ id: "d1", expected: "#2f5bea", bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } });
    expect(loaded.drifts[1]).toMatchObject({ id: "d2", token: "radius-md", status: "wont-fix" });
    expect(loaded.images).toEqual(capture().images);
  });

  it("works without images or drifts", async () => {
    await saveCaptures(db, route, [capture({ images: undefined, drifts: [] })]);
    const [loaded] = await getLatestCaptures(db, route);
    expect(loaded.images).toBeUndefined();
    expect(loaded.drifts).toEqual([]);
  });

  it("reuses the project and route, and returns only the newest capture per breakpoint and theme", async () => {
    await saveCaptures(db, route, [capture({ commitSha: "old" }), capture({ theme: "dark", commitSha: "old" })]);
    await saveCaptures(db, { ...route, figmaNodeId: "9:9" }, [capture({ commitSha: "new" })]);

    expect(await db.select().from(schema.projects)).toHaveLength(1);
    const routes = await db.select().from(schema.routes);
    expect(routes).toHaveLength(1);
    expect(routes[0].figmaNodeId).toBe("9:9");

    const latest = await getLatestCaptures(db, route);
    expect(latest.map((c) => `${c.breakpoint}-${c.theme}:${c.commitSha}`)).toEqual(["375-dark:old", "375-light:new"]);
  });

  it("returns nothing for an unknown route", async () => {
    expect(await getLatestCaptures(db, { projectName: "Drift Detector", path: "/nope" })).toEqual([]);
  });

  it("rolls the whole run back if one capture fails to save", async () => {
    const bad = capture({ drifts: [capture().drifts[0], capture().drifts[0]] }); // duplicate drift key
    await expect(saveCaptures(db, route, [capture(), bad])).rejects.toThrow();
    expect(await db.select().from(schema.captures)).toHaveLength(0);
    expect(await db.select().from(schema.routes)).toHaveLength(0);
  });

  it("deletes captures, drifts and images with their route", async () => {
    await saveCaptures(db, route, [capture()]);
    await db.delete(schema.routes).where(eq(schema.routes.path, "/pricing"));
    expect(await db.select().from(schema.captures)).toHaveLength(0);
    expect(await db.select().from(schema.drifts)).toHaveLength(0);
    expect(await db.select().from(schema.captureImages)).toHaveLength(0);
  });
});
