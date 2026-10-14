import type { Metadata } from "next";
import Link from "next/link";
import { Inspector } from "@/components/inspector/Inspector";
import { StatePanel } from "@/components/ui/StatePanel";
import type { Capture } from "@/lib/types";
import { getDb, isDatabaseConfigured } from "@/server/db";
import { getLatestCaptures } from "@/server/db/captures-repo";
import { getSession } from "@/server/auth";
import { FigmaError } from "@/server/figma";
import { runCaptures } from "@/server/pipeline";
import { BadRequest, parseCaptureRequest } from "@/server/request";
import { previewUrlOptionsFromEnv } from "@/server/url";

export const metadata: Metadata = { title: "Overlay inspector · Drift Detector" };
export const maxDuration = 120;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** "1440-light:4:2,375-light:4:87" → { "1440-light": "4:2", "375-light": "4:87" } (a Figma frame per width and theme). */
function nodeMap(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  return Object.fromEntries(
    raw
      .split(",")
      .filter(Boolean)
      .map((pair) => [pair.slice(0, pair.indexOf(":")), pair.slice(pair.indexOf(":") + 1)]),
  );
}

async function liveCaptures(params: SearchParams): Promise<Capture[]> {
  const csv = (v: string | string[] | undefined) => first(v)?.split(",").map((s) => s.trim());
  const request = parseCaptureRequest(
    {
      previewUrl: first(params.previewUrl),
      route: first(params.route) ?? "/",
      figmaFileKey: first(params.fileKey),
      figmaNodeId: first(params.nodeId),
      figmaNodes: nodeMap(first(params.nodes)),
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
  const captures = await getLatestCaptures(
    getDb(),
    { projectName: process.env.PROJECT_NAME ?? "Drift Detector", path },
    first(params.build),
  );
  if (captures.length === 0) throw new BadRequest(`No captures are stored for ${path} yet.`);
  return captures;
}

type InspectorPageProps = {
  // ?state=loading | error | clean previews the other states with sample data.
  // ?source=db&route=/pricing[&build=<previewUrl>] shows the latest stored captures for a route (or one build of it).
  // ?source=api&previewUrl=…&route=/pricing&fileKey=…&nodeId=12:34[&nodes=375-light:5:6,…][&bp=375,768][&theme=light] runs a real capture.
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
    // Reading stored captures is public; running a live capture spends the Figma token and CPU.
    if (source === "api" && !(await getSession())) {
      return (
        <StatePanel
          kind="error"
          title="Sign in to run a live capture"
          message="Stored captures are open to everyone; live captures need an account."
          action={<Link href="/login?next=/inspector">Sign in</Link>}
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
