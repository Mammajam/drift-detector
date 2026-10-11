import { describe, expect, it } from "vitest";
import { parsePreviewUrl } from "./url";

const opts = { suffixes: [".deployxa.app"], allowLocalhost: false };

describe("parsePreviewUrl", () => {
  it("accepts https preview hosts", () => {
    expect(parsePreviewUrl("https://pr-42-drift.deployxa.app/pricing", opts).hostname).toBe(
      "pr-42-drift.deployxa.app",
    );
  });

  it.each([
    "http://pr-42.deployxa.app/",
    "https://evil.com/",
    "https://deployxa.app.evil.com/",
    "https://evildeployxa.app/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://user:pass@pr-42.deployxa.app/",
    "file:///etc/passwd",
    "not a url",
  ])("rejects %s", (url) => {
    expect(() => parsePreviewUrl(url, opts)).toThrow();
  });

  it("allows http localhost only when enabled", () => {
    expect(() => parsePreviewUrl("http://localhost:3000/", opts)).toThrow();
    expect(
      parsePreviewUrl("http://localhost:3000/", { ...opts, allowLocalhost: true }).hostname,
    ).toBe("localhost");
  });
});
