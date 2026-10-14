import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export type Session = { uid: string; name: string; exp: number };

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

/** `<base64url payload>.<hmac>`; the payload is readable but cannot be changed without the secret. */
export function createSessionToken(
  user: { uid: string; name: string },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const payload = b64(JSON.stringify({ ...user, exp: nowSeconds + SESSION_TTL_SECONDS } satisfies Session));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Session | null {
  if (!token) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (typeof session.uid !== "string" || typeof session.name !== "string" || typeof session.exp !== "number") {
      return null;
    }
    return session.exp > nowSeconds ? session : null;
  } catch {
    return null;
  }
}

/** Compares secrets without leaking their length or first differing byte. */
export function safeEqual(a: string, b: string): boolean {
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** Allows at most `limit` attempts per key per window; in-memory, so per server instance. */
export function createLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string, now = Date.now()): boolean => {
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

/** Only same-site paths may be used as a post-login redirect (no open redirect). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  return next;
}
