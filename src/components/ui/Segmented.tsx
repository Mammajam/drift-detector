"use client";

import styles from "./Segmented.module.css";

type Option<T extends string | number> = { value: T; label: string };

type SegmentedProps<T extends string | number> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Native-button segmented control; the pressed state is exposed with aria-pressed. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.button}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
