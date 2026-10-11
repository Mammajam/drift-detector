import styles from "./Legend.module.css";

export function Legend() {
  return (
    <ul className={styles.legend} aria-label="Colour code">
      <li data-kind="design">Design layer</li>
      <li data-kind="build">Build layer</li>
      <li data-kind="drift">Drift (numbered pin)</li>
    </ul>
  );
}
