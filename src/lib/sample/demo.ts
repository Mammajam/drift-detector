import type { Breakpoint, Capture, CaptureTheme } from "@/lib/types";
import { getSampleCapture } from "./pricing";

/** Demo projects for the board, report and ticket pages. Every route reuses the sample pricing frame as its stand-in page. */

export type DemoBuild = {
  captures: Capture[];
  /** Drift keys (d1, d2, …) that start out as fixed. */
  fixedKeys?: string[];
  signedOffBy?: string;
};

export type DemoRoute = {
  path: string;
  figmaFileKey: string;
  figmaNodeId: string;
  /** Oldest first, so the newest build is stored last. */
  builds: DemoBuild[];
};

const HOST = "https://pr-{pr}-drift-detector-app.deployxa.online";

type Shot = [Breakpoint, CaptureTheme, string[]];

function build(path: string, pr: number, sha: string, shots: Shot[], extra: Partial<DemoBuild> = {}): DemoBuild {
  const previewUrl = `${HOST.replace("{pr}", String(pr))}${path}`;
  return {
    ...extra,
    captures: shots.map(([breakpoint, theme, keep]) => {
      const sample = getSampleCapture(breakpoint, theme);
      const drifts = sample.drifts.filter((d) => keep.includes(d.id));
      const area = drifts.reduce((sum, d) => sum + d.bbox.w * d.bbox.h, 0);
      return {
        ...sample,
        route: path,
        previewUrl,
        commitSha: sha,
        pullRequestUrl: `https://github.com/Mammajam/drift-detector/pull/${pr}`,
        drifts,
        score: Math.min(100, Math.round(area * 100)),
      };
    }),
  };
}

export const DEMO_ROUTES: DemoRoute[] = [
  {
    path: "/pricing",
    figmaFileKey: "DemoFigmaFile01",
    figmaNodeId: "1:1",
    builds: [
      build("/pricing", 38, "3f9e2a1", [[375, "light", ["d1", "d2", "d3", "d4"]]], { fixedKeys: ["d1", "d2"] }),
      build("/pricing", 42, "a1b2c3d", [
        [375, "light", ["d2", "d3", "d4"]],
        [375, "dark", ["d2", "d3", "d4", "d5"]],
        [768, "light", ["d3"]],
      ]),
    ],
  },
  {
    path: "/checkout",
    figmaFileKey: "DemoFigmaFile01",
    figmaNodeId: "2:1",
    builds: [build("/checkout", 42, "a1b2c3d", [[375, "light", ["d4"]]])],
  },
  {
    path: "/onboarding",
    figmaFileKey: "DemoFigmaFile01",
    figmaNodeId: "3:1",
    builds: [
      build("/onboarding", 42, "a1b2c3d", [[375, "light", []], [375, "dark", []]], {
        signedOffBy: "Mamadou Kromah",
      }),
    ],
  },
];
