import "server-only";

const FIGMA_API = process.env.FIGMA_API_BASE ?? "https://api.figma.com";

export class FigmaError extends Error {}

export type FigmaExporter = (fileKey: string, nodeId: string, options?: { scale?: number }) => Promise<Buffer>;

/** Exports one frame as a PNG through the Figma REST images API. Server-only: reads FIGMA_TOKEN. */
export const exportFrame: FigmaExporter = async (fileKey, nodeId, { scale = 1 } = {}) => {
  const token = process.env.FIGMA_TOKEN;
  if (!token) throw new FigmaError("FIGMA_TOKEN is not set.");

  const id = nodeId.replace("-", ":");
  const query = new URLSearchParams({ ids: id, format: "png", scale: String(scale) });
  const meta = await fetch(`${FIGMA_API}/v1/images/${encodeURIComponent(fileKey)}?${query}`, {
    headers: { "X-Figma-Token": token },
    cache: "no-store",
  });
  if (!meta.ok) throw new FigmaError(`Figma images API responded ${meta.status}.`);

  const body = (await meta.json()) as { err?: string | null; images?: Record<string, string | null> };
  const imageUrl = body.images?.[id];
  if (body.err || !imageUrl) throw new FigmaError(body.err ?? `Figma returned no image for node ${id}.`);

  const image = await fetch(imageUrl, { cache: "no-store" });
  if (!image.ok) throw new FigmaError(`Figma image download responded ${image.status}.`);
  return Buffer.from(await image.arrayBuffer());
};
