import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_TTL_SECONDS, createSessionToken, safeEqual, verifySessionToken, type Session } from "./auth-token";

export const SESSION_COOKIE = "dd_session";

/** Locally, with no passcode configured, everything is open so development needs no setup. */
const openForDev = () => !process.env.APP_PASSCODE && process.env.NODE_ENV !== "production";

/** True when a passcode exists, so people can sign in. In production without APP_PASSCODE the app stays read-only. */
export const signInEnabled = () => Boolean(process.env.APP_PASSCODE) || openForDev();

const secret = () => process.env.AUTH_SECRET || process.env.APP_PASSCODE || null;

export const passcodeMatches = (input: string) => {
  const expected = process.env.APP_PASSCODE;
  return Boolean(expected) && safeEqual(input, expected!);
};

export async function getSession(): Promise<Session | null> {
  // Read cookies first, in every environment. Otherwise a build without secrets would prerender pages as static
  // (the header calls this), and they would then fail at runtime once a passcode exists.
  const jar = await cookies();
  if (openForDev()) return { name: "Local dev", exp: Number.MAX_SAFE_INTEGER };
  const key = secret();
  if (!key) return null;
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value, key);
}

/** For server actions and protected pages: the session, or a redirect to /login. */
export async function requireSession(next = "/"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

export async function startSession(name: string) {
  const key = secret();
  if (!key) throw new Error("Sign-in is not configured.");
  (await cookies()).set(SESSION_COOKIE, createSessionToken(name, key), {
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
