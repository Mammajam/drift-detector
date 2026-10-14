import "server-only";
import type { Capture } from "@/lib/types";
import { captureScreenshots, type ScreenshotJob, type Screenshotter } from "./capture";
import { CAPTURE_DIFF, diffImages, regionsToDrifts } from "./diff";
import { exportFrame, type FigmaExporter } from "./figma";
import type { CaptureRequest } from "./request";
import { previewUrlOptionsFromEnv, type PreviewUrlOptions } from "./url";

export type Dependencies = {
  screenshot: Screenshotter;
  exportFrame: FigmaExporter;
  urlOptions: PreviewUrlOptions;
};

const defaultDependencies = (): Dependencies => ({
  screenshot: captureScreenshots,
  exportFrame,
  urlOptions: previewUrlOptionsFromEnv(),
});

const dataUrl = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;

/** Captures the preview at each breakpoint × theme, pulls the matching Figma frame, and diffs them into pins. */
export async function runCaptures(
  request: CaptureRequest,
  deps: Dependencies = defaultDependencies(),
): Promise<Capture[]> {
  const jobs: ScreenshotJob[] = request.breakpoints.flatMap((width) =>
    request.themes.map((theme) => ({ width, theme })),
  );
  const builds = await deps.screenshot(request.targetUrl, jobs, deps.urlOptions);

  const captures: Capture[] = [];
  for (const [index, job] of jobs.entries()) {
    const nodeId = request.figmaNodes[`${job.width}-${job.theme}`] ?? request.figmaNodeId;
    const design = await deps.exportFrame(request.figmaFileKey, nodeId);
    const result = diffImages(design, builds[index], CAPTURE_DIFF);

    captures.push({
      route: request.route,
      previewUrl: request.targetUrl,
      commitSha: request.commitSha,
      ...(request.pullRequestUrl ? { pullRequestUrl: request.pullRequestUrl } : {}),
      breakpoint: job.width,
      theme: job.theme,
      frame: { width: result.width, height: result.height },
      drifts: regionsToDrifts(result),
      score: result.score,
      images: { design: dataUrl(design), build: dataUrl(builds[index]) },
    });
  }
  return captures;
}
