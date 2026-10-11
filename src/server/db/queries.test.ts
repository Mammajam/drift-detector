import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "./captures-repo";
import { getBoard, getReport, getTicket, isUuid, seedDemo, setDriftStatus, signOffBuild, SignOffBlocked } from "./queries";
import * as schema from "./schema";

const PROJECT = "Drift Detector";
let db: AnyDb;

beforeEach(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  db = pg as unknown as AnyDb;
  await seedDemo(db, PROJECT);
});

const routeByPath = async (path: string) => (await getBoard(db, PROJECT)).find((r) => r.path === path)!;

describe("seedDemo", () => {
  it("is idempotent", async () => {
    expect(await seedDemo(db, PROJECT)).toBe(false);
    expect((await getBoard(db, PROJECT)).map((r) => r.path)).toEqual(["/checkout", "/onboarding", "/pricing"]);
  });
});

describe("getBoard", () => {
  it("summarises builds per route, newest first, with counts and sign-offs", async () => {
    const pricing = await routeByPath("/pricing");
    expect(pricing.builds.map((b) => b.commitSha)).toEqual(["a1b2c3d", "3f9e2a1"]);

    const [newest, older] = pricing.builds;
    expect(newest).toMatchObject({ captureCount: 3, openDrifts: 3 + 4 + 1, fixedDrifts: 0 });
    expect(newest.pullRequestUrl).toBe("https://github.com/Mammajam/drift-detector/pull/42");
    expect(older).toMatchObject({ captureCount: 1, openDrifts: 2, fixedDrifts: 2 });
    expect(newest.score).toBeGreaterThan(0);

    const onboarding = await routeByPath("/onboarding");
    expect(onboarding.builds[0]).toMatchObject({ openDrifts: 0, score: 0, signedOffBy: "Mamadou Kromah" });
  });
});

describe("tickets", () => {
  it("loads a drift with its capture, route and pin number", async () => {
    const report = (await getReport(db, PROJECT, (await routeByPath("/pricing")).id))!;
    const ticket = (await getTicket(db, report.drifts[0].ticketId))!;
    expect(ticket.route.path).toBe("/pricing");
    expect(ticket.number).toBe(1);
    expect(ticket.capture.previewUrl).toContain("pr-42");
    expect(ticket.drift.expected).toBeTruthy();
  });

  it("returns null for unknown or malformed ids", async () => {
    expect(await getTicket(db, "not-a-uuid")).toBeNull();
    expect(await getTicket(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(isUuid("00000000-0000-4000-8000-000000000000")).toBe(true);
  });

  it("changes status and reflects it on the board", async () => {
    const pricing = await routeByPath("/pricing");
    const report = (await getReport(db, PROJECT, pricing.id))!;
    expect(await setDriftStatus(db, report.drifts[0].ticketId, "fixed")).toBe(true);
    expect(await setDriftStatus(db, report.drifts[1].ticketId, "wont-fix")).toBe(true);
    expect(await setDriftStatus(db, "nope", "fixed")).toBe(false);

    const after = (await routeByPath("/pricing")).builds[0];
    expect(after).toMatchObject({ openDrifts: pricing.builds[0].openDrifts - 2, fixedDrifts: 1, wontFixDrifts: 1 });
  });
});

describe("sign-off", () => {
  it("is refused while drifts are open", async () => {
    const pricing = await routeByPath("/pricing");
    await expect(signOffBuild(db, pricing.id, pricing.builds[0].previewUrl, "Ada")).rejects.toThrow(SignOffBlocked);
    expect((await getReport(db, PROJECT, pricing.id))!.signoffs).toEqual([]);
  });

  it("records one sign-off for the build once every drift is resolved", async () => {
    const pricing = await routeByPath("/pricing");
    const report = (await getReport(db, PROJECT, pricing.id))!;
    for (const d of report.drifts) await setDriftStatus(db, d.ticketId, "fixed");

    expect(await signOffBuild(db, pricing.id, pricing.builds[0].previewUrl, "Ada")).toBe(3);
    const after = (await getReport(db, PROJECT, pricing.id))!;
    expect(after.signoffs).toHaveLength(1);
    expect(after.signoffs[0].approvedBy).toBe("Ada");
    expect(after.latest?.signedOffBy).toBe("Ada");
  });

  it("rejects an unknown build", async () => {
    const pricing = await routeByPath("/pricing");
    await expect(signOffBuild(db, pricing.id, "https://nope.deployxa.online/", "Ada")).rejects.toThrow(SignOffBlocked);
  });
});
