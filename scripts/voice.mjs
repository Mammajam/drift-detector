// Replaces the synthetic narration in the demo video with your own voice.
//
//   node scripts/voice.mjs script          # writes demo-recording/voice-script.md (read-aloud text with time slots)
//   node scripts/voice.mjs record [n]      # prompter: records each segment from the mic (all, or just segment n)
//   node scripts/voice.mjs mix             # places your takes on the video timeline -> drift-detector-demo-voice.mp4
//
// Takes live in demo-recording/voice/NN-id.wav. You can also drop in your own files (wav, m4a, mp3) named the same way.
// Timing comes from demo-recording/segments.json (written by record-demo.mjs). Needs ffmpeg; recording is macOS (avfoundation).
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

const DIR = path.resolve(process.env.OUT_DIR ?? "demo-recording");
const VOICE_DIR = path.join(DIR, "voice");
const MIC = process.env.MIC ?? ":0"; // avfoundation audio input; `ffmpeg -f avfoundation -list_devices true -i ""` lists them
const MAX_SPEEDUP = 1.15; // a take longer than its slot is sped up by at most this much (pitch is kept)
const LEAD_MS = 250; // the narration starts this long after the segment's first frame

const segments = JSON.parse(fs.readFileSync(path.join(DIR, "segments.json"), "utf8"));
const videoFile = path.join(DIR, "demo-silent.webm");
const nn = (i) => String(i + 1).padStart(2, "0");
const takeBase = (i) => path.join(VOICE_DIR, `${nn(i)}-${segments[i].id}`);
// Takes are matched by number (NN-anything.ext), so renaming a segment's id never orphans a take.
const findTake = (i) => {
  const file = fs.readdirSync(VOICE_DIR).find((f) => f.startsWith(`${nn(i)}-`) && /\.(wav|m4a|mp3|aiff|flac)$/.test(f));
  return file ? path.join(VOICE_DIR, file) : undefined;
};
const seconds = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
const videoSeconds = () => seconds(videoFile);
/** Seconds available for a segment before the next one starts. */
const slot = (i) => ((segments[i + 1]?.startMs ?? videoSeconds() * 1000) - segments[i].startMs) / 1000;
const words = (t) => t.trim().split(/\s+/).length;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function script() {
  const lines = [
    "# Read-aloud script",
    "",
    "Read each block at a relaxed pace. Each has a time slot: the video shows that part for that long, so stay inside it (about 2.7 words per second is comfortable).",
    "Leave half a second of silence before and after each block; the mixer trims it.",
    "",
  ];
  segments.forEach((s, i) => {
    const sl = slot(i);
    lines.push(`## ${nn(i)} · ${s.id} · starts ${mmss(s.startMs / 1000)} · slot ${sl.toFixed(1)}s · ${words(s.text)} words (~${(words(s.text) / 2.7).toFixed(0)}s)`, "", s.text, "");
  });
  fs.writeFileSync(path.join(DIR, "voice-script.md"), lines.join("\n"));
  console.log(`Wrote ${path.join(DIR, "voice-script.md")}`);
}

async function record(only) {
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const todo = segments.map((_, i) => i).filter((i) => only == null || i === only - 1);
  console.log("Each segment: read the text shown, press Enter to start, Enter again to stop. Quiet room, same mic distance throughout.\n");
  for (const i of todo) {
    const s = segments[i];
    const out = `${takeBase(i)}.wav`;
    for (;;) {
      console.log(`\n── ${nn(i)}/${nn(segments.length - 1)} · ${s.id} · slot ${slot(i).toFixed(1)}s ──\n\n${s.text}\n`);
      await rl.question("Enter to start recording… ");
      const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "avfoundation", "-i", MIC, "-ac", "1", "-ar", "44100", out], { stdio: ["pipe", "inherit", "inherit"] });
      await new Promise((r) => setTimeout(r, 400));
      await rl.question("● Recording. Enter to stop… ");
      ff.stdin.write("q");
      await new Promise((r) => ff.on("close", r));
      const d = seconds(out);
      const note = d > slot(i) ? `  ⚠ ${(d - slot(i)).toFixed(1)}s over the slot (the mixer will speed it up slightly)` : "";
      console.log(`Recorded ${d.toFixed(1)}s of ${slot(i).toFixed(1)}s.${note}`);
      try { execFileSync("afplay", [out]); } catch { /* playback is a convenience */ }
      const a = (await rl.question("Keep (Enter) or redo (r)? ")).trim().toLowerCase();
      if (a !== "r") break;
    }
  }
  rl.close();
  console.log("\nDone. Next: node scripts/voice.mjs mix");
}

function mix() {
  const total = videoSeconds();
  const inputs = [];
  const filters = [];
  const labels = [];
  const missing = [];
  segments.forEach((s, i) => {
    const take = findTake(i);
    if (!take) return missing.push(`${nn(i)}-${s.id}`);
    const raw = seconds(take);
    // Trim leading silence (and trailing, via a reverse pass) so only speech is placed on the timeline.
    const trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse";
    const room = slot(i) - LEAD_MS / 1000;
    const speech = Math.max(0.5, raw - 1); // the trim removes roughly a second of padding; the estimate is only for warnings
    const tempo = Math.min(MAX_SPEEDUP, Math.max(1, speech / room));
    if (speech / room > MAX_SPEEDUP) console.warn(`⚠ ${nn(i)}-${s.id}: about ${(speech - room).toFixed(1)}s too long for its slot even at ${MAX_SPEEDUP}×. Shorten the read or re-take it.`);
    const k = labels.length;
    inputs.push("-i", take);
    const tempoF = tempo > 1.001 ? `,atempo=${tempo.toFixed(3)}` : "";
    filters.push(`[${k}:a]aformat=sample_rates=44100:channel_layouts=mono,${trim}${tempoF},adelay=${s.startMs + LEAD_MS}|${s.startMs + LEAD_MS}[v${k}]`);
    labels.push(`[v${k}]`);
  });
  if (!labels.length) throw new Error(`No takes found in ${VOICE_DIR}. Record some first.`);
  if (missing.length) console.warn(`⚠ No take for: ${missing.join(", ")} (those parts stay silent)`);

  const narration = path.join(DIR, "narration-voice.m4a");
  const out = path.join(DIR, "drift-detector-demo-voice.mp4");
  const graph = `${filters.join(";")};${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=9,apad=whole_dur=${total.toFixed(2)}[a]`;
  execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", graph, "-map", "[a]", "-t", total.toFixed(2), "-c:a", "aac", "-b:a", "160k", narration], { stdio: "inherit" });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", videoFile, "-i", narration, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", out], { stdio: "inherit" });
  console.log(`Wrote ${narration}\nWrote ${out}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "script") script();
else if (cmd === "record") await record(arg ? Number(arg) : null);
else if (cmd === "mix") mix();
else console.log("Usage: node scripts/voice.mjs script | record [segment number] | mix");
