import { NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@/server/db";
import { saveCaptures } from "@/server/db/captures-repo";
import { isApiAuthorized } from "@/server/auth";
import { FigmaError } from "@/server/figma";
import { runCaptures } from "@/server/pipeline";
import { BadRequest, parseCaptureRequest } from "@/server/request";
import { previewUrlOptionsFromEnv } from "@/server/url";

export const runtime = "nodejs";
export const maxDuration = 120;

/** POST { previewUrl, route, figmaFileKey, figmaNodeId, figmaNodes?, breakpoints?, themes? } → { captures, persisted } */
export async function POST(request: Request) {
  // Captures spend the Figma token and CPU, so they need a signed-in session or the CI bearer token.
  if (!(await isApiAuthorized(request))) {
    return NextResponse.json({ error: "Sign in to run captures." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  try {
    const parsed = parseCaptureRequest(body, previewUrlOptionsFromEnv());
    const captures = await runCaptures(parsed);
    if (!isDatabaseConfigured()) return NextResponse.json({ captures, persisted: false });

    try {
      const saved = await saveCaptures(
        getDb(),
        {
          projectName: process.env.PROJECT_NAME ?? "Drift Detector",
          path: parsed.route,
          figmaFileKey: parsed.figmaFileKey,
          figmaNodeId: parsed.figmaNodeId,
        },
        captures,
      );
      return NextResponse.json({ captures: saved, persisted: true });
    } catch (error) {
      // The run is expensive, so hand the result back even if storing it failed.
      console.error("saving captures failed", error);
      return NextResponse.json({ captures, persisted: false });
    }
  } catch (error) {
    if (error instanceof BadRequest) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof FigmaError) return NextResponse.json({ error: error.message }, { status: 502 });
    console.error("capture failed", error);
    return NextResponse.json({ error: "Capture failed." }, { status: 500 });
  }
}
