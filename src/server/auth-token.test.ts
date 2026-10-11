import { describe, expect, it } from "vitest";
import { createLimiter, createSessionToken, safeEqual, safeNextPath, verifySessionToken } from "./auth-token";

const SECRET = "test-secret-value";
const NOW = 1_800_000_000;

describe("session tokens", () => {
  it("round-trips a session", () => {
    const token = createSessionToken("Ada", SECRET, NOW);
    expect(verifySessionToken(token, SECRET, NOW + 10)).toMatchObject({ name: "Ada" });
  });

  it("rejects expired, tampered, wrong-secret and malformed tokens", () => {
    const token = createSessionToken("Ada", SECRET, NOW);
    expect(verifySessionToken(token, SECRET, NOW + 60 * 60 * 24 * 8)).toBeNull();
    expect(verifySessionToken(token, "other-secret", NOW)).toBeNull();

    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ name: "Admin", exp: NOW + 999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
    expect(verifySessionToken(`${payload}.`, SECRET, NOW)).toBeNull();
    expect(verifySessionToken("a.b.c", SECRET, NOW)).toBeNull();
    expect(verifySessionToken(undefined, SECRET, NOW)).toBeNull();
    expect(verifySessionToken("", SECRET, NOW)).toBeNull();
  });
});

describe("safeEqual", () => {
  it("compares equal and different secrets, including different lengths", () => {
    expect(safeEqual("hunter2", "hunter2")).toBe(true);
    expect(safeEqual("hunter2", "hunter3")).toBe(false);
    expect(safeEqual("a", "a-much-longer-value")).toBe(false);
  });
});

describe("createLimiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    const allow = createLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => allow("ip", 0))).toEqual([true, true, true, false]);
    expect(allow("other", 0)).toBe(true);
    expect(allow("ip", 1001)).toBe(true);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/report/abc", "/report/abc"],
    ["/", "/"],
    [null, "/"],
    ["https://evil.com", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["javascript:alert(1)", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
