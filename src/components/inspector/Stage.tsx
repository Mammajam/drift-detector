import type { Capture } from "@/lib/types";
import { DriftPins } from "./DriftPins";
import { CaptureFrame } from "./CaptureFrame";
import { ScaledFrame } from "./ScaledFrame";
import styles from "./Stage.module.css";

export type CompareMode = "overlay" | "difference" | "side";

type StageProps = {
  capture: Capture;
  mode: CompareMode;
  /** Build-layer opacity, 0–100 (Overlay mode only). */
  opacity: number;
  showPins: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function Stage({ capture, mode, opacity, showPins, selectedId, onSelect }: StageProps) {
  const { frame, drifts } = capture;
  const matches = drifts.length === 0;
  const modeLabel = { overlay: "Overlay", difference: "Difference", side: "Side-by-side" }[mode];
  const groupLabel = `Figma design compared with live build, ${modeLabel} mode, ${drifts.length} drifts`;
  const pins = showPins ? (
    <DriftPins drifts={drifts} selectedId={selectedId} onSelect={onSelect} />
  ) : null;

  if (mode === "side") {
    return (
      <div className={styles.stage} role="group" aria-label={groupLabel}>
        <div className={styles.side}>
          <figure className={styles.pane}>
            <figcaption className={styles.caption} data-kind="design">
              Figma design
            </figcaption>
            <ScaledFrame width={frame.width} height={frame.height}>
              <CaptureFrame capture={capture} variant="design" matches={matches} />
            </ScaledFrame>
          </figure>
          <figure className={styles.pane}>
            <figcaption className={styles.caption} data-kind="build">
              Live build
            </figcaption>
            <ScaledFrame width={frame.width} height={frame.height} overlay={pins}>
              <CaptureFrame capture={capture} variant="build" matches={matches} />
            </ScaledFrame>
          </figure>
        </div>
      </div>
    );
  }

  const difference = mode === "difference";

  return (
    <div className={styles.stage} role="group" aria-label={groupLabel}>
      <ScaledFrame width={frame.width} height={frame.height} overlay={pins}>
        <div className={styles.layers}>
          <div className={styles.layer}>
            <CaptureFrame capture={capture} variant="design" matches={matches} />
          </div>
          <div
            className={styles.layer}
            style={{
              opacity: difference ? 1 : opacity / 100,
              mixBlendMode: difference ? "difference" : "normal",
            }}
          >
            <CaptureFrame capture={capture} variant="build" matches={matches} />
          </div>
        </div>
      </ScaledFrame>
    </div>
  );
}
