import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { BoardRoute, BuildSummary, Capture, Drift, DriftStatus } from "@/lib/types";
import { DEMO_ROUTES } from "@/lib/sample/demo";
import type { AnyDb } from "./captures-repo";
import { saveCaptures } from "./captures-repo";
import * as schema from "./schema";

type DbStatus = "open" | "fixed" | "wont_fix";
const fromDbStatus = (s: DbStatus): DriftStatus => (s === "wont_fix" ? "wont-fix" : s);
const toDbStatus = (s: DriftStatus): DbStatus => (s === "wont-fix" ? "wont_fix" : s);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

export class SignOffBlocked extends Error {}

/** Routes of a project with one summary per preview build, newest first. */
export async function getBoard(db: AnyDb, projectName: string): Promise<BoardRoute[]> {
  const routes = await db
    .select({ id: schema.routes.id, path: schema.routes.path })
    .from(schema.routes)
    .innerJoin(schema.projects, eq(schema.routes.projectId, schema.projects.id))
    .where(eq(schema.projects.name, projectName))
    .orderBy(schema.routes.path);
  if (routes.length === 0) return [];

  const routeIds = routes.map((r) => r.id);
  const captures = await db
    .select({
      id: schema.captures.id,
      routeId: schema.captures.routeId,
      url: schema.captures.url,
      commitSha: schema.captures.commitSha,
      pullRequestUrl: schema.captures.pullRequestUrl,
      score: schema.captures.score,
      createdAt: schema.captures.createdAt,
    })
    .from(schema.captures)
    .where(inArray(schema.captures.routeId, routeIds));
  const captureIds = captures.map((c) => c.id);

  const [driftRows, signoffRows] = await Promise.all([
    captureIds.length
      ? db
          .select({ captureId: schema.drifts.captureId, status: schema.drifts.status })
          .from(schema.drifts)
          .where(inArray(schema.drifts.captureId, captureIds))
      : [],
    db
      .select({ captureId: schema.signoffs.captureId, approvedBy: schema.signoffs.approvedBy, at: schema.signoffs.at })
      .from(schema.signoffs)
      .where(inArray(schema.signoffs.routeId, routeIds)),
  ]);

  return routes.map((route) => {
    const byBuild = new Map<string, typeof captures>();
    for (const c of captures.filter((c) => c.routeId === route.id)) {
      byBuild.set(c.url, [...(byBuild.get(c.url) ?? []), c]);
    }
    const builds: BuildSummary[] = [...byBuild.entries()].map(([previewUrl, group]) => {
      const ids = new Set(group.map((c) => c.id));
      const drifts = driftRows.filter((d) => ids.has(d.captureId));
      const signoff = signoffRows
        .filter((s) => ids.has(s.captureId))
        .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
      const pr = group.find((c) => c.pullRequestUrl)?.pullRequestUrl;
      return {
        previewUrl,
        commitSha: group.find((c) => c.commitSha)?.commitSha ?? "",
        ...(pr ? { pullRequestUrl: pr } : {}),
        createdAt: new Date(Math.max(...group.map((c) => c.createdAt.getTime()))).toISOString(),
        captureCount: group.length,
        openDrifts: drifts.filter((d) => d.status === "open").length,
        fixedDrifts: drifts.filter((d) => d.status === "fixed").length,
        wontFixDrifts: drifts.filter((d) => d.status === "wont_fix").length,
        score: Math.max(...group.map((c) => c.score)),
        ...(signoff ? { signedOffBy: signoff.approvedBy } : {}),
      };
    });
    builds.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { id: route.id, path: route.path, builds };
  });
}

export type Ticket = {
  drift: Drift & { ticketId: string };
  /** 1-based pin number within the capture. */
  number: number;
  capture: Capture;
  route: { id: string; path: string };
};

export async function getTicket(db: AnyDb, id: string): Promise<Ticket | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({ drift: schema.drifts, capture: schema.captures, route: schema.routes })
    .from(schema.drifts)
    .innerJoin(schema.captures, eq(schema.drifts.captureId, schema.captures.id))
    .innerJoin(schema.routes, eq(schema.captures.routeId, schema.routes.id))
    .where(eq(schema.drifts.id, id));
  if (!row) return null;

  const [siblings, [images]] = await Promise.all([
    db.select({ id: schema.drifts.id, key: schema.drifts.key }).from(schema.drifts).where(eq(schema.drifts.captureId, row.capture.id)),
    db.select().from(schema.captureImages).where(eq(schema.captureImages.captureId, row.capture.id)),
  ]);
  const order = siblings.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  const toDrift = (d: typeof row.drift): Drift & { ticketId: string } => ({
    id: d.key,
    ticketId: d.id,
    label: d.label,
    expected: d.expected,
    actual: d.actual,
    ...(d.token ? { token: d.token } : {}),
    bbox: d.bbox,
    status: fromDbStatus(d.status),
  });
  const png = (b: Buffer) => `data:image/png;base64,${Buffer.from(b).toString("base64")}`;

  return {
    drift: toDrift(row.drift),
    number: order.findIndex((s) => s.id === id) + 1,
    route: { id: row.route.id, path: row.route.path },
    capture: {
      id: row.capture.id,
      route: row.route.path,
      previewUrl: row.capture.url,
      commitSha: row.capture.commitSha,
      ...(row.capture.pullRequestUrl ? { pullRequestUrl: row.capture.pullRequestUrl } : {}),
      breakpoint: row.capture.breakpoint as Capture["breakpoint"],
      theme: row.capture.theme,
      frame: { width: row.capture.frameWidth, height: row.capture.frameHeight },
      score: row.capture.score,
      drifts: [],
      ...(images ? { images: { design: png(images.designPng), build: png(images.buildPng) } } : {}),
    },
  };
}

export async function setDriftStatus(db: AnyDb, id: string, status: DriftStatus): Promise<boolean> {
  if (!isUuid(id)) return false;
  const updated = await db
    .update(schema.drifts)
    .set({ status: toDbStatus(status) })
    .where(eq(schema.drifts.id, id))
    .returning({ id: schema.drifts.id });
  return updated.length > 0;
}

export type ReportDrift = {
  ticketId: string;
  key: string;
  label: string;
  expected: string;
  actual: string;
  status: DriftStatus;
  breakpoint: number;
  theme: "light" | "dark";
};

export type Report = {
  route: { id: string; path: string };
  /** The newest build, which the sign-off applies to. */
  latest: BuildSummary | null;
  drifts: ReportDrift[];
  signoffs: { approvedBy: string; at: string; previewUrl: string; pullRequestUrl?: string }[];
};

export async function getReport(db: AnyDb, projectName: string, routeId: string): Promise<Report | null> {
  if (!isUuid(routeId)) return null;
  const board = await getBoard(db, projectName);
  const route = board.find((r) => r.id === routeId);
  if (!route) return null;
  const latest = route.builds[0] ?? null;

  const drifts: ReportDrift[] = latest
    ? (
        await db
          .select({ drift: schema.drifts, breakpoint: schema.captures.breakpoint, theme: schema.captures.theme })
          .from(schema.drifts)
          .innerJoin(schema.captures, eq(schema.drifts.captureId, schema.captures.id))
          .where(and(eq(schema.captures.routeId, routeId), eq(schema.captures.url, latest.previewUrl)))
      )
        .map(({ drift, breakpoint, theme }) => ({
          ticketId: drift.id,
          key: drift.key,
          label: drift.label,
          expected: drift.expected,
          actual: drift.actual,
          status: fromDbStatus(drift.status),
          breakpoint,
          theme,
        }))
        .sort((a, b) => a.breakpoint - b.breakpoint || a.theme.localeCompare(b.theme) || a.key.localeCompare(b.key, undefined, { numeric: true }))
    : [];

  const signoffRows = await db
    .select({
      approvedBy: schema.signoffs.approvedBy,
      at: schema.signoffs.at,
      url: schema.captures.url,
      pullRequestUrl: schema.captures.pullRequestUrl,
    })
    .from(schema.signoffs)
    .innerJoin(schema.captures, eq(schema.signoffs.captureId, schema.captures.id))
    .where(eq(schema.signoffs.routeId, routeId))
    .orderBy(desc(schema.signoffs.at));
  // One sign-off covers every capture of a build; collapse the per-capture rows.
  const seen = new Set<string>();
  const signoffs = signoffRows
    .filter((s) => {
      const key = `${s.url}|${s.approvedBy}|${s.at.toISOString()}`;
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .map((s) => ({
      approvedBy: s.approvedBy,
      at: s.at.toISOString(),
      previewUrl: s.url,
      ...(s.pullRequestUrl ? { pullRequestUrl: s.pullRequestUrl } : {}),
    }));

  return { route: { id: route.id, path: route.path }, latest, drifts, signoffs };
}

/** Records a sign-off for every capture of a build. Refused while any drift is still open. */
export async function signOffBuild(
  db: AnyDb,
  routeId: string,
  previewUrl: string,
  approvedBy: string,
  approvedByUserId?: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const captures = await tx
      .select({ id: schema.captures.id })
      .from(schema.captures)
      .where(and(eq(schema.captures.routeId, routeId), eq(schema.captures.url, previewUrl)));
    if (captures.length === 0) throw new SignOffBlocked("That build does not exist.");

    const open = await tx
      .select({ id: schema.drifts.id })
      .from(schema.drifts)
      .where(and(inArray(schema.drifts.captureId, captures.map((c) => c.id)), eq(schema.drifts.status, "open")));
    if (open.length > 0) throw new SignOffBlocked(`${open.length} drift(s) are still open.`);

    const at = new Date();
    await tx
      .insert(schema.signoffs)
      .values(captures.map((c) => ({ routeId, captureId: c.id, approvedBy, approvedByUserId: approvedByUserId ?? null, at })));
    return captures.length;
  });
}

/** Loads the demo routes into an empty project. Returns false (and does nothing) if the project already has routes. */
export async function seedDemo(db: AnyDb, projectName: string): Promise<boolean> {
  if ((await getBoard(db, projectName)).length > 0) return false;

  for (const route of DEMO_ROUTES) {
    for (const demoBuild of route.builds) {
      const saved = await saveCaptures(
        db,
        { projectName, path: route.path, figmaFileKey: route.figmaFileKey, figmaNodeId: route.figmaNodeId },
        demoBuild.captures,
      );
      const ids = saved.map((c) => c.id!);
      if (demoBuild.fixedKeys?.length) {
        await db
          .update(schema.drifts)
          .set({ status: "fixed" })
          .where(and(inArray(schema.drifts.captureId, ids), inArray(schema.drifts.key, demoBuild.fixedKeys)));
      }
      if (demoBuild.signedOffBy) {
        const [routeRow] = await db
          .select({ id: schema.routes.id })
          .from(schema.routes)
          .innerJoin(schema.projects, eq(schema.routes.projectId, schema.projects.id))
          .where(and(eq(schema.projects.name, projectName), eq(schema.routes.path, route.path)));
        await db
          .insert(schema.signoffs)
          .values(ids.map((captureId) => ({ routeId: routeRow.id, captureId, approvedBy: demoBuild.signedOffBy! })));
      }
    }
  }
  return true;
}

export type UserRow = { id: string; email: string; name: string; passwordHash: string };

export class EmailTaken extends Error {
  constructor() {
    super("An account with that email already exists.");
  }
}

/** Creates an account; the email is lowercased. Throws EmailTaken on a duplicate. */
export async function createUser(
  db: AnyDb,
  input: { email: string; name: string; passwordHash: string },
): Promise<UserRow> {
  const email = input.email.trim().toLowerCase();
  const [row] = await db
    .insert(schema.users)
    .values({ email, name: input.name, passwordHash: input.passwordHash })
    .onConflictDoNothing({ target: schema.users.email })
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      passwordHash: schema.users.passwordHash,
    });
  if (!row) throw new EmailTaken();
  return row;
}

export async function findUserByEmail(db: AnyDb, email: string): Promise<UserRow | null> {
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function findUserById(db: AnyDb, id: string): Promise<UserRow | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return row ?? null;
}
