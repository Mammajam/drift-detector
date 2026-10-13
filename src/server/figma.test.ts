import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FigmaError, exportFrame } from "./figma";

const PNG = Buffer.from([137, 80, 78, 71, 1, 2, 3]);
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-cache-"));
  process.env.FIGMA_TOKEN = "test-token";
  process.env.FIGMA_FRAME_CACHE_DIR = dir;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.FIGMA_FRAME_CACHE_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const okFetch = () =>
  vi.fn(async (url: string) =>
    String(url).includes("/v1/images/")
      ? new Response(JSON.stringify({ err: null, images: { "4:2": "https://cdn.test/frame.png" } }), { status: 200 })
      : new Response(PNG, { status: 200 }),
  );

describe("exportFrame", () => {
  it("downloads once, then serves the frame from the cache without calling Figma", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    expect((await exportFrame("FILEKEY", "4:2")).equals(PNG)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fs.readdirSync(dir)).toEqual(["FILEKEY_4-2@1x.png"]);

    expect((await exportFrame("FILEKEY", "4-2")).equals(PNG)).toBe(true); // dash form hits the same cache entry
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("works from the cache alone, even without a token or a network", async () => {
    fs.writeFileSync(path.join(dir, "FILEKEY_4-2@1x.png"), PNG);
    delete process.env.FIGMA_TOKEN;
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect((await exportFrame("FILEKEY", "4:2")).equals(PNG)).toBe(true);
  });

  it("turns a 429 into a readable message with the wait time", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429, headers: { "retry-after": "399850" } })));
    const error = await exportFrame("FILEKEY", "4:2").catch((e) => e);
    expect(error).toBeInstanceOf(FigmaError);
    expect(error.message).toMatch(/rate limit reached; try again in about 4\.6 days/);
  });

  it("does not cache failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    await expect(exportFrame("FILEKEY", "4:2")).rejects.toThrow(/responded 500/);
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
