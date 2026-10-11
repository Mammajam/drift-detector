const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** "11 Oct 2026, 08:24 UTC": fixed zone so server and client always agree. */
export const formatDateTime = (iso: string) => `${dateTime.format(new Date(iso))} UTC`;

/** "PR #42" for a GitHub pull request URL, else the preview host. */
export function buildLabel(previewUrl: string, pullRequestUrl?: string): string {
  const pr = pullRequestUrl?.match(/\/pull\/(\d+)$/)?.[1];
  if (pr) return `PR #${pr}`;
  try {
    return new URL(previewUrl).host;
  } catch {
    return previewUrl;
  }
}

export const themeLabel = (theme: "light" | "dark") => (theme === "light" ? "Light" : "Dark");

export const inspectorHref = (path: string, previewUrl?: string) =>
  `/inspector?source=db&route=${encodeURIComponent(path)}${previewUrl ? `&build=${encodeURIComponent(previewUrl)}` : ""}`;
