import { describe, expect, it } from "vitest";
import { validateSignup } from "./credentials";

const ok = { name: "Ada", email: "ada@example.com", password: "correct horse", confirm: "correct horse" };

describe("validateSignup", () => {
  it("accepts good input", () => expect(validateSignup(ok)).toBeNull());

  it("names the field that is wrong", () => {
    expect(validateSignup({ ...ok, name: "" })?.field).toBe("name");
    expect(validateSignup({ ...ok, name: "x".repeat(61) })?.field).toBe("name");
    expect(validateSignup({ ...ok, email: "not-an-email" })?.field).toBe("email");
    expect(validateSignup({ ...ok, password: "short", confirm: "short" })?.field).toBe("password");
    expect(validateSignup({ ...ok, confirm: "different one" })?.field).toBe("confirm");
  });
});
