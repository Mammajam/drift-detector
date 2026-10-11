import "server-only";

export class InvalidPreviewUrl extends Error {}

export type PreviewUrlOptions = {
  /** Allowed host suffixes, each starting with a dot, e.g. ".deployxa.app". */
  suffixes: string[];
  /** Permit http(s)://localhost for local development. */
  allowLocalhost: boolean;
};

export function previewUrlOptionsFromEnv(): PreviewUrlOptions {
  const suffixes = (process.env.PREVIEW_HOST_SUFFIXES ?? ".deployxa.app")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return { suffixes, allowLocalhost: process.env.NODE_ENV !== "production" };
}

/** The capture worker loads whatever URL it is given, so only Deployxa preview hosts may pass (SSRF guard). */
export function parsePreviewUrl(raw: string, options: PreviewUrlOptions): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidPreviewUrl("Preview URL is not a valid URL.");
  }

  if (url.username || url.password) {
    throw new InvalidPreviewUrl("Preview URL must not contain credentials.");
  }

  const host = url.hostname.toLowerCase();
  if (options.allowLocalhost && host === "localhost" && /^https?:$/.test(url.protocol)) return url;

  if (url.protocol !== "https:") throw new InvalidPreviewUrl("Preview URL must use https.");

  const allowed = options.suffixes.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
  if (!allowed) throw new InvalidPreviewUrl("Preview URL host is not an allowed preview host.");
  return url;
}
