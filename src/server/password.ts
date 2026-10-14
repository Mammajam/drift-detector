import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt cost; N=2^15 uses ~32 MiB and takes tens of milliseconds.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 128 * N * R * 2;

const derive = (password: string, salt: Buffer, n: number): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N: n, r: R, p: P, maxmem: MAX_MEM }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

/** `scrypt$<N>$<salt>$<hash>` (base64url), so the cost can change later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N);
  return `scrypt$${N}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, salt, hash, ...rest] = stored.split("$");
  const cost = Number(n);
  if (scheme !== "scrypt" || !salt || !hash || rest.length > 0 || !Number.isInteger(cost) || cost < 2 ** 10 || cost > 2 ** 17) {
    return false;
  }
  try {
    const expected = Buffer.from(hash, "base64url");
    const actual = await derive(password, Buffer.from(salt, "base64url"), cost);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Verified against when an email is unknown, so unknown and wrong-password logins take the same time. */
let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword("not-a-real-password"));
