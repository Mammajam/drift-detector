import type { CaptureTheme } from "@/lib/types";
import styles from "./SampleFrame.module.css";

type SampleFrameProps = {
  variant: "design" | "build";
  theme: CaptureTheme;
  /** A clean capture: the build matches the design exactly. */
  matches?: boolean;
};

/** Stand-in for a Figma frame image or a Playwright screenshot until the capture engine lands (Phase 3). */
export function SampleFrame({ variant, theme, matches = false }: SampleFrameProps) {
  const rendered = matches ? "design" : variant;
  const darkSurfaceDrift = theme === "dark" && rendered === "build";

  return (
    <div
      className={`${styles.frame} ${styles[rendered]}`}
      data-theme-scope={theme}
      data-surface-drift={darkSurfaceDrift}
    >
      <div className={styles.card}>
        <div className={styles.label}>Pro plan</div>
        <div className={styles.price}>
          $24<small> / month</small>
        </div>
        <p className={styles.text}>
          Unlimited projects and drift checks on every preview deploy.
        </p>
        <ul className={styles.list}>
          <li>Figma frame sync</li>
          <li>Auto drift tickets</li>
          <li>Sign-off reports</li>
        </ul>
        <span className={styles.button}>Start free trial</span>
      </div>
    </div>
  );
}
