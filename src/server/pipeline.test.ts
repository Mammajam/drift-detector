import { describe, expect, it } from "vitest";
import { makePng } from "./__fixtures__/png";
import { runCaptures } from "./pipeline";
import type { CaptureRequest } from "./request";

const WHITE: [number, number, number] = [255, 255, 255];
const request: CaptureRequest = {
  targetUrl: "https://pr-42.deployxa.app/pricing",
  route: "/pricing",
  figmaFileKey: "AbC123xyz",
  figmaNodeId: "1:1",
  figmaNodes: { "375-dark": "2:2" },
  commitSha: "a1b2c3d",
  breakpoints: [375, 768],
  themes: ["light", "dark"],
};

describe("runCaptures", () => {
  it("captures every breakpoint × theme and turns the diff into pins", async () => {
    const exported: string[] = [];
    const captures = await runCaptures(request, {
      urlOptions: { suffixes: [".deployxa.app"], allowLocalhost: false },
      screenshot: async (_url, jobs) =>
        jobs.map(() => makePng(100, 60, WHITE, [{ x: 10, y: 10, w: 30, h: 20, color: [0, 0, 255] }])),
      exportFrame: async (_key, nodeId) => {
        exported.push(nodeId);
        return makePng(100, 60, WHITE, [{ x: 10, y: 10, w: 30, h: 20, color: [255, 0, 0] }]);
      },
    });

    expect(captures.map((c) => `${c.breakpoint}-${c.theme}`)).toEqual([
      "375-light",
      "375-dark",
      "768-light",
      "768-dark",
    ]);
    expect(exported).toEqual(["1:1", "2:2", "1:1", "1:1"]);
    expect(captures[0].drifts).toHaveLength(1);
    expect(captures[0].drifts[0]).toMatchObject({ expected: "#ff0000", actual: "#0000ff" });
    expect(captures[0].images?.design).toMatch(/^data:image\/png;base64,/);
    expect(captures[0].score).toBeGreaterThan(0);
  });
});
