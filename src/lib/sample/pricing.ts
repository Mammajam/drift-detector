import type { BBox, Breakpoint, Capture, CaptureTheme, Drift } from "@/lib/types";

/** Pixel geometry of the sample /pricing frame; SampleFrame.module.css must match these numbers. */
export const FRAME_HEIGHT = 352;
export const CARD_TOP = 20;
export const CARD_WIDTH = 300;
export const DESIGN_CARD_HEIGHT = 312;

function box(frameWidth: number, x: number, y: number, w: number, h: number): BBox {
  return { x: x / frameWidth, y: y / FRAME_HEIGHT, w: w / frameWidth, h: h / FRAME_HEIGHT };
}

/** A pricing card whose build drifts from the design by a few pixels; the card is centred at every width. */
export function getSampleCapture(
  breakpoint: Breakpoint,
  theme: CaptureTheme,
  options: { clean?: boolean } = {},
): Capture {
  const left = (breakpoint - CARD_WIDTH) / 2;
  const inner = left + 24;

  const drifts: Drift[] = options.clean
    ? []
    : [
        {
          id: "d1",
          label: "Card padding",
          expected: "24",
          actual: "20",
          token: "space-5",
          bbox: box(breakpoint, left, CARD_TOP, CARD_WIDTH, 24),
          status: "open",
        },
        {
          id: "d2",
          label: "Price weight and size",
          expected: "700/34",
          actual: "600/32",
          bbox: box(breakpoint, inner, 66, 160, 40),
          status: "open",
        },
        {
          id: "d3",
          label: "Feature list gap",
          expected: "10",
          actual: "6",
          bbox: box(breakpoint, inner, 166, 180, 80),
          status: "open",
        },
        {
          id: "d4",
          label: "Button radius and height",
          expected: "10·44",
          actual: "6·40",
          token: "radius-md",
          bbox: box(breakpoint, inner, 264, 252, 44),
          status: "open",
        },
        ...(theme === "dark"
          ? [
              {
                id: "d5",
                label: "Card surface (dark only)",
                expected: "surface",
                actual: "tint",
                token: "color-surface",
                bbox: box(breakpoint, left, CARD_TOP, CARD_WIDTH, DESIGN_CARD_HEIGHT),
                status: "open" as const,
              },
            ]
          : []),
      ];

  return {
    route: "/pricing",
    previewUrl: "https://pr-42-drift-detector.deployxa.app/pricing",
    commitSha: "a1b2c3d",
    breakpoint,
    theme,
    frame: { width: breakpoint, height: FRAME_HEIGHT },
    drifts,
  };
}
