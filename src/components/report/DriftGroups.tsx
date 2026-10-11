import Link from "next/link";
import { SpecValue } from "@/components/ui/SpecValue";
import { StatusPill, statusLabel } from "@/components/ui/StatusPill";
import { themeLabel } from "@/lib/format";
import type { DriftStatus } from "@/lib/types";
import type { ReportDrift } from "@/server/db/queries";
import styles from "./DriftGroups.module.css";

const ORDER: DriftStatus[] = ["open", "fixed", "wont-fix"];

/** The newest build's drifts, grouped by what happened to them. */
export function DriftGroups({ drifts }: { drifts: ReportDrift[] }) {
  return (
    <div className={styles.groups}>
      {ORDER.map((status) => {
        const items = drifts.filter((d) => d.status === status);
        const headingId = `group-${status}`;
        return (
          <section key={status} aria-labelledby={headingId} className={styles.group}>
            <h3 id={headingId} className={styles.heading}>
              <span aria-hidden="true">
                <StatusPill status={status} />
              </span>
              <span>
                {statusLabel(status)} <span className={styles.count}>({items.length})</span>
              </span>
            </h3>
            {items.length === 0 ? (
              <p className={styles.none}>None.</p>
            ) : (
              <ul className={styles.list}>
                {items.map((d) => (
                  <li key={d.ticketId} className={styles.item}>
                    <Link href={`/drifts/${d.ticketId}`} className={styles.link}>
                      {d.label}
                    </Link>
                    <span className={styles.where}>
                      {d.breakpoint}px · {themeLabel(d.theme)}
                    </span>
                    <SpecValue expected={d.expected} actual={d.actual} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
