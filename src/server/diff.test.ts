import { describe, expect, it } from "vitest";
import { makePng } from "./__fixtures__/png";
import { CAPTURE_DIFF, diffImages, regionsToDrifts } from "./diff";

const WHITE: [number, number, number] = [255, 255, 255];
const BLUE: [number, number, number] = [47, 91, 234];
const AMBER: [number, number, number] = [229, 138, 31];

const card = (color: [number, number, number], x = 20, y = 20) => [
  { x, y, w: 100, h: 40, color },
];

describe("diffImages", () => {
  it("finds no drift in identical images", () => {
    const png = makePng(200, 120, WHITE, card(BLUE));
    const result = diffImages(png, png);
    expect(result.regions).toEqual([]);
    expect(result.mismatchRatio).toBe(0);
    expect(result.score).toBe(0);
  });

  it("reports one region, tight to the element, when a colour changes", () => {
    const result = diffImages(
      makePng(200, 120, WHITE, card(BLUE)),
      makePng(200, 120, WHITE, card(AMBER)),
    );
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]).toMatchObject({ x: 20, y: 20, w: 100, h: 40 });
    expect(result.regions[0].expectedColor).toBe("#2f5bea");
    expect(result.regions[0].actualColor).toBe("#e58a1f");
    expect(result.mismatchRatio).toBeCloseTo(4000 / 24000, 3);
  });

  it("covers a shifted element with regions on both edges", () => {
    const result = diffImages(
      makePng(200, 120, WHITE, card(BLUE, 20)),
      makePng(200, 120, WHITE, card(BLUE, 14)),
    );
    expect(result.regions.length).toBeGreaterThanOrEqual(1);
    const left = Math.min(...result.regions.map((r) => r.x));
    const right = Math.max(...result.regions.map((r) => r.x + r.w));
    expect(left).toBe(14);
    expect(right).toBe(120);
  });

  it("returns separate regions for distant changes, in reading order", () => {
    const design = makePng(300, 300, WHITE, [
      { x: 200, y: 20, w: 40, h: 40, color: BLUE },
      { x: 20, y: 200, w: 40, h: 40, color: BLUE },
    ]);
    const build = makePng(300, 300, WHITE, [
      { x: 200, y: 20, w: 40, h: 40, color: AMBER },
      { x: 20, y: 200, w: 40, h: 40, color: AMBER },
    ]);
    const { regions } = diffImages(design, build);
    expect(regions).toHaveLength(2);
    expect(regions[0].y).toBeLessThan(regions[1].y);
  });

  it("merges changes that sit close together into one region", () => {
    const design = makePng(200, 100, WHITE, [
      { x: 20, y: 20, w: 20, h: 20, color: BLUE },
      { x: 48, y: 20, w: 20, h: 20, color: BLUE },
    ]);
    const build = makePng(200, 100, WHITE, [
      { x: 20, y: 20, w: 20, h: 20, color: AMBER },
      { x: 48, y: 20, w: 20, h: 20, color: AMBER },
    ]);
    expect(diffImages(design, build).regions).toHaveLength(1);
  });

  it("ignores single-pixel noise", () => {
    const result = diffImages(
      makePng(100, 100, WHITE),
      makePng(100, 100, WHITE, [{ x: 50, y: 50, w: 1, h: 1, color: [0, 0, 0] }]),
    );
    expect(result.regions).toEqual([]);
  });

  it("compares a taller build against the design's size instead of throwing", () => {
    const result = diffImages(makePng(100, 100, WHITE), makePng(100, 180, WHITE));
    expect(result.height).toBe(100);
    expect(result.regions).toEqual([]);
  });

  it("treats a build shorter than the design as drift in the missing area", () => {
    const result = diffImages(makePng(100, 100, WHITE), makePng(100, 60, WHITE));
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].y).toBe(60);
  });

  it("caps the score at 100", () => {
    const result = diffImages(makePng(50, 50, WHITE), makePng(50, 50, [0, 0, 0]));
    expect(result.score).toBe(100);
  });
});

describe("regionsToDrifts", () => {
  it("turns regions into numbered drifts with fractional boxes and colour specs", () => {
    const result = diffImages(
      makePng(200, 120, WHITE, card(BLUE)),
      makePng(200, 120, WHITE, card(AMBER)),
    );
    const [drift] = regionsToDrifts(result);
    expect(drift).toMatchObject({
      id: "d1",
      expected: "#2f5bea",
      actual: "#e58a1f",
      status: "open",
    });
    expect(drift.bbox).toEqual({ x: 0.1, y: 20 / 120, w: 0.5, h: 40 / 120 });
    expect(drift.label).toContain("100×40");
  });
});

describe("tolerant comparison (CAPTURE_DIFF)", () => {
  // Thin 1px strokes standing in for text: the same words, drawn 1px apart by different renderers.
  const strokes = (dx: number) =>
    Array.from({ length: 8 }, (_, i) => ({ x: 20 + dx, y: 20 + i * 6, w: 120, h: 1, color: [30, 30, 40] as [number, number, number] }));

  it("flags sub-pixel text differences when comparing exact pixels, but not when tolerant", () => {
    const design = makePng(200, 100, WHITE, strokes(0));
    const build = makePng(200, 100, WHITE, strokes(1));
    expect(diffImages(design, build).regions.length).toBeGreaterThan(0);
    expect(diffImages(design, build, CAPTURE_DIFF).regions).toEqual([]);
  });

  it("still catches a real layout shift of several pixels", () => {
    const design = makePng(300, 200, WHITE, [{ x: 40, y: 40, w: 160, h: 60, color: BLUE }]);
    const build = makePng(300, 200, WHITE, [{ x: 40, y: 56, w: 160, h: 60, color: BLUE }]);
    const { regions } = diffImages(design, build, CAPTURE_DIFF);
    expect(regions.length).toBeGreaterThan(0);
    expect(Math.min(...regions.map((r) => r.y))).toBeLessThanOrEqual(44);
    expect(Math.max(...regions.map((r) => r.y + r.h))).toBeGreaterThanOrEqual(112);
  });

  it("keeps mean colours from the original pixels, not the blurred ones", () => {
    const { regions } = diffImages(
      makePng(200, 120, WHITE, card(BLUE)),
      makePng(200, 120, WHITE, card(AMBER)),
      CAPTURE_DIFF,
    );
    expect(regions[0].expectedColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(regions[0].expectedColor).not.toBe(regions[0].actualColor);
  });

  it("describes a moved block by how far it moved", () => {
    const design = makePng(300, 200, WHITE, [{ x: 40, y: 40, w: 160, h: 60, color: BLUE }]);
    const build = makePng(300, 200, WHITE, [{ x: 40, y: 56, w: 160, h: 60, color: BLUE }]);
    const drifts = regionsToDrifts(diffImages(design, build, CAPTURE_DIFF));
    expect(drifts.length).toBeGreaterThan(0);
    for (const d of drifts) {
      expect(d.label).toContain("Shifted 16px down");
      const [ex, ey] = d.expected.split(",").map(Number);
      const [ax, ay] = d.actual.split(",").map(Number);
      expect([ax - ex, ay - ey]).toEqual([0, 16]);
    }
  });

  it("keeps colours, not a shift, for a plain recolour", () => {
    const [drift] = regionsToDrifts(
      diffImages(makePng(200, 120, WHITE, card(BLUE)), makePng(200, 120, WHITE, card(AMBER)), CAPTURE_DIFF),
    );
    expect(drift.label).toContain("Mismatch");
    expect(drift.expected).toMatch(/^#[0-9a-f]{6}$/);
  });
});
