import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

const FIGMA_API = process.env.FIGMA_API_BASE ?? "https://api.figma.com";

export class FigmaError extends Error {}

export type FigmaExporter = (fileKey: string, nodeId: string, options?: { scale?: number }) => Promise<Buffer>;

/** `FIGMA_FRAME_CACHE_DIR` turns on a disk cache of exported frames, so Figma's (strict) rate limits are only hit for new frames. */
function cachePath(fileKey: string, id: string, scale: number): string | null {
  const dir = process.env.FIGMA_FRAME_CACHE_DIR;
  if (!dir) return null;
  return path.resolve(dir, `${fileKey}_${id.replace(":", "-")}@${scale}x.png`);
}

function rateLimitMessage(retryAfter: string | null): string {
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds <= 0) return "Figma rate limit reached; try again later.";
  const hours = seconds / 3600;
  const wait = hours >= 48 ? `${(hours / 24).toFixed(1)} days` : hours >= 1 ? `${hours.toFixed(1)} hours` : `${Math.ceil(seconds / 60)} minutes`;
  return `Figma rate limit reached; try again in about ${wait}. Frames already in FIGMA_FRAME_CACHE_DIR still work.`;
}

/**
 * Exports one frame as a PNG through the Figma REST images API. Server-only: reads FIGMA_TOKEN.
 * With FIGMA_FRAME_CACHE_DIR set, a frame that was exported before is read from disk instead of Figma.
 * Delete the cached file to pick up a design change.
 */
export const exportFrame: FigmaExporter = async (fileKey, nodeId, { scale = 1 } = {}) => {
  const id = nodeId.replace("-", ":");
  const cached = cachePath(fileKey, id, scale);
  if (cached) {
    try {
      return await fs.readFile(cached);
    } catch {
      /* not cached yet */
    }
  }

  const token = process.env.FIGMA_TOKEN;
  if (!token) throw new FigmaError("FIGMA_TOKEN is not set.");

  const query = new URLSearchParams({ ids: id, format: "png", scale: String(scale) });
  const meta = await fetch(`${FIGMA_API}/v1/images/${encodeURIComponent(fileKey)}?${query}`, {
    headers: { "X-Figma-Token": token },
    cache: "no-store",
  });
  if (meta.status === 429) throw new FigmaError(rateLimitMessage(meta.headers.get("retry-after")));
  if (!meta.ok) throw new FigmaError(`Figma images API responded ${meta.status}.`);

  const body = (await meta.json()) as { err?: string | null; images?: Record<string, string | null> };
  const imageUrl = body.images?.[id];
  if (body.err || !imageUrl) throw new FigmaError(body.err ?? `Figma returned no image for node ${id}.`);

  const image = await fetch(imageUrl, { cache: "no-store" });
  if (!image.ok) throw new FigmaError(`Figma image download responded ${image.status}.`);
  const png = Buffer.from(await image.arrayBuffer());

  if (cached) {
    await fs.mkdir(path.dirname(cached), { recursive: true });
    await fs.writeFile(cached, png);
  }
  return png;
};
