import { PNG } from "pngjs";

type Rect = { x: number; y: number; w: number; h: number; color: [number, number, number] };

/** Builds a PNG in memory: a flat background with solid rectangles. Keeps fixtures readable and tiny. */
export function makePng(
  width: number,
  height: number,
  background: [number, number, number],
  rects: Rect[] = [],
): Buffer {
  const png = new PNG({ width, height });
  const paint = (x: number, y: number, [r, g, b]: [number, number, number]) => {
    const i = (y * width + x) * 4;
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) paint(x, y, background);
  for (const { x, y, w, h, color } of rects) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) paint(xx, yy, color);
  }
  return PNG.sync.write(png);
}
