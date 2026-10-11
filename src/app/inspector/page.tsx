import type { Metadata } from "next";
import Link from "next/link";
import { Inspector } from "@/components/inspector/Inspector";
import { StatePanel } from "@/components/ui/StatePanel";
import type { Capture } from "@/lib/types";
import { getDb, isDatabaseConfigured } from "@/server/db";
import { getLatestCaptures } from "@/server/db/captures-repo";
import { FigmaError } from "@/server/figma";
import { runCaptures } from "@/server/pipeline";
import { BadRequest, parseCaptureRequest } from "@/server/request";
import { previewUrlOptionsFromEnv } from "@/server/url";

export const metadata: Metadata = { title: "Overlay inspector · Drift Detector" };
export const maxDuration = 120;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Live captures spend the Figma token and launch a browser, and stored captures include the
// design frames, so both are off in production until sign-in exists (Phase 5).
// Set ENABLE_LIVE_INSPECTOR=1 to opt in.
const liveEnabled = () => process.env.NODE_ENV !== "production" || process.env.ENABLE_LIVE_INSPECTOR === "1";

async function liveCaptures(params: SearchParams): Promise<Capture[]> {
  const csv = (v: string | string[] | undefined) => first(v)?.split(",").map((s) => s.trim());
  const request = parseCaptureRequest(
    {
      previewUrl: first(params.previewUrl),
      route: first(params.route) ?? "/",
      figmaFileKey: first(params.fileKey),
      figmaNodeId: first(params.nodeId),
      breakpoints: csv(params.bp)?.map(Number),
      themes: csv(params.theme),
    },
    previewUrlOptionsFromEnv(),
  );
  return runCaptures(request);
}

async function storedCaptures(params: SearchParams): Promise<Capture[]> {
  if (!isDatabaseConfigured()) throw new BadRequest("DATABASE_URL is not set, so there are no stored captures.");
  const path = first(params.route) ?? "/";
  const captures = await getLatestCaptures(getDb(), {
    projectName: process.env.PROJECT_NAME ?? "Drift Detector",
    path,
  });
  if (captures.length === 0) throw new BadRequest(`No captures are stored for ${path} yet.`);
  return captures;
}

type InspectorPageProps = {
  // ?state=loading | error | clean previews the other states with sample data.
  // ?source=db&route=/pricing shows the latest stored captures for a route.
  // ?source=api&previewUrl=…&route=/pricing&fileKey=…&nodeId=12:34[&bp=375,768][&theme=light] runs a real capture.
  searchParams: Promise<SearchParams>;
};

export default async function InspectorPage({ searchParams }: InspectorPageProps) {
  const params = await searchParams;
  const state = first(params.state);

  if (state === "loading") return <StatePanel kind="loading" title="Loading the capture…" />;

  if (state === "error") {
    return (
      <StatePanel
        kind="error"
        title="Couldn't load this capture"
        message="The preview build or the Figma frame didn't respond. Try again in a moment."
        action={<Link href="/inspector">Try again</Link>}
      />
    );
  }

  const source = first(params.source);
  if (source === "api" || source === "db") {
    if (!liveEnabled()) {
      return (
        <StatePanel
          kind="error"
          title="Live data is switched off"
          message="Sample data is shown instead until sign-in is added."
          action={<Link href="/inspector">Open the sample inspector</Link>}
        />
      );
    }
    try {
      const captures = source === "db" ? await storedCaptures(params) : await liveCaptures(params);
      return <Inspector captures={captures} />;
    } catch (error) {
      if (!(error instanceof BadRequest || error instanceof FigmaError)) console.error("inspector data failed", error);
      const message =
        error instanceof BadRequest || error instanceof FigmaError
          ? error.message
          : "The capture didn't finish. Check that the preview URL is reachable.";
      return (
        <StatePanel
          kind="error"
          title="Couldn't capture this build"
          message={message}
          action={<Link href="/inspector">Back to the sample inspector</Link>}
        />
      );
    }
  }

  return <Inspector scenario={state === "clean" ? "clean" : "drift"} />;
}
