import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { BBox } from "@/lib/types";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const captureTheme = pgEnum("capture_theme", ["light", "dark"]);
export const driftStatus = pgEnum("drift_status", ["open", "fixed", "wont_fix"]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

export const routes = pgTable(
  "routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    figmaFileKey: text("figma_file_key").notNull(),
    figmaNodeId: text("figma_node_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("routes_project_path_unique").on(t.projectId, t.path)],
);

export const captures = pgTable(
  "captures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    commitSha: text("commit_sha").notNull().default(""),
    pullRequestUrl: text("pull_request_url"),
    theme: captureTheme("theme").notNull(),
    breakpoint: integer("breakpoint").notNull(),
    frameWidth: integer("frame_width").notNull(),
    frameHeight: integer("frame_height").notNull(),
    /** 0 = identical, 100 = 10% or more of the pixels differ. */
    score: real("score").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("captures_route_created_idx").on(t.routeId, t.createdAt)],
);

/** PNG bytes live apart from capture rows so listing captures never drags megabytes along. */
export const captureImages = pgTable("capture_images", {
  captureId: uuid("capture_id")
    .primaryKey()
    .references(() => captures.id, { onDelete: "cascade" }),
  designPng: bytea("design_png").notNull(),
  buildPng: bytea("build_png").notNull(),
});

export const drifts = pgTable(
  "drifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    captureId: uuid("capture_id")
      .notNull()
      .references(() => captures.id, { onDelete: "cascade" }),
    /** Stable id within the capture ("d1", "d2", …), matching the pin number. */
    key: text("key").notNull(),
    label: text("label").notNull(),
    expected: text("expected").notNull(),
    actual: text("actual").notNull(),
    token: text("token"),
    bbox: jsonb("bbox").$type<BBox>().notNull(),
    status: driftStatus("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [unique("drifts_capture_key_unique").on(t.captureId, t.key)],
);

export const signoffs = pgTable("signoffs", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  captureId: uuid("capture_id")
    .notNull()
    .references(() => captures.id, { onDelete: "cascade" }),
  approvedBy: text("approved_by").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
