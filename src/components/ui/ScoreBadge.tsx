import styles from "./ScoreBadge.module.css";

type Level = "clean" | "minor" | "major";

const level = (score: number): Level => (score === 0 ? "clean" : score < 25 ? "minor" : "major");

const META: Record<Level, { icon: string; label: string }> = {
  clean: { icon: "✓", label: "Clean" },
  minor: { icon: "▲", label: "Minor drift" },
  major: { icon: "◆", label: "Major drift" },
};

/** Shape + word + number, so the level never depends on colour. */
export function ScoreBadge({ score }: { score: number }) {
  const l = level(score);
  const { icon, label } = META[l];
  return (
    <span className={styles.badge} data-level={l}>
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <span className={styles.score}>
        <span className="sr-only">score </span>
        {score}
      </span>
    </span>
  );
}
