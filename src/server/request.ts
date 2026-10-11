import "server-only";
import type { Breakpoint, CaptureTheme } from "@/lib/types";
import { parsePreviewUrl, type PreviewUrlOptions } from "./url";

export class BadRequest extends Error {}

export const ALL_BREAKPOINTS: Breakpoint[] = [375, 768, 1440];
export const ALL_THEMES: CaptureTheme[] = ["light", "dark"];

export type FigmaNodeKey = `${Breakpoint}-${CaptureTheme}`;

export type CaptureRequest = {
  /** Full URL of the page to capture (preview origin + route). */
  targetUrl: string;
  route: string;
  figmaFileKey: string;
  figmaNodeId: string;
  /** Optional per breakpoint/theme frames, e.g. "375-dark"; falls back to figmaNodeId. */
  figmaNodes: Partial<Record<FigmaNodeKey, string>>;
  breakpoints: Breakpoint[];
  themes: CaptureTheme[];
};

const FILE_KEY = /^[A-Za-z0-9]{1,64}$/;
const NODE_ID = /^\d+[:-]\d+$/;

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) throw new BadRequest(`${field} is required.`);
  return value;
}

function subset<T>(value: unknown, allowed: T[], field: string): T[] {
  if (value === undefined) return allowed;
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => allowed.includes(v as T))) {
    throw new BadRequest(`${field} must be a non-empty list of ${allowed.join(", ")}.`);
  }
  return [...new Set(value as T[])];
}

/** Validates untrusted input for POST /api/captures (and the inspector's live source). */
export function parseCaptureRequest(input: unknown, urlOptions: PreviewUrlOptions): CaptureRequest {
  if (typeof input !== "object" || input === null) throw new BadRequest("Body must be a JSON object.");
  const body = input as Record<string, unknown>;

  const route = str(body.route, "route");
  // "//host" would make URL resolution leave the preview origin.
  if (!route.startsWith("/") || route.startsWith("//") || /[\\\s]/.test(route) || route.length > 200) {
    throw new BadRequest("route must be a path such as /pricing.");
  }

  let targetUrl: string;
  try {
    const base = parsePreviewUrl(str(body.previewUrl, "previewUrl"), urlOptions);
    targetUrl = parsePreviewUrl(new URL(route, base.origin).href, urlOptions).href;
  } catch (error) {
    throw new BadRequest(error instanceof Error ? error.message : "Invalid preview URL.");
  }

  const figmaFileKey = str(body.figmaFileKey, "figmaFileKey");
  if (!FILE_KEY.test(figmaFileKey)) throw new BadRequest("figmaFileKey is not a valid Figma file key.");
  const figmaNodeId = str(body.figmaNodeId, "figmaNodeId");
  if (!NODE_ID.test(figmaNodeId)) throw new BadRequest("figmaNodeId must look like 12:34.");

  const figmaNodes: CaptureRequest["figmaNodes"] = {};
  if (body.figmaNodes !== undefined) {
    if (typeof body.figmaNodes !== "object" || body.figmaNodes === null) {
      throw new BadRequest("figmaNodes must be an object.");
    }
    for (const [key, id] of Object.entries(body.figmaNodes)) {
      const [bp, theme] = key.split("-");
      if (!ALL_BREAKPOINTS.includes(Number(bp) as Breakpoint) || !ALL_THEMES.includes(theme as CaptureTheme)) {
        throw new BadRequest(`figmaNodes key "${key}" must look like 375-light.`);
      }
      if (typeof id !== "string" || !NODE_ID.test(id)) throw new BadRequest(`figmaNodes["${key}"] is not a node id.`);
      figmaNodes[key as FigmaNodeKey] = id;
    }
  }

  return {
    targetUrl,
    route,
    figmaFileKey,
    figmaNodeId,
    figmaNodes,
    breakpoints: subset(body.breakpoints, ALL_BREAKPOINTS, "breakpoints"),
    themes: subset(body.themes, ALL_THEMES, "themes"),
  };
}
