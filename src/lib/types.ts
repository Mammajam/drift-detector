export type Breakpoint = 375 | 768 | 1440;
export type CaptureTheme = "light" | "dark";
export type DriftStatus = "open" | "fixed" | "wont-fix";

/** Fractions (0–1) of the captured frame, so pins and outlines scale with it. */
export type BBox = { x: number; y: number; w: number; h: number };

export type Drift = {
  id: string;
  label: string;
  /** Spec value in the design, e.g. "24" or "700/34". */
  expected: string;
  /** Spec value in the build. */
  actual: string;
  /** Design token the expected value maps to, when there is one. */
  token?: string;
  bbox: BBox;
  status: DriftStatus;
  /** Database id of the ticket page (/drifts/[id]); set once the drift is stored. */
  ticketId?: string;
};

export type Capture = {
  /** Set once the capture is stored in Postgres. */
  id?: string;
  route: string;
  previewUrl: string;
  commitSha: string;
  /** GitHub pull request the preview build belongs to, when known. */
  pullRequestUrl?: string;
  breakpoint: Breakpoint;
  theme: CaptureTheme;
  /** Pixel size of the captured frame. */
  frame: { width: number; height: number };
  drifts: Drift[];
  /** 0 = identical, 100 = 10% or more of the pixels differ. */
  score?: number;
  /** PNG data URLs of the Figma frame and the build screenshot; absent for sample data. */
  images?: { design: string; build: string };
};

/** One preview build of a route: every capture taken from the same preview URL. */
export type BuildSummary = {
  previewUrl: string;
  commitSha: string;
  pullRequestUrl?: string;
  createdAt: string;
  captureCount: number;
  openDrifts: number;
  fixedDrifts: number;
  wontFixDrifts: number;
  /** Worst drift score across the build's captures, 0–100. */
  score: number;
  signedOffBy?: string;
};

export type BoardRoute = { id: string; path: string; builds: BuildSummary[] };
