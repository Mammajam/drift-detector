import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { SESSION_TTL_SECONDS, createSessionToken, safeEqual, verifySessionToken, type Session } from "./auth-token";
import { getDb, isDatabaseConfigured } from "./db";
import { findUserById } from "./db/queries";

export const SESSION_COOKIE = "dd_session";

const secret = () => process.env.AUTH_SECRET || null;

/** Locally, with no AUTH_SECRET, everything is open so development needs no setup. */
const openForDev = () => !secret() && process.env.NODE_ENV !== "production";

/** True when accounts work: a signing secret and a database. In production without them the app stays read-only. */
export const signInEnabled = () => Boolean(secret()) && isDatabaseConfigured();

// cache(): the header and the page both ask, but the account is looked up once per request.
export const getSession = cache(async (): Promise<Session | null> => {
  // Read cookies first, in every environment. Otherwise a build without secrets would prerender pages as static
  // (the header calls this), and they would then fail at runtime once a secret exists.
  const jar = await cookies();
  if (openForDev()) return { uid: "local-dev", name: "Local dev", exp: Number.MAX_SAFE_INTEGER };
  const key = secret();
  if (!key || !isDatabaseConfigured()) return null;

  const session = verifySessionToken(jar.get(SESSION_COOKIE)?.value, key);
  if (!session) return null;
  try {
    // Re-check the account so a deleted user loses access, and so the name is always current.
    const user = await findUserById(getDb(), session.uid);
    return user ? { ...session, name: user.name } : null;
  } catch {
    return null;
  }
});

/** For server actions and protected pages: the session, or a redirect to /login. */
export async function requireSession(next = "/"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

export async function startSession(user: { id: string; name: string }) {
  const key = secret();
  if (!key) throw new Error("Sign-in is not configured.");
  (await cookies()).set(SESSION_COOKIE, createSessionToken({ uid: user.id, name: user.name }, key), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** API callers: a signed-in browser session, or `Authorization: Bearer $CAPTURE_API_TOKEN` (for CI). */
export async function isApiAuthorized(request: Request): Promise<boolean> {
  if (await getSession()) return true;
  const token = process.env.CAPTURE_API_TOKEN;
  const header = request.headers.get("authorization");
  return Boolean(token && header?.startsWith("Bearer ") && safeEqual(header.slice(7), token));
}
