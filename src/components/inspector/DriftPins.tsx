import type { Drift } from "@/lib/types";
import styles from "./DriftPins.module.css";

type DriftPinsProps = {
  drifts: Drift[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Numbered teardrop pins plus a dashed outline around the selected drift's region. */
export function DriftPins({ drifts, selectedId, onSelect }: DriftPinsProps) {
  const selected = drifts.find((d) => d.id === selectedId);

  return (
    <div className={styles.layer}>
      {selected ? (
        <span
          className={styles.outline}
          aria-hidden="true"
          style={{
            left: `${selected.bbox.x * 100}%`,
            top: `${selected.bbox.y * 100}%`,
            width: `${selected.bbox.w * 100}%`,
            height: `${selected.bbox.h * 100}%`,
          }}
        />
      ) : null}
      {drifts.map((drift, index) => (
        <button
          key={drift.id}
          type="button"
          className={styles.pin}
          aria-pressed={drift.id === selectedId}
          aria-label={`Drift ${index + 1}: ${drift.label}, expected ${drift.expected}, actual ${drift.actual}`}
          style={{
            left: `${(drift.bbox.x + drift.bbox.w / 2) * 100}%`,
            top: `${(drift.bbox.y + drift.bbox.h / 2) * 100}%`,
          }}
          onClick={() => onSelect(drift.id)}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}
