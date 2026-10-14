// Records a narrated walkthrough of Drift Detector with Playwright (browser only, no desktop capture).
//
//   node scripts/record-demo.mjs                       # read-only tour of the live site
//   DEMO_PASSCODE=… node scripts/record-demo.mjs       # adds a signed-in segment (changes statuses, signs off a build!)
//
// Env: BASE_URL, OUT_DIR (default demo-recording), VOICE (default Daniel), RATE (words/min, default 170),
//      DEMO_NAME (approver name), NO_AUDIO=1 (video only).
// Output: demo-silent.webm, narration.wav/.m4a (timed to the video), transcript.md.
// The narration is macOS text-to-speech; joining audio and video needs ffmpeg (see transcript.md).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL ?? "https://drift-detector-app.deployxa.online").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT_DIR ?? "demo-recording");
const VOICE = process.env.VOICE ?? "Daniel";
const RATE = process.env.RATE ?? "170";
const PASSCODE = process.env.DEMO_PASSCODE; // never printed or logged
const NAME = process.env.DEMO_NAME ?? "Demo reviewer";
const AUDIO = process.env.NO_AUDIO !== "1";
// The real-capture segments run against the local app (a capture needs a browser on the server) and local builds of the preview targets.
const LOCAL = (process.env.LOCAL_APP ?? "http://localhost:3001").replace(/\/$/, "");
const PR_BUILD = process.env.PR_BUILD ?? "http://localhost:3002"; // the pull request build (intentional drift)
const FIXED_BUILD = process.env.FIXED_BUILD ?? "http://localhost:3003"; // main with the fix
const FIGMA_FILE = process.env.FIGMA_FILE ?? "dwnZRih3yJsnw9JRkS7G7C";
const REAL_CAPTURE = process.env.REAL_CAPTURE !== "0";
const ONLY = process.env.ONLY?.split(",").map((s) => s.trim()); // e.g. ONLY=signed-in to rehearse one segment
const SYNC_LAG_MS = 250; // the video starts a moment before our clock does

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(OUT, ".tmp-"));

/* ---------- helpers ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A visible cursor and click ripple, because headless videos don't draw the mouse.
const CURSOR = `
(() => {
  const add = () => {
    if (document.getElementById("__cursor")) return;
    const c = document.createElement("div");
    c.id = "__cursor";
    c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;" +
      "background:rgba(255,255,255,.35);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.5);z-index:2147483647;" +
      "pointer-events:none;transition:transform .08s,background .15s";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => { c.style.transform = "scale(.7)"; c.style.background = "rgba(255,200,0,.7)"; }, true);
    addEventListener("mouseup", () => { c.style.transform = "scale(1)"; c.style.background = "rgba(255,255,255,.35)"; }, true);
  };
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", add) : add();
})();`;

async function glide(page, locator, pause = 450) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 30 });
  await sleep(pause);
  return { x, y };
}

async function click(page, locator, pause = 700) {
  const { x, y } = await glide(page, locator, 250);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
  await sleep(pause);
  return { x, y };
}

async function scrollBy(page, dy, steps = 12, delay = 60) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(delay);
  }
}

async function press(page, key, times = 1, delay = 350) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await sleep(delay);
  }
}

/* ---------- narration (macOS text-to-speech) ---------- */

function readWav(file) {
  const b = fs.readFileSync(file);
  let off = 12;
  let fmt;
  let data;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === "data") data = b.subarray(off + 8, Math.min(b.length, off + 8 + size));
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`unreadable wav: ${file}`);
  return { fmt, data };
}

function speak(id, text) {
  const aiff = path.join(tmp, `${id}.aiff`);
  const wav = path.join(tmp, `${id}.wav`);
  execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@22050", aiff, wav]);
  const { fmt, data } = readWav(wav);
  return { wav, ms: Math.round((data.length / (fmt.rate * fmt.ch * (fmt.bits / 8))) * 1000) };
}

function writeTimeline(parts, totalMs, file) {
  const rate = 22050;
  const bytesPerMs = (rate * 2) / 1000;
  const pcm = Buffer.alloc(Math.ceil(totalMs * bytesPerMs / 2) * 2);
  for (const { wav, startMs } of parts) {
    const { data } = readWav(wav);
    data.copy(pcm, Math.floor((startMs * bytesPerMs) / 2) * 2, 0, Math.min(data.length, pcm.length));
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

/* ---------- the tour ---------- */

const byRole = (page, role, name) => page.getByRole(role, { name });
const themeSwitch = (page) => page.getByRole("group", { name: "Theme" });


const captureUrl = (target, widths) =>
  `${LOCAL}/inspector?source=api&previewUrl=${encodeURIComponent(target)}&route=%2F&fileKey=${FIGMA_FILE}&nodeId=4%3A2` +
  `&nodes=${encodeURIComponent("1440-light:4:2,375-light:4:87")}&bp=${widths}&theme=light`;

/** Hide the Next.js dev badge that the local dev server draws in the corner. */
const hideDevBadge = (page) => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

const segments = [
  {
    id: "landing",
    text: "This is Drift Detector. It lays the Figma frame over every Deployxa preview build, flags each spacing, type and colour mismatch, and turns it into a fix ticket. What you're seeing is the live app, running on Deployxa.",
    run: async (page) => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await sleep(1500);
      await glide(page, byRole(page, "link", "Open the overlay inspector"));
      await sleep(1200);
      await glide(page, byRole(page, "link", "View the project board"));
    },
  },
  {
    id: "board",
    text: "The project board lists every route against its preview builds. Each build shows a drift score as a shape, a word and a number, so it never relies on colour alone, plus how many drifts are open and who signed it off. The builds here are sample data, seeded for this demo.",
    run: async (page) => {
      await click(page, byRole(page, "link", "View the project board"), 1500);
      await page.waitForURL(/\/board$/);
      await sleep(2500);
      await scrollBy(page, 360, 14);
      await sleep(2500);
      await scrollBy(page, 360, 14);
    },
  },
  {
    id: "inspector",
    text: "Opening a build in the inspector. The overlay blends the Figma frame with the live build, and a slider moves between them. Difference mode highlights only what changed. Side by side shows both. Numbered pins mark each drift, and every pin has a twin in this list.",
    run: async (page) => {
      await click(page, page.getByRole("link", { name: /Inspect .* of \/pricing/ }).first(), 1500);
      await page.waitForURL(/\/inspector/);
      await page.getByRole("slider").waitFor();
      await sleep(1500);
      const slider = page.getByRole("slider");
      await glide(page, slider);
      await slider.focus();
      await press(page, "Home", 1, 300);
      for (let i = 0; i < 80; i++) await press(page, "ArrowRight", 1, 22);
      await press(page, "ArrowLeft", 45, 22);
      await click(page, byRole(page, "button", "Difference"), 1800);
      await click(page, byRole(page, "button", "Side-by-side"), 2200);
      await click(page, byRole(page, "button", "Overlay"), 900);
      await click(page, page.getByRole("button", { name: /^Drift 1:/ }), 1500);
    },
  },
  {
    id: "keyboard",
    text: "Everything works from the keyboard. Arrow keys move through the drifts, Enter selects one, and the pin and the list stay in sync. Each capture also comes in light and dark, so a dark mode only bug becomes its own ticket.",
    run: async (page) => {
      const items = page.getByRole("list", { name: "Drifts" }).getByRole("button");
      await items.first().focus();
      await press(page, "ArrowDown", 1, 900);
      await press(page, "Enter", 1, 1500);
      await press(page, "ArrowDown", 1, 900);
      await press(page, "Enter", 1, 1500);
      await click(page, page.getByRole("group", { name: "Capture theme" }).getByRole("button", { name: "Dark" }), 2200);
      await click(page, page.getByRole("group", { name: "Capture theme" }).getByRole("button", { name: "Light" }), 1200);
      await click(page, page.getByRole("button", { name: /^Drift 1:/ }), 1000);
    },
  },
  {
    id: "ticket",
    text: "Each drift becomes a ticket with the exact expected and actual values in monospace, the design token, the region in pixels, the pull request, and cropped evidence from the design and from the build.",
    run: async (page) => {
      await click(page, page.getByRole("link", { name: /Open ticket for drift 1/ }).first(), 1500);
      await page.waitForURL(/\/drifts\//);
      await sleep(3000);
      await scrollBy(page, 420, 16);
      await sleep(3500);
    },
  },
  {
    id: "report",
    text: "The sign off report groups drifts as open, fixed or won't fix. A build can only be approved once nothing is open, and approval records who signed it off. If production goes wrong, the report links to Deployxa's rollback.",
    run: async (page) => {
      // The breadcrumb sits under the sticky header once the ticket is scrolled, so return to the top first.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await sleep(1500);
      await click(page, page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link").nth(1), 1500);
      await page.waitForURL(/\/report\//);
      await sleep(3000);
      await glide(page, page.getByRole("heading", { name: "Approval" }));
      await sleep(2500);
      await glide(page, page.getByRole("link", { name: /Roll back on Deployxa/ }));
      await sleep(1500);
    },
  },
  ...(REAL_CAPTURE
    ? [
        {
          id: "capture-start",
          text: "Now a real capture. This pull request trims the hero's padding from forty eight to thirty two pixels. The capture engine screenshots that build in a real browser, exports the matching Figma frames, and compares them pixel by pixel. This runs on my machine, against a local build.",
          run: async (page) => {
            await page.goto(captureUrl(PR_BUILD, "1440,375"), { waitUntil: "domcontentloaded" });
            await page.getByRole("slider").waitFor({ timeout: 120000 });
            await hideDevBadge(page);
            await sleep(1500);
          },
        },
        {
          id: "capture-result",
          text: "And there is the drift. The score jumps, and the hero block is flagged as pins, each with its size and position. Difference mode shows exactly what moved, and the same build is flagged at three seventy five pixels too.",
          run: async (page) => {
            await hideDevBadge(page);
            await glide(page, page.getByText(/Drift score/));
            await sleep(1500);
            await click(page, page.getByRole("button", { name: /^Drift 1:/ }), 1800);
            await click(page, byRole(page, "button", "Difference"), 2800);
            await click(page, byRole(page, "button", "Side-by-side"), 2800);
            await click(page, byRole(page, "button", "Overlay"), 1200);
            await click(page, page.getByRole("group", { name: "Breakpoint (px)" }).getByRole("button", { name: "375" }), 3000);
            await click(page, page.getByRole("group", { name: "Breakpoint (px)" }).getByRole("button", { name: "1440" }), 1500);
          },
        },
        {
          id: "recheck-start",
          text: "After the fix, the same check runs again on the main branch.",
          run: async (page) => {
            await page.goto(captureUrl(FIXED_BUILD, "1440"), { waitUntil: "domcontentloaded" });
            await page.getByRole("slider").waitFor({ timeout: 120000 });
            await hideDevBadge(page);
            await sleep(800);
          },
        },
        {
          id: "recheck-result",
          text: "The score drops to near zero at desktop width, and only small typographic details remain. That is the loop: flag, fix, re-check, then sign off.",
          run: async (page) => {
            await hideDevBadge(page);
            await glide(page, page.getByText(/Drift score/));
            await sleep(2500);
            await click(page, byRole(page, "button", "Difference"), 3000);
            await click(page, byRole(page, "button", "Overlay"), 1500);
          },
        },
      ]
    : []),
  ...(PASSCODE
    ? [
        {
          id: "signed-in",
          text: "Signed in, a designer or developer can change a drift's status, and approve a clean build.",
          run: async (page) => {
            await page.goto(`${BASE}/login?next=/board`, { waitUntil: "networkidle" });
            await click(page, page.getByLabel("Your name"), 300);
            await page.keyboard.type(NAME, { delay: 70 });
            await click(page, page.getByLabel("Passcode"), 300);
            await page.keyboard.type(PASSCODE, { delay: 70 }); // shown only as dots
            await click(page, byRole(page, "button", "Sign in"), 1500);
            await page.waitForURL(/\/board$/);
            await click(page, page.getByRole("link", { name: /Sign-off report for \/checkout/ }), 1500);
            await page.waitForURL(/\/report\//);
            await sleep(1500);
            await click(page, page.getByRole("link", { name: /Button radius/ }).first(), 1500);
            await page.waitForURL(/\/drifts\//);
            await page.getByLabel("Change status").selectOption("fixed");
            await click(page, byRole(page, "button", "Update status"), 2000);
            await page.goBack();
            await sleep(1200);
            await page.reload({ waitUntil: "domcontentloaded" });
            await sleep(1500);
            const approve = byRole(page, "button", "Sign off this build");
            if (await approve.count()) await click(page, approve, 2500);
          },
        },
      ]
    : []),
  {
    id: "themes",
    text: "The interface follows light, dark or system themes with the same colour meaning on every screen: blue for design, amber for build, rose for drift, green for resolved. It also works on a phone.",
    run: async (page) => {
      await page.goto(`${BASE}/board`, { waitUntil: "networkidle" });
      await click(page, themeSwitch(page).getByRole("button", { name: "Light" }), 2500);
      await click(page, themeSwitch(page).getByRole("button", { name: "Dark" }), 2000);
      await page.setViewportSize({ width: 375, height: 812 });
      await sleep(2500);
      await scrollBy(page, 500, 14);
      await sleep(1500);
      await page.setViewportSize({ width: 1280, height: 720 });
      await sleep(800);
    },
  },
  {
    id: "closing",
    text: "The capture engine is built and tested; today I run it locally against preview URLs. The board, tickets and reports you saw run on Postgres on Deployxa, with encrypted variables and a health check, and the app itself is deployed on Deployxa.",
    run: async (page) => {
      await page.goto(`${BASE}/api/health`, { waitUntil: "networkidle" });
      await sleep(3000);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await sleep(2500);
    },
  },
];

/* ---------- run ---------- */

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  colorScheme: "dark",
  recordVideo: { dir: tmp, size: { width: 1280, height: 720 } },
});
await context.addInitScript(CURSOR);
const page = await context.newPage();
const t0 = Date.now();

const timeline = [];
let failed = null;
try {
  for (const seg of segments.filter((s) => !ONLY || ONLY.includes(s.id))) {
    const startMs = Date.now() - t0 + SYNC_LAG_MS;
    const voice = AUDIO ? speak(seg.id, seg.text) : { wav: null, ms: 0 };
    const shownUntil = startMs + voice.ms + 600;
    console.log(`▶ ${seg.id} (${(voice.ms / 1000).toFixed(1)}s narration)`);
    await seg.run(page);
    const wait = shownUntil - (Date.now() - t0 + SYNC_LAG_MS);
    if (wait > 0) await sleep(wait);
    timeline.push({ ...seg, ...voice, startMs });
  }
} catch (error) {
  failed = error;
  await page.screenshot({ path: path.join(OUT, "failure.png") }).catch(() => {});
  console.error("   page at failure:", page.url());
  console.error("✖ recording stopped:", error.message.split("\n")[0]);
  console.error(error.stack.split("\n").find((l) => l.includes("record-demo.mjs")) ?? "");
} finally {
  await sleep(500);
  const total = Date.now() - t0 + SYNC_LAG_MS;
  const video = page.video();
  await context.close();
  await browser.close();

  fs.copyFileSync(await video.path(), path.join(OUT, "demo-silent.webm"));
  if (AUDIO && timeline.length) {
    writeTimeline(timeline.map((s) => ({ wav: s.wav, startMs: s.startMs })), total, path.join(OUT, "narration.wav"));
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", path.join(OUT, "narration.wav"), path.join(OUT, "narration.m4a")]);
  }
  const mm = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  fs.writeFileSync(
    path.join(OUT, "transcript.md"),
    [
      "# Drift Detector demo: narration transcript",
      "",
      `Recorded against ${BASE}. Narration is synthetic (macOS voice "${VOICE}"), so read it in your own voice if you prefer.`,
      "",
      ...timeline.map((s) => `**${mm(s.startMs)}** — ${s.text}\n`),
      "## Joining audio and video",
      "```bash",
      "# needs ffmpeg (e.g. `brew install ffmpeg`)",
      "ffmpeg -i demo-silent.webm -i narration.wav -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest drift-detector-demo.mp4",
      "```",
    ].join("\n"),
  );
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nSaved to ${OUT}`);
}
if (failed) process.exit(1);
