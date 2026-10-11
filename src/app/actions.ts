"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { DriftStatus } from "@/lib/types";
import { createLimiter, safeNextPath } from "@/server/auth-token";
import { endSession, passcodeMatches, requireSession, signInEnabled, startSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { SignOffBlocked, seedDemo, setDriftStatus, signOffBuild } from "@/server/db/queries";

export type FormState = { error?: string; name?: string; message?: string; done?: boolean; attempt?: number };

/** `attempt` changes on every failure so a repeated identical error is announced again. */
const failure = (error: string, extra: Partial<FormState> = {}): FormState => ({ error, attempt: Date.now(), ...extra });

const projectName = () => process.env.PROJECT_NAME ?? "Drift Detector";
const allowAttempt = createLimiter(5, 10 * 60 * 1000);

export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!signInEnabled()) return failure("Sign-in isn't set up on this deployment.");

  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!allowAttempt(forwarded || "unknown")) return failure("Too many attempts. Try again in a few minutes.");

  const name = String(formData.get("name") ?? "").trim();
  const passcode = String(formData.get("passcode") ?? "");
  if (!name || name.length > 60) return failure("Enter your name (up to 60 characters).", { name });
  // Locally with no passcode the check is skipped; in production a passcode always exists here.
  if (process.env.APP_PASSCODE && !passcodeMatches(passcode)) return failure("That passcode isn't right.", { name });

  await startSession(name);
  redirect(safeNextPath(String(formData.get("next") ?? "")));
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
    await signOffBuild(getDb(), routeId, String(formData.get("previewUrl") ?? ""), session.name);
  } catch (error) {
    if (error instanceof SignOffBlocked) return failure(error.message);
    throw error;
  }
  revalidatePath("/", "layout");
  return { done: true };
}

export async function loadDemoData() {
  await requireSession("/");
  await seedDemo(getDb(), projectName());
  revalidatePath("/", "layout");
}
