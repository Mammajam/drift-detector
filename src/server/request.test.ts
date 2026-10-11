import { describe, expect, it } from "vitest";
import { BadRequest, parseCaptureRequest } from "./request";

const urlOptions = { suffixes: [".deployxa.app"], allowLocalhost: false };
const valid = {
  previewUrl: "https://pr-42.deployxa.app",
  route: "/pricing",
  figmaFileKey: "AbC123xyz",
  figmaNodeId: "12:34",
};

describe("parseCaptureRequest", () => {
  it("fills in defaults and resolves the target URL", () => {
    const parsed = parseCaptureRequest(valid, urlOptions);
    expect(parsed.targetUrl).toBe("https://pr-42.deployxa.app/pricing");
    expect(parsed.breakpoints).toEqual([375, 768, 1440]);
    expect(parsed.themes).toEqual(["light", "dark"]);
  });

  it("accepts dash node ids and per-frame overrides", () => {
    const parsed = parseCaptureRequest(
      { ...valid, figmaNodeId: "12-34", figmaNodes: { "375-dark": "5:6" }, breakpoints: [375] },
      urlOptions,
    );
    expect(parsed.figmaNodes["375-dark"]).toBe("5:6");
    expect(parsed.breakpoints).toEqual([375]);
  });

  it.each([
    ["non-object", "nope"],
    ["foreign host", { ...valid, previewUrl: "https://evil.com" }],
    ["scheme-relative route", { ...valid, route: "//evil.com/x" }],
    ["backslash route", { ...valid, route: "/\\evil.com" }],
    ["route without slash", { ...valid, route: "pricing" }],
    ["bad file key", { ...valid, figmaFileKey: "../etc" }],
    ["bad node id", { ...valid, figmaNodeId: "abc" }],
    ["unknown breakpoint", { ...valid, breakpoints: [320] }],
    ["bad figmaNodes key", { ...valid, figmaNodes: { wide: "1:2" } }],
  ])("rejects %s", (_name, body) => {
    expect(() => parseCaptureRequest(body, urlOptions)).toThrow(BadRequest);
  });
});
