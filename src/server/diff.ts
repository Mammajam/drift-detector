import "server-only";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import type { Drift } from "@/lib/types";

export type DiffRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Changed pixels inside the region. */
  pixels: number;
  /** Mean colour of the region in the design and in the build, as hex. */
  expectedColor: string;
  actualColor: string;
};

export type DiffResult = {
  width: number;
  height: number;
  /** Share of pixels that differ, 0–1. */
  mismatchRatio: number;
  /** 0 = identical, 100 = 10% or more of the pixels differ. */
  score: number;
  regions: DiffRegion[];
};

export type DiffOptions = {
  /** pixelmatch colour-distance threshold, 0–1. */
  threshold?: number;
  /** Side of the grid cell used to cluster changed pixels, in px. */
  cell?: number;
  /** Changed cells within this many cells of each other join one region. */
  mergeCells?: number;
  /** Regions with fewer changed pixels are treated as noise. */
  minPixels?: number;
  maxRegions?: number;
};

const DEFAULTS: Required<DiffOptions> = {
  threshold: 0.1,
  cell: 8,
  mergeCells: 2,
  minPixels: 4,
  maxRegions: 20,
};

const INT32_MAX = 0x7fffffff;

// Area missing from a shorter/narrower build is filled with this, so it always reads as drift.
const MISSING: [number, number, number] = [255, 0, 255];

/** Crops or pads an image to width × height, anchored top-left. */
function fit(src: PNG, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = MISSING[0];
    out[i + 1] = MISSING[1];
    out[i + 2] = MISSING[2];
    out[i + 3] = 255;
  }
  const rowBytes = Math.min(width, src.width) * 4;
  for (let y = 0; y < Math.min(height, src.height); y++) {
    out.set(src.data.subarray(y * src.width * 4, y * src.width * 4 + rowBytes), y * width * 4);
  }
  return out;
}

function meanColor(data: Uint8Array, width: number, r: Pick<DiffRegion, "x" | "y" | "w" | "h">) {
  let red = 0;
  let green = 0;
  let blue = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * width + x) * 4;
      red += data[i];
      green += data[i + 1];
      blue += data[i + 2];
    }
  }
  const n = r.w * r.h;
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}

/**
 * Pixel-diffs a build screenshot against a design frame (both PNG), then clusters the changed
 * pixels into bounding boxes. The design's size is the reference; the build is cropped or padded to it.
 */
export function diffImages(designPng: Buffer, buildPng: Buffer, options: DiffOptions = {}): DiffResult {
  const { threshold, cell, mergeCells, minPixels, maxRegions } = { ...DEFAULTS, ...options };
  const design = PNG.sync.read(designPng);
  const { width, height } = design;
  const designData = fit(design, width, height);
  const buildData = fit(PNG.sync.read(buildPng), width, height);

  const mask = new Uint8Array(width * height * 4);
  const changed = pixelmatch(designData, buildData, mask, width, height, {
    threshold,
    includeAA: false,
    diffMask: true,
  });

  // Bucket changed pixels into grid cells, tracking the tight pixel bounds inside each cell.
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const count = new Int32Array(cols * rows);
  const minX = new Int32Array(cols * rows).fill(INT32_MAX);
  const minY = new Int32Array(cols * rows).fill(INT32_MAX);
  const maxX = new Int32Array(cols * rows).fill(-1);
  const maxY = new Int32Array(cols * rows).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[(y * width + x) * 4 + 3] === 0) continue;
      const c = Math.floor(y / cell) * cols + Math.floor(x / cell);
      count[c]++;
      if (x < minX[c]) minX[c] = x;
      if (y < minY[c]) minY[c] = y;
      if (x > maxX[c]) maxX[c] = x;
      if (y > maxY[c]) maxY[c] = y;
    }
  }

  // Flood-fill changed cells; cells within `mergeCells` of each other belong to the same region.
  const seen = new Uint8Array(cols * rows);
  const found: Omit<DiffRegion, "expectedColor" | "actualColor">[] = [];
  for (let start = 0; start < count.length; start++) {
    if (count[start] === 0 || seen[start]) continue;
    seen[start] = 1;
    const stack = [start];
    let pixels = 0;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    while (stack.length) {
      const c = stack.pop()!;
      pixels += count[c];
      x0 = Math.min(x0, minX[c]);
      y0 = Math.min(y0, minY[c]);
      x1 = Math.max(x1, maxX[c]);
      y1 = Math.max(y1, maxY[c]);
      const cx = c % cols;
      const cy = Math.floor(c / cols);
      for (let dy = -mergeCells; dy <= mergeCells; dy++) {
        for (let dx = -mergeCells; dx <= mergeCells; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const n = ny * cols + nx;
          if (count[n] === 0 || seen[n]) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (pixels >= minPixels) found.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, pixels });
  }

  const regions = found
    .sort((a, b) => b.pixels - a.pixels)
    .slice(0, maxRegions)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((r) => ({
      ...r,
      expectedColor: meanColor(designData, width, r),
      actualColor: meanColor(buildData, width, r),
    }));

  const mismatchRatio = changed / (width * height);
  return {
    width,
    height,
    mismatchRatio,
    score: Math.min(100, Math.round(mismatchRatio * 1000)),
    regions,
  };
}

/** Pixel regions become drift pins; expected/actual are the region's mean colours until style matching lands. */
export function regionsToDrifts(result: DiffResult): Drift[] {
  return result.regions.map((r, i) => ({
    id: `d${i + 1}`,
    label: `Mismatch ${i + 1} · ${r.w}×${r.h} at ${r.x},${r.y}`,
    expected: r.expectedColor,
    actual: r.actualColor,
    bbox: {
      x: r.x / result.width,
      y: r.y / result.height,
      w: r.w / result.width,
      h: r.h / result.height,
    },
    status: "open" as const,
  }));
}
