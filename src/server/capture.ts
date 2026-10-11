import "server-only";
import type { Breakpoint, CaptureTheme } from "@/lib/types";
import { parsePreviewUrl, type PreviewUrlOptions } from "./url";

export type ScreenshotJob = { width: Breakpoint; theme: CaptureTheme };

export type Screenshotter = (
  url: string,
  jobs: ScreenshotJob[],
  urlOptions: PreviewUrlOptions,
) => Promise<Buffer[]>;

const VIEWPORT_HEIGHT = 900;
const NAVIGATION_TIMEOUT_MS = 30_000;

/** Full-page screenshots of one URL at each width × colour scheme, in job order. */
export const captureScreenshots: Screenshotter = async (url, jobs, urlOptions) => {
  // Imported lazily so Next doesn't load Playwright for routes that never capture.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const shots: Buffer[] = [];
    for (const job of jobs) {
      const context = await browser.newContext({
        viewport: { width: job.width, height: VIEWPORT_HEIGHT },
        colorScheme: job.theme,
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS });
        // A redirect must not carry us off the allowed hosts.
        parsePreviewUrl(page.url(), urlOptions);
        shots.push(await page.screenshot({ fullPage: true, animations: "disabled" }));
      } finally {
        await context.close();
      }
    }
    return shots;
  } finally {
    await browser.close();
  }
};
