import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Breakpoint, Capture, CaptureTheme, Drift, DriftStatus } from "@/lib/types";
import * as schema from "./schema";

/** Any Drizzle Postgres database: postgres-js in the app, PGlite in tests. */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type RouteRef = { projectName: string; path: string };
export type RouteInput = RouteRef & { figmaFileKey: string; figmaNodeId: string };

type DbStatus = "open" | "fixed" | "wont_fix";
const toDbStatus = (s: DriftStatus): DbStatus => (s === "wont-fix" ? "wont_fix" : s);
const fromDbStatus = (s: DbStatus): DriftStatus => (s === "wont_fix" ? "wont-fix" : s);

const PNG_PREFIX = "data:image/png;base64,";
const toBuffer = (dataUrl: string) => Buffer.from(dataUrl.slice(PNG_PREFIX.length), "base64");
const toDataUrl = (png: Buffer) => `${PNG_PREFIX}${Buffer.from(png).toString("base64")}`;

/** Stores a pipeline run (every breakpoint × theme) in one transaction; returns the captures with their ids. */
export async function saveCaptures(db: AnyDb, route: RouteInput, captures: Capture[]): Promise<Capture[]> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(schema.projects)
      .values({ name: route.projectName })
      // A no-op update so RETURNING yields the existing row too.
      .onConflictDoUpdate({ target: schema.projects.name, set: { name: route.projectName } })
      .returning();

    const [routeRow] = await tx
      .insert(schema.routes)
      .values({
        projectId: project.id,
        path: route.path,
        figmaFileKey: route.figmaFileKey,
        figmaNodeId: route.figmaNodeId,
      })
      .onConflictDoUpdate({
        target: [schema.routes.projectId, schema.routes.path],
        set: { figmaFileKey: route.figmaFileKey, figmaNodeId: route.figmaNodeId },
      })
      .returning();

    const saved: Capture[] = [];
    for (const capture of captures) {
      const [row] = await tx
        .insert(schema.captures)
        .values({
          routeId: routeRow.id,
          url: capture.previewUrl,
          commitSha: capture.commitSha,
          pullRequestUrl: capture.pullRequestUrl ?? null,
          theme: capture.theme,
          breakpoint: capture.breakpoint,
          frameWidth: capture.frame.width,
          frameHeight: capture.frame.height,
          score: capture.score ?? 0,
        })
        .returning();

      if (capture.images) {
        await tx.insert(schema.captureImages).values({
          captureId: row.id,
          designPng: toBuffer(capture.images.design),
          buildPng: toBuffer(capture.images.build),
        });
      }
      if (capture.drifts.length > 0) {
        await tx.insert(schema.drifts).values(
          capture.drifts.map((d) => ({
            captureId: row.id,
            key: d.id,
            label: d.label,
            expected: d.expected,
            actual: d.actual,
            token: d.token ?? null,
            bbox: d.bbox,
            status: toDbStatus(d.status),
          })),
        );
      }
      saved.push({ ...capture, id: row.id });
    }
    return saved;
  });
}

/** The latest capture for each breakpoint × theme of a route, with drifts and images; [] if the route is unknown. */
export async function getLatestCaptures(db: AnyDb, ref: RouteRef, previewUrl?: string): Promise<Capture[]> {
  const [route] = await db
    .select({ id: schema.routes.id })
    .from(schema.routes)
    .innerJoin(schema.projects, eq(schema.routes.projectId, schema.projects.id))
    .where(and(eq(schema.projects.name, ref.projectName), eq(schema.routes.path, ref.path)));
  if (!route) return [];

  const rows = await db
    .select()
    .from(schema.captures)
    .where(
      previewUrl
        ? and(eq(schema.captures.routeId, route.id), eq(schema.captures.url, previewUrl))
        : eq(schema.captures.routeId, route.id),
    )
    .orderBy(desc(schema.captures.createdAt), desc(schema.captures.id));

  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.breakpoint}-${row.theme}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  const chosen = [...latest.values()].sort((a, b) => a.breakpoint - b.breakpoint || a.theme.localeCompare(b.theme));
  if (chosen.length === 0) return [];

  const ids = chosen.map((r) => r.id);
  const [driftRows, imageRows] = await Promise.all([
    db.select().from(schema.drifts).where(inArray(schema.drifts.captureId, ids)),
    db.select().from(schema.captureImages).where(inArray(schema.captureImages.captureId, ids)),
  ]);

  return chosen.map((row) => {
    const images = imageRows.find((i) => i.captureId === row.id);
    const captureDrifts: Drift[] = driftRows
      .filter((d) => d.captureId === row.id)
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
      .map((d) => ({
        id: d.key,
        ticketId: d.id,
        label: d.label,
        expected: d.expected,
        actual: d.actual,
        ...(d.token ? { token: d.token } : {}),
        bbox: d.bbox,
        status: fromDbStatus(d.status),
      }));
    return {
      id: row.id,
      route: ref.path,
      previewUrl: row.url,
      commitSha: row.commitSha,
      ...(row.pullRequestUrl ? { pullRequestUrl: row.pullRequestUrl } : {}),
      breakpoint: row.breakpoint as Breakpoint,
      theme: row.theme as CaptureTheme,
      frame: { width: row.frameWidth, height: row.frameHeight },
      score: row.score,
      drifts: captureDrifts,
      ...(images ? { images: { design: toDataUrl(images.designPng), build: toDataUrl(images.buildPng) } } : {}),
    };
  });
}
