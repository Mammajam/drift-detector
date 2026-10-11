import type { ReactNode } from "react";
import styles from "./StatePanel.module.css";

type StatePanelProps = {
  kind: "loading" | "error";
  title?: string;
  message?: string;
  action?: ReactNode;
};

/** Full-area loading and error states (empty states live next to the data they replace). */
export function StatePanel({ kind, title, message, action }: StatePanelProps) {
  if (kind === "loading") {
    return (
      <div className={styles.panel} role="status">
        <div className={styles.skeleton} aria-hidden="true" />
        <div className={styles.row} aria-hidden="true">
          <span className={styles.bar} />
          <span className={styles.bar} />
          <span className={styles.bar} />
        </div>
        <h1 className={styles.message}>{title ?? "Loading…"}</h1>
      </div>
    );
  }

  return (
    <div className={styles.panel} role="alert">
      <h1 className={styles.title}>
        <span className={styles.icon} aria-hidden="true">
          !
        </span>
        {title ?? "Something went wrong"}
      </h1>
      {message ? <p className={styles.message}>{message}</p> : null}
      {action}
    </div>
  );
}
