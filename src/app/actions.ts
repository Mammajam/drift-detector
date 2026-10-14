"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { DriftStatus } from "@/lib/types";
import { createLimiter, safeNextPath } from "@/server/auth-token";
import { endSession, requireSession, signInEnabled, startSession } from "@/server/auth";
import { MAX_PASSWORD, validateSignup } from "@/server/credentials";
import { hashPassword, dummyHash, verifyPassword } from "@/server/password";
import { getDb } from "@/server/db";
import {
  EmailTaken,
  SignOffBlocked,
  createUser,
  findUserByEmail,
  isUuid,
  seedDemo,
  setDriftStatus,
  signOffBuild,
} from "@/server/db/queries";

export type FormState = {
  error?: string;
  field?: string;
  name?: string;
  email?: string;
  message?: string;
  done?: boolean;
  attempt?: number;
};

/** `attempt` changes on every failure so a repeated identical error is announced again. */
const failure = (error: string, extra: Partial<FormState> = {}): FormState => ({ error, attempt: Date.now(), ...extra });

const projectName = () => process.env.PROJECT_NAME ?? "Drift Detector";
const allowSignIn = createLimiter(10, 10 * 60 * 1000);
const allowSignInPerEmail = createLimiter(5, 10 * 60 * 1000);
const allowSignUp = createLimiter(5, 60 * 60 * 1000);

const clientIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** Where to go after signing in or up: the requested page, or the board rather than the marketing page. */
const landing = (formData: FormData) => {
  const target = safeNextPath(text(formData, "next"));
  return target === "/" ? "/board" : target;
};

export async function signUp(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!signInEnabled()) return failure("Accounts aren't set up on this deployment.");
  if (!allowSignUp(await clientIp())) return failure("Too many sign-ups from here. Try again later.");

  const input = {
    name: text(formData, "name").trim(),
    email: text(formData, "email").trim().toLowerCase(),
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  };
  const kept = { name: input.name, email: input.email };
  const problem = validateSignup(input);
  if (problem) return failure(problem.error, { ...kept, field: problem.field });

  try {
    const user = await createUser(getDb(), {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    });
    await startSession(user);
  } catch (error) {
    if (error instanceof EmailTaken) return failure(error.message, { ...kept, field: "email" });
    throw error;
  }
  redirect(landing(formData));
}

export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!signInEnabled()) return failure("Sign-in isn't set up on this deployment.");

  const email = text(formData, "email").trim().toLowerCase();
  const password = text(formData, "password");
  if (!allowSignIn(await clientIp()) || !allowSignInPerEmail(email)) {
    return failure("Too many attempts. Try again in a few minutes.", { email });
  }
  if (!email || !password || password.length > MAX_PASSWORD) return failure("Enter your email and password.", { email });

  const user = await findUserByEmail(getDb(), email);
  // Always do the hashing work, so an unknown email takes as long as a wrong password.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !valid) return failure("That email and password don't match.", { email, field: "password" });

  await startSession(user);
  redirect(landing(formData));
}

export async function signOut() {
  await endSession();
  redirect("/");
}

const STATUSES: DriftStatus[] = ["open", "fixed", "wont-fix"];

export async function changeDriftStatus(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  await requireSession(`/drifts/${id}`);
  const status = String(formData.get("status") ?? "") as DriftStatus;
  if (!STATUSES.includes(status)) throw new Error("Unknown status.");
  if (!(await setDriftStatus(getDb(), id, status))) throw new Error("That drift no longer exists.");
  revalidatePath("/", "layout");
  return { message: `Status updated to ${status === "wont-fix" ? "Won't fix" : status === "fixed" ? "Fixed" : "Open"}.`, attempt: Date.now() };
}

export async function signOffAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const routeId = String(formData.get("routeId") ?? "");
  const session = await requireSession(`/report/${routeId}`);
  try {
    await signOffBuild(getDb(), routeId, String(formData.get("previewUrl") ?? ""), session.name, isUuid(session.uid) ? session.uid : undefined);
  } catch (error) {
    if (error instanceof SignOffBlocked) return failure(error.message);
    throw error;
  }
  revalidatePath("/", "layout");
  return { done: true };
}

export async function loadDemoData() {
  await requireSession("/board");
  await seedDemo(getDb(), projectName());
  revalidatePath("/", "layout");
}
