import Link from "next/link";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { NavLinks } from "./NavLinks";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          Drift Detector
        </Link>
        <NavLinks />
        <ThemeSwitch />
      </div>
    </header>
  );
}
