import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import styles from "./AppShell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <AppHeader />
      <main id="main" className={styles.main}>
        {children}
      </main>
    </>
  );
}
