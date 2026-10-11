import styles from "./SpecValue.module.css";

/** Spec values always read `expected → actual`, in mono, with text for screen readers. */
export function SpecValue({
  expected,
  actual,
  size = "sm",
}: {
  expected: string;
  actual: string;
  size?: "sm" | "lg";
}) {
  return (
    <span className={styles.spec} data-size={size}>
      <span className={styles.expected}>
        <span className="sr-only">Expected </span>
        {expected}
      </span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
      <span className={styles.actual}>
        <span className="sr-only">actual </span>
        {actual}
      </span>
    </span>
  );
}
