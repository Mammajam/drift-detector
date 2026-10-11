import { CaptureFrame } from "@/components/inspector/CaptureFrame";
import type { Capture, Drift } from "@/lib/types";
import styles from "./EvidenceCrop.module.css";

const PAD = 24; // frame px of context around the drifting region
const TARGET_WIDTH = 280; // display px
const MAX_SCALE = 4;

type EvidenceCropProps = {
  capture: Capture;
  drift: Drift;
  variant: "design" | "build";
  label: string;
};

/** The drift's region cut out of the design frame or the build screenshot, outlined. */
export function EvidenceCrop({ capture, drift, variant, label }: EvidenceCropProps) {
  const { width: W, height: H } = capture.frame;
  const left = Math.max(0, drift.bbox.x * W - PAD);
  const top = Math.max(0, drift.bbox.y * H - PAD);
  const right = Math.min(W, (drift.bbox.x + drift.bbox.w) * W + PAD);
  const bottom = Math.min(H, (drift.bbox.y + drift.bbox.h) * H + PAD);
  const regionW = right - left;
  const regionH = bottom - top;
  const scale = Math.min(MAX_SCALE, TARGET_WIDTH / regionW);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption} data-kind={variant}>
        {label}
      </figcaption>
      <div
        className={styles.crop}
        style={{ width: regionW * scale, height: regionH * scale }}
        role="img"
        aria-label={`${label}: the area around ${drift.label}`}
      >
        <div
          className={styles.inner}
          aria-hidden="true"
          style={{ width: W, height: H, left: -left * scale, top: -top * scale, transform: `scale(${scale})` }}
        >
          <CaptureFrame capture={{ ...capture, drifts: [drift] }} variant={variant} />
        </div>
        <span
          className={styles.outline}
          aria-hidden="true"
          style={{
            left: (drift.bbox.x * W - left) * scale,
            top: (drift.bbox.y * H - top) * scale,
            width: drift.bbox.w * W * scale,
            height: drift.bbox.h * H * scale,
          }}
        />
      </div>
    </figure>
  );
}
