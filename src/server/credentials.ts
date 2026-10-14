export const MIN_PASSWORD = 8;
// scrypt hashes any length, but an unbounded body is a cheap way to burn CPU.
export const MAX_PASSWORD = 200;
export const MAX_NAME = 60;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupInput = { name: string; email: string; password: string; confirm: string };
export type SignupField = "name" | "email" | "password" | "confirm";

/** Returns the first problem as a message and the field it belongs to, or null when the input is fine. */
export function validateSignup({ name, email, password, confirm }: SignupInput): { field: SignupField; error: string } | null {
  if (!name || name.length > MAX_NAME) return { field: "name", error: `Enter your name (up to ${MAX_NAME} characters).` };
  if (!EMAIL.test(email) || email.length > 254) return { field: "email", error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD) return { field: "password", error: `Use at least ${MIN_PASSWORD} characters for the password.` };
  if (password.length > MAX_PASSWORD) return { field: "password", error: `Use at most ${MAX_PASSWORD} characters for the password.` };
  if (password !== confirm) return { field: "confirm", error: "The two passwords don't match." };
  return null;
}
