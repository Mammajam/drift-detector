// Records a narrated walkthrough of Drift Detector with Playwright (browser only, no desktop capture).
//
//   node scripts/record-demo.mjs                       # read-only tour of the live site
//   DEMO_EMAIL=… DEMO_PASSWORD=… node scripts/record-demo.mjs   # adds a signed-in segment (changes statuses, signs off a build!)
//
// Env: BASE_URL, OUT_DIR (default demo-recording), VOICE (default Daniel), RATE (words/min, default 170),
//      NO_AUDIO=1 (video only). The signed-in segment logs in with an existing account (e.g. the seeded SEED_DEMO_USER_* one);
//      its name is the approver shown on the sign-off.
// Output: demo-silent.webm, narration.wav/.m4a (timed to the video), transcript.md.
// The narration is macOS text-to-speech; joining audio and video needs ffmpeg (see transcript.md).
import { chromium } from "playwright";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL ?? "https://drift-detector-app.deployxa.online").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT_DIR ?? "demo-recording");
const VOICE = process.env.VOICE ?? "Daniel";
const RATE = process.env.RATE ?? "170";
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD; // never printed or logged
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

const LEAD_MS = 250; // the narration starts this long after its segment's first frame (voice.mjs places takes the same way)
const VOICE_DIR = path.join(OUT, "voice");
const USE_OWN_VOICE = process.env.OWN_VOICE !== "0" && fs.existsSync(VOICE_DIR) && fs.readdirSync(VOICE_DIR).some((f) => /^\d\d-.*\.(wav|m4a|mp3)$/.test(f));
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse";

/** Your own take for segment `index` (files are named NN-anything.wav), trimmed to the speech. */
function ownTake(index) {
  const prefix = String(index + 1).padStart(2, "0") + "-";
  const file = fs.readdirSync(VOICE_DIR).find((f) => f.startsWith(prefix) && /\.(wav|m4a|mp3)$/.test(f));
  if (!file) throw new Error(`No take for segment ${index + 1} in ${VOICE_DIR}`);
  const wav = path.join(tmp, `own-${prefix}.wav`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(VOICE_DIR, file), "-ac", "1", "-ar", "22050", "-af", TRIM, wav]);
  return wav;
}

/** Length of a wav, and the moments inside it where speech resumes after a pause (sentence and clause boundaries). */
function analyse(wav) {
  const { fmt, data } = readWav(wav);
  const ms = Math.round((data.length / (fmt.rate * fmt.ch * (fmt.bits / 8))) * 1000);
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", wav, "-af", "silencedetect=noise=-42dB:d=0.2", "-f", "null", "-"], { encoding: "utf8" });
  const resumes = [...probe.stderr.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Math.round(Number(m[1]) * 1000));
  return { wav, ms, resumes };
}

/**
 * Returns cue(target): waits until that part of the narration is being spoken. `target` is a sentence number (0 = first)
 * or a phrase from the text. The moment is estimated from the text's share of the speech, then snapped to the nearest pause.
 */
function makeCue(seg, voice, startMs, clock) {
  const sentences = seg.text.split(/(?<=[.!?])\s+/);
  return async (target) => {
    if (!voice?.ms) return;
    const at =
      typeof target === "number"
        ? sentences.slice(0, target).join(" ").length + (target > 0 ? 1 : 0)
        : seg.text.indexOf(target);
    if (at < 0) throw new Error(`cue phrase not in narration: ${target}`);
    let t = (at / seg.text.length) * voice.ms;
    const near = voice.resumes?.reduce((best, r) => (Math.abs(r - t) < Math.abs(best - t) ? r : best), Infinity);
    if (near !== undefined && Math.abs(near - t) <= (typeof target === "number" ? 700 : 500)) t = near;
    const wait = startMs + LEAD_MS + t - clock();
    if (wait > 0) await sleep(wait);
    else if (wait < -700) console.log(`   ⚠ cue "${String(target).slice(0, 28)}" is ${(-wait / 1000).toFixed(1)}s late (the previous actions ran long)`);
  };
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
    run: async (page, cue) => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await cue(1);
      await glide(page, byRole(page, "link", "Open the overlay inspector"));
      await cue(2);
      await glide(page, byRole(page, "link", "View the project board"));
    },
  },
  {
    id: "board",
    text: "The project board lists every route against its preview builds. Each build shows a drift score as a shape, a word and a number, so it never relies on colour alone, plus how many drifts are open and who signed it off. The builds here are sample data, seeded for this demo.",
    run: async (page, cue) => {
      await click(page, byRole(page, "link", "View the project board"), 1500);
      await page.waitForURL(/\/board$/);
      await cue(1);
      await scrollBy(page, 360, 14);
      await cue("plus how many drifts");
      await scrollBy(page, 360, 14);
      await cue(2);
    },
  },
  {
    id: "inspector",
    text: "Opening a build in the inspector. The overlay blends the Figma frame with the live build, and a slider moves between them. Difference mode highlights only what changed. Side by side shows both. Numbered pins mark each drift, and every pin has a twin in this list.",
    run: async (page, cue) => {
      await click(page, page.getByRole("link", { name: /Inspect .* of \/pricing/ }).first(), 1500);
      await page.waitForURL(/\/inspector/);
      await page.getByRole("slider").waitFor();
      await cue(1);
      const slider = page.getByRole("slider");
      await glide(page, slider);
      await slider.focus();
      await press(page, "Home", 1, 300);
      for (let i = 0; i < 30; i++) await press(page, "ArrowRight", 1, 15);
      await press(page, "ArrowLeft", 18, 15);
      await cue(2);
      await click(page, byRole(page, "button", "Difference"), 300);
      await cue(3);
      await click(page, byRole(page, "button", "Side-by-side"), 300);
      await cue(4);
      await click(page, byRole(page, "button", "Overlay"), 900);
      await click(page, page.getByRole("button", { name: /^Drift 1:/ }), 1500);
    },
  },
  {
    id: "keyboard",
    text: "Everything works from the keyboard. Arrow keys move through the drifts, Enter selects one, and the pin and the list stay in sync. Each capture also comes in light and dark, so a dark mode only bug becomes its own ticket.",
    run: async (page, cue) => {
      const items = page.getByRole("list", { name: "Drifts" }).getByRole("button");
      await items.first().focus();
      await cue("Arrow keys");
      await press(page, "ArrowDown", 1, 900);
      await press(page, "Enter", 1, 1200);
      await press(page, "ArrowDown", 1, 900);
      await press(page, "Enter", 1, 800);
      await cue(2);
      await click(page, page.getByRole("group", { name: "Capture theme" }).getByRole("button", { name: "Dark" }), 2200);
      await click(page, page.getByRole("group", { name: "Capture theme" }).getByRole("button", { name: "Light" }), 1200);
      await click(page, page.getByRole("button", { name: /^Drift 1:/ }), 1000);
    },
  },
  {
    id: "ticket",
    text: "Each drift becomes a ticket with the exact expected and actual values in monospace, the design token, the region in pixels, the pull request, and cropped evidence from the design and from the build.",
    run: async (page, cue) => {
      await click(page, page.getByRole("link", { name: /Open ticket for drift 1/ }).first(), 1500);
      await page.waitForURL(/\/drifts\//);
      await cue("the design token");
      await scrollBy(page, 420, 16);
      await cue("cropped evidence");
    },
  },
  {
    id: "report",
    text: "The sign off report groups drifts as open, fixed or won't fix. A build can only be approved once nothing is open, and approval records who signed it off. If production goes wrong, the report links to Deployxa's rollback.",
    run: async (page, cue) => {
      // The breadcrumb sits under the sticky header once the ticket is scrolled, so return to the top first.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await sleep(800);
      await click(page, page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link").nth(1), 1000);
      await page.waitForURL(/\/report\//);
      await cue("A build can only");
      await glide(page, page.getByRole("heading", { name: "Approval" }));
      await cue(2);
      await glide(page, page.getByRole("link", { name: /Roll back on Deployxa/ }));
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
          },
        },
        {
          id: "capture-result",
          text: "And there is the drift. The score jumps, and the hero block is flagged as pins, each with its size and position. Difference mode shows exactly what moved, and the same build is flagged at three seventy five pixels too.",
          run: async (page, cue) => {
            await hideDevBadge(page);
            await glide(page, page.getByText(/Drift score/));
            await cue("The score jumps");
            await click(page, page.getByRole("button", { name: /^Drift 1:/ }), 300);
            await cue("Difference mode");
            await click(page, byRole(page, "button", "Difference"), 300);
            await cue("and the same build");
            await click(page, byRole(page, "button", "Overlay"), 300);
            await cue("three seventy five");
            await click(page, page.getByRole("group", { name: "Breakpoint (px)" }).getByRole("button", { name: "375" }), 3000);
            await click(page, page.getByRole("group", { name: "Breakpoint (px)" }).getByRole("button", { name: "1440" }), 800);
          },
        },
        {
          id: "recheck-start",
          text: "After the fix, the same check runs again on the main branch.",
          run: async (page) => {
            await page.goto(captureUrl(FIXED_BUILD, "1440"), { waitUntil: "domcontentloaded" });
            await page.getByRole("slider").waitFor({ timeout: 120000 });
            await hideDevBadge(page);
          },
        },
        {
          id: "recheck-result",
          text: "The score drops to near zero at desktop width, and only small typographic details remain. That is the loop: flag, fix, re-check, then sign off.",
          run: async (page, cue) => {
            await hideDevBadge(page);
            await glide(page, page.getByText(/Drift score/));
            await cue("and only small");
            await click(page, byRole(page, "button", "Difference"), 300);
            await cue(1);
            await click(page, byRole(page, "button", "Overlay"), 800);
          },
        },
      ]
    : []),
  ...(EMAIL && PASSWORD
    ? [
        {
          id: "signed-in",
          text: "Signed in, a designer or developer can change a drift's status, and approve a clean build.",
          run: async (page) => {
            await page.goto(`${BASE}/login?next=/board`, { waitUntil: "networkidle" });
            await click(page, page.getByLabel("Email"), 300);
            await page.keyboard.type(EMAIL, { delay: 70 });
            await click(page, page.getByLabel("Password", { exact: true }), 300);
            await page.keyboard.type(PASSWORD, { delay: 70 }); // shown only as dots
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
    run: async (page, cue) => {
      await page.goto(`${BASE}/board`, { waitUntil: "networkidle" });
      await cue("light, dark or system");
      await click(page, themeSwitch(page).getByRole("button", { name: "Light" }), 300);
      await cue("blue for design");
      await click(page, themeSwitch(page).getByRole("button", { name: "Dark" }), 300);
      await cue(1);
      await page.setViewportSize({ width: 375, height: 812 });
      await sleep(1800);
      await scrollBy(page, 500, 14);
      await sleep(1200);
      await page.setViewportSize({ width: 1280, height: 720 });
    },
  },
  {
    id: "closing",
    text: "The capture engine is built and tested; today I run it locally against preview URLs. The board, tickets and reports you saw run on Postgres on Deployxa, with encrypted variables and a health check, and the app itself is deployed on Deployxa.",
    run: async (page, cue) => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await cue("The board, tickets");
      await page.goto(`${BASE}/api/health`, { waitUntil: "networkidle" });
      await cue("and the app itself");
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
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
  const plan = segments.filter((s) => !ONLY || ONLY.includes(s.id));
  for (const seg of plan) {
    const clock = () => Date.now() - t0 + SYNC_LAG_MS;
    const startMs = clock();
    const voice = AUDIO ? analyse(USE_OWN_VOICE ? ownTake(segments.indexOf(seg)) : speak(seg.id, seg.text).wav) : { wav: null, ms: 0, resumes: [] };
    const shownUntil = startMs + LEAD_MS + voice.ms + 600;
    console.log(`▶ ${seg.id} (${(voice.ms / 1000).toFixed(1)}s ${USE_OWN_VOICE ? "your voice" : "narration"})`);
    await seg.run(page, makeCue(seg, voice, startMs, clock));
    const wait = shownUntil - clock();
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
  if (AUDIO && !USE_OWN_VOICE && timeline.length) {
    writeTimeline(timeline.map((s) => ({ wav: s.wav, startMs: s.startMs })), total, path.join(OUT, "narration.wav"));
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", path.join(OUT, "narration.wav"), path.join(OUT, "narration.m4a")]);
  }
  fs.writeFileSync(path.join(OUT, "segments.json"), JSON.stringify(timeline.map(({ id, startMs, text }) => ({ id, startMs, text })), null, 2) + "\n");
  const mm = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  fs.writeFileSync(
    path.join(OUT, "transcript.md"),
    [
      "# Drift Detector demo: narration transcript",
      "",
      USE_OWN_VOICE
        ? `Recorded against ${BASE}. The narration is recorded voice; join it to the video with \`node scripts/voice.mjs mix\`.`
        : `Recorded against ${BASE}. Narration is synthetic (macOS voice "${VOICE}"), so read it in your own voice if you prefer.`,
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
