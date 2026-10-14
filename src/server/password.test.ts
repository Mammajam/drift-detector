import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed or tampered hashes instead of throwing", async () => {
    const hash = await hashPassword("pw");
    expect(await verifyPassword("pw", "")).toBe(false);
    expect(await verifyPassword("pw", "bcrypt$1$a$b")).toBe(false);
    // Change the first character of the hash part; the last base64 character can be mostly padding bits.
    const [scheme, cost, salt, key] = hash.split("$");
    const flipped = `${key[0] === "A" ? "B" : "A"}${key.slice(1)}`;
    expect(await verifyPassword("pw", [scheme, cost, salt, flipped].join("$"))).toBe(false);
    expect(await verifyPassword("pw", "scrypt$99999999$a$b")).toBe(false);
  });
});
