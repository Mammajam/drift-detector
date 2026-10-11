"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getSampleCapture } from "@/lib/sample/pricing";
import type { Breakpoint, Capture, CaptureTheme } from "@/lib/types";
import { DriftList } from "./DriftList";
import { Legend } from "./Legend";
import { OpacitySlider } from "./OpacitySlider";
import { Stage, type CompareMode } from "./Stage";
import styles from "./Inspector.module.css";

const MODES: { value: CompareMode; label: string }[] = [
  { value: "overlay", label: "Overlay" },
  { value: "difference", label: "Difference" },
  { value: "side", label: "Side-by-side" },
];

const BREAKPOINTS: { value: Breakpoint; label: string }[] = [
  { value: 375, label: "375" },
  { value: 768, label: "768" },
  { value: 1440, label: "1440" },
];

const CAPTURE_THEMES: { value: CaptureTheme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type InspectorProps = {
  /** "clean" shows the empty state: a build with no drift. Ignored when `captures` is given. */
  scenario?: "drift" | "clean";
  /** Real captures from the capture pipeline; sample data is used when omitted. */
  captures?: Capture[];
};

const BREAKPOINT_ORDER: Breakpoint[] = [375, 768, 1440];

export function Inspector({ scenario = "drift", captures }: InspectorProps) {
  const { resolved } = useTheme();
  const [mode, setMode] = useState<CompareMode>("overlay");
  const [opacity, setOpacity] = useState(55);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(captures?.[0]?.breakpoint ?? 375);
  const [captureTheme, setCaptureTheme] = useState<CaptureTheme | null>(null);
  const [showPins, setShowPins] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The capture theme follows the app theme until the user picks one.
  const availableBreakpoints = captures
    ? BREAKPOINT_ORDER.filter((bp) => captures.some((c) => c.breakpoint === bp))
    : BREAKPOINT_ORDER;
  const availableThemes = captures
    ? CAPTURE_THEMES.filter((t) => captures.some((c) => c.theme === t.value))
    : CAPTURE_THEMES;
  const wanted = captureTheme ?? resolved;
  const theme = availableThemes.some((t) => t.value === wanted) ? wanted : availableThemes[0].value;

  const capture = useMemo(
    () =>
      captures
        ? (captures.find((c) => c.breakpoint === breakpoint && c.theme === theme) ?? captures[0])
        : getSampleCapture(breakpoint, theme, { clean: scenario === "clean" }),
    [captures, breakpoint, theme, scenario],
  );

  const selectedIndex = capture.drifts.findIndex((d) => d.id === selectedId);
  const selected = selectedIndex === -1 ? null : capture.drifts[selectedIndex];

  function toggle(id: string) {
    setSelectedId((current) => (current === id ? null : id));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && selectedId) setSelectedId(null);
  }

  return (
    <div className={styles.root} onKeyDown={onKeyDown}>
      <header className={styles.head}>
        <h1 className={styles.title}>Overlay inspector</h1>
        <p className={styles.meta}>
          <span>{capture.route}</span>
          <span>{captures ? new URL(capture.previewUrl).host : "PR 42 preview"}</span>
          {capture.commitSha ? <span>{capture.commitSha}</span> : null}
          {capture.score !== undefined ? <span>Drift score {capture.score}/100</span> : null}
        </p>
      </header>

      <div className={styles.controls}>
        <Segmented label="Compare mode" options={MODES} value={mode} onChange={setMode} />
        <Segmented
          label="Breakpoint (px)"
          options={BREAKPOINTS.filter((o) => availableBreakpoints.includes(o.value))}
          value={breakpoint}
          onChange={setBreakpoint}
        />
        <Segmented
          label="Capture theme"
          options={availableThemes}
          value={theme}
          onChange={setCaptureTheme}
        />
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showPins}
            onChange={(event) => setShowPins(event.target.checked)}
          />
          Show drift pins
        </label>
      </div>

      <div className={styles.workspace}>
        <div className={styles.main}>
          <Stage
            capture={capture}
            mode={mode}
            opacity={opacity}
            showPins={showPins}
            selectedId={selectedId}
            onSelect={toggle}
          />
          <OpacitySlider value={opacity} onChange={setOpacity} disabled={mode !== "overlay"} />
          <Legend />
        </div>

        <section className={styles.side} aria-labelledby="drift-heading">
          <h2 id="drift-heading" className={styles.sideTitle}>
            Drift <span className={styles.count}>{capture.drifts.length}</span>
          </h2>
          <DriftList drifts={capture.drifts} selectedId={selectedId} onSelect={toggle} />
        </section>
      </div>

      <p className="sr-only" role="status">
        {selected
          ? `Drift ${selectedIndex + 1} selected: ${selected.label}, expected ${selected.expected}, actual ${selected.actual}.`
          : ""}
      </p>
    </div>
  );
}
