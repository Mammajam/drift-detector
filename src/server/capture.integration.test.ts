import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { captureScreenshots } from "./capture";

const hasChromium = existsSync(chromium.executablePath());

// A page whose background follows the colour scheme, so the light and dark captures must differ.
const PAGE = `<!doctype html><meta name=viewport content="width=device-width">
<style>body{margin:0;height:300px;background:#fff;color:#000}@media(prefers-color-scheme:dark){body{background:#000;color:#fff}}</style>
<p>hello</p>`;

describe.skipIf(!hasChromium)("captureScreenshots (real Chromium)", () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer((_req, res) => res.setHeader("content-type", "text/html").end(PAGE));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://localhost:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("captures at each width and colour scheme", async () => {
    const shots = await captureScreenshots(
      url,
      [
        { width: 375, theme: "light" },
        { width: 375, theme: "dark" },
        { width: 768, theme: "light" },
      ],
      { suffixes: [".deployxa.app"], allowLocalhost: true },
    );

    const [light, dark, wide] = shots.map((s) => PNG.sync.read(s));
    expect([light.width, wide.width]).toEqual([375, 768]);
    expect(light.data[0]).toBe(255); // white page
    expect(dark.data[0]).toBe(0); // black page
  }, 60_000);

  it("rejects a page that ends up on a host that is not allowed", async () => {
    await expect(
      captureScreenshots(url, [{ width: 375, theme: "light" }], {
        suffixes: [".deployxa.app"],
        allowLocalhost: false,
      }),
    ).rejects.toThrow();
  }, 60_000);
});
