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
  /** Where the build's content sits relative to the design (px), when the region is mostly a shifted copy. */
  shift?: { dx: number; dy: number };
  /**
   * Set when nothing moved by a clean shift and the mean colours match, so the change is in the layout or content
   * (a text reflow, say). `expected`/`actual` are the extents of the non-background pixels in the region.
   */
  layout?: { expected: { w: number; h: number }; actual: { w: number; h: number } };
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
  /**
   * Box-blur radius in px applied to both images before comparing. Browsers and Figma rasterise text a little
   * differently, so a clean page otherwise lights up with sub-pixel speckle. 0 compares exact pixels.
   */
  blur?: number;
  /** Look for a pure shift (dx, dy) that explains each region, so a moved block reads "moved 16px up" not "colour changed". */
  estimateShift?: boolean;
};

/** Settings used for real captures: tolerant of text rasterisation, still sensitive to layout shifts of a few px. */
export const CAPTURE_DIFF: DiffOptions = { blur: 2, threshold: 0.2, minPixels: 30, estimateShift: true };

const DEFAULTS: Required<DiffOptions> = {
  threshold: 0.1,
  cell: 8,
  mergeCells: 2,
  minPixels: 4,
  maxRegions: 20,
  blur: 0,
  estimateShift: false,
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

/** Separable box blur of an opaque RGBA buffer. */
function boxBlur(src: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return src;
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  const span = radius * 2 + 1;
  for (let pass = 0; pass < 2; pass++) {
    const from = pass === 0 ? src : tmp;
    const to = pass === 0 ? tmp : out;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = pass === 0 ? Math.min(width - 1, Math.max(0, x + k)) : x;
          const yy = pass === 0 ? y : Math.min(height - 1, Math.max(0, y + k));
          const i = (yy * width + xx) * 4;
          r += from[i];
          g += from[i + 1];
          b += from[i + 2];
        }
        const o = (y * width + x) * 4;
        to[o] = r / span;
        to[o + 1] = g / span;
        to[o + 2] = b / span;
        to[o + 3] = 255;
      }
    }
  }
  return out;
}

const MAX_SHIFT_Y = 48;
const MAX_SHIFT_X = 16;

/**
 * Tries every small (dx, dy) and keeps the one where the build, moved by it, best matches the design inside the box.
 * Returns null when no shift explains the region clearly (e.g. a plain colour change).
 */
function findShift(
  design: Uint8Array,
  build: Uint8Array,
  width: number,
  height: number,
  box: { x: number; y: number; w: number; h: number },
): { dx: number; dy: number } | null {
  const step = Math.max(1, Math.floor(Math.sqrt((box.w * box.h) / 4000)));
  const lum = (d: Uint8Array, i: number) => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  const cost = (dx: number, dy: number) => {
    let sum = 0;
    let n = 0;
    for (let y = box.y; y < box.y + box.h; y += step) {
      for (let x = box.x; x < box.x + box.w; x += step) {
        const bx = x + dx;
        const by = y + dy;
        if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
        sum += Math.abs(lum(design, (y * width + x) * 4) - lum(build, (by * width + bx) * 4));
        n++;
      }
    }
    return { c: n === 0 ? Infinity : sum / n, n };
  };

  const base = cost(0, 0);
  const baseline = base.c;
  let best = { dx: 0, dy: 0, c: baseline };
  for (let dy = -MAX_SHIFT_Y; dy <= MAX_SHIFT_Y; dy++) {
    for (let dx = -MAX_SHIFT_X; dx <= MAX_SHIFT_X; dx++) {
      if (dx === 0 && dy === 0) continue;
      const { c, n } = cost(dx, dy);
      // A shift that pushes most of the region off the image proves nothing.
      if (n < base.n * 0.85) continue;
      // strictly better wins; on a tie the smaller move is kept
      if (c < best.c - 0.01 || (c < best.c + 0.01 && c < baseline && Math.abs(dx) + Math.abs(dy) < Math.abs(best.dx) + Math.abs(best.dy))) {
        best = { dx, dy, c };
      }
    }
  }
  return best.c < baseline * 0.5 && (best.dx !== 0 || best.dy !== 0) ? { dx: best.dx, dy: best.dy } : null;
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

const parseHex = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Two mean colours are "the same" when no channel differs by more than a few levels. */
const COLOR_TOLERANCE = 6;
function colorsMatch(a: string, b: string): boolean {
  const [pa, pb] = [parseHex(a), parseHex(b)];
  return pa.every((v, i) => Math.abs(v - pb[i]) <= COLOR_TOLERANCE);
}

/** Size of the box around the pixels that differ from the region's dominant (background) colour, or null if none. */
function inkExtent(data: Uint8Array, width: number, r: Pick<DiffRegion, "x" | "y" | "w" | "h">): { w: number; h: number } | null {
  const buckets = new Map<number, number>();
  const key = (i: number) => ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const k = key((y * width + x) * 4);
      buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
  }
  const top = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top === undefined) return null;
  const bg = [((top >> 8) & 15) * 16 + 8, ((top >> 4) & 15) * 16 + 8, (top & 15) * 16 + 8];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * width + x) * 4;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) <= 96) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Pixel-diffs a build screenshot against a design frame (both PNG), then clusters the changed
 * pixels into bounding boxes. The design's size is the reference; the build is cropped or padded to it.
 */
export function diffImages(designPng: Buffer, buildPng: Buffer, options: DiffOptions = {}): DiffResult {
  const { threshold, cell, mergeCells, minPixels, maxRegions, blur, estimateShift } = { ...DEFAULTS, ...options };
  const design = PNG.sync.read(designPng);
  const { width, height } = design;
  const designData = fit(design, width, height);
  const buildData = fit(PNG.sync.read(buildPng), width, height);

  const mask = new Uint8Array(width * height * 4);
  const changed = pixelmatch(boxBlur(designData, width, height, blur), boxBlur(buildData, width, height, blur), mask, width, height, {
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
    .map((r) => {
      // Blurring spreads each change by `blur` px on every side; pull the box back in so pins and colours stay tight.
      const inset = Math.max(0, Math.min(blur, Math.floor((r.w - 1) / 2), Math.floor((r.h - 1) / 2)));
      const box = { ...r, x: r.x + inset, y: r.y + inset, w: r.w - inset * 2, h: r.h - inset * 2 };
      // Match on the region plus a margin: edges around it make the shift unambiguous (a flat strip fits many shifts).
      const margin = 24;
      const around = {
        x: Math.max(0, box.x - margin),
        y: Math.max(0, box.y - margin),
        w: Math.min(width, box.x + box.w + margin) - Math.max(0, box.x - margin),
        h: Math.min(height, box.y + box.h + margin) - Math.max(0, box.y - margin),
      };
      const shift = estimateShift ? findShift(designData, buildData, width, height, around) : null;
      const expectedColor = meanColor(designData, width, box);
      const actualColor = meanColor(buildData, width, box);
      // Same average colour and no clean shift: the content moved or reflowed. A colour spec would read "x → x".
      const [ink, inkBuild] = !shift && colorsMatch(expectedColor, actualColor)
        ? [inkExtent(designData, width, box), inkExtent(buildData, width, box)]
        : [null, null];
      return {
        ...box,
        expectedColor,
        actualColor,
        ...(shift ? { shift } : {}),
        ...(ink && inkBuild ? { layout: { expected: ink, actual: inkBuild } } : {}),
      };
    });

  const mismatchRatio = changed / (width * height);
  return {
    width,
    height,
    mismatchRatio,
    score: Math.min(100, Math.round(mismatchRatio * 1000)),
    regions,
  };
}

/** Pixel regions become drift pins. A shifted block reads as where it moved; otherwise the mean colours are the spec. */
export function regionsToDrifts(result: DiffResult): Drift[] {
  return result.regions.map((r, i) => {
    const at = `${r.w}×${r.h} at ${r.x},${r.y}`;
    const bbox = {
      x: r.x / result.width,
      y: r.y / result.height,
      w: r.w / result.width,
      h: r.h / result.height,
    };
    const base = { id: `d${i + 1}`, bbox, status: "open" as const };
    if (r.shift) {
      return { ...base, label: `${describeShift(r.shift)} · ${at}`, expected: `${r.x},${r.y}`, actual: `${r.x + r.shift.dx},${r.y + r.shift.dy}` };
    }
    if (r.layout) {
      const { expected: e, actual: a } = r.layout;
      const size = (v: { w: number; h: number }) => `${v.w}×${v.h}`;
      // A different extent is a reflow or resize; the same extent means content inside changed.
      if (Math.abs(e.w - a.w) >= 2 || Math.abs(e.h - a.h) >= 2) {
        return { ...base, label: `Layout changed · ${at}`, expected: size(e), actual: size(a) };
      }
      const share = Math.min(100, Math.max(1, Math.round((r.pixels / (r.w * r.h)) * 100)));
      return { ...base, label: `Content differs · ${at}`, expected: "0%", actual: `${share}%` };
    }
    return { ...base, label: `Mismatch ${i + 1} · ${at}`, expected: r.expectedColor, actual: r.actualColor };
  });
}

function describeShift({ dx, dy }: { dx: number; dy: number }): string {
  const parts: string[] = [];
  if (dy !== 0) parts.push(`${Math.abs(dy)}px ${dy < 0 ? "up" : "down"}`);
  if (dx !== 0) parts.push(`${Math.abs(dx)}px ${dx < 0 ? "left" : "right"}`);
  return `Shifted ${parts.join(", ")}`;
}
