import type { DriftStatus } from "@/lib/types";
import styles from "./StatusPill.module.css";

const META: Record<DriftStatus, { icon: string; label: string }> = {
  open: { icon: "●", label: "Open" },
  fixed: { icon: "✓", label: "Fixed" },
  "wont-fix": { icon: "–", label: "Won't fix" },
};

export const statusLabel = (status: DriftStatus) => META[status].label;

export function StatusPill({ status }: { status: DriftStatus }) {
  const { icon, label } = META[status];
  return (
    <span className={styles.pill} data-status={status}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
