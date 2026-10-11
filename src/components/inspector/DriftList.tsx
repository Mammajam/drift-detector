"use client";

import { useRef, type KeyboardEvent } from "react";
import type { Drift } from "@/lib/types";
import Link from "next/link";
import { SpecValue } from "@/components/ui/SpecValue";
import styles from "./DriftList.module.css";

type DriftListProps = {
  drifts: Drift[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** The text twin of the pins: same numbers, same selection, fully keyboard and screen-reader operable. */
export function DriftList({ drifts, selectedId, onSelect }: DriftListProps) {
  const listRef = useRef<HTMLOListElement>(null);

  if (drifts.length === 0) {
    return (
      <p className={styles.empty}>
        <span className={styles.check} aria-hidden="true">
          ✓
        </span>
        No drift found. This build matches the design.
      </p>
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLOListElement>) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const target =
      event.key === "ArrowDown"
        ? current + 1
        : event.key === "ArrowUp"
          ? current - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : null;
    if (target === null || current === -1) return;
    event.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, target))]?.focus();
  }

  return (
    <ol ref={listRef} className={styles.list} aria-label="Drifts" onKeyDown={onKeyDown}>
      {drifts.map((drift, index) => (
        <li key={drift.id}>
          <button
            type="button"
            className={styles.item}
            aria-pressed={drift.id === selectedId}
            onClick={() => onSelect(drift.id)}
          >
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.label}>
              {drift.label}
              {drift.token ? <span className={styles.token}>{drift.token}</span> : null}
            </span>
            <SpecValue expected={drift.expected} actual={drift.actual} />
          </button>
          {drift.ticketId ? (
            <Link href={`/drifts/${drift.ticketId}`} className={styles.ticket}>
              Open ticket<span className="sr-only"> for drift {index + 1}</span>
            </Link>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
