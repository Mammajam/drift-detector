import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

type EmptyStateProps = { title: string; children?: ReactNode; action?: ReactNode };

/** Shown where a list or board would be when there is nothing to list yet. */
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <section className={styles.empty}>
      <h2 className={styles.title}>{title}</h2>
      {children ? <div className={styles.body}>{children}</div> : null}
      {action}
    </section>
  );
}
