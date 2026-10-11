import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Visual QA for preview builds</p>
      <h1 className={styles.title}>
        Catch the gap between <em>design and build</em> before users do.
      </h1>
      <p className={styles.lede}>
        Drift Detector lays the Figma frame over every Deployxa preview build, flags each spacing,
        type and colour mismatch, and turns it into a fix ticket.
      </p>
      <Link href="/inspector" className={styles.cta}>
        Open the overlay inspector
      </Link>
      <ul className={styles.legend} aria-label="Colour code">
        <li data-kind="design">Design</li>
        <li data-kind="build">Build</li>
        <li data-kind="drift">Drift</li>
        <li data-kind="resolved">Resolved</li>
      </ul>
    </section>
  );
}
