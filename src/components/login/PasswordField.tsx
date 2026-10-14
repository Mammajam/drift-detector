"use client";

import { useState } from "react";
import styles from "./LoginForm.module.css";

type Props = {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
  hint?: string;
};

/** Password input with a native-button "Show password" toggle (not colour- or icon-only). */
export function PasswordField({ id, name, label, autoComplete, invalid, describedBy, hint }: Props) {
  const [shown, setShown] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.password}>
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          required
          autoComplete={autoComplete}
          maxLength={200}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={[hintId, describedBy].filter(Boolean).join(" ") || undefined}
        />
        <button type="button" className={styles.toggle} onClick={() => setShown((v) => !v)}>
          {shown ? "Hide" : "Show"}
          <span className="sr-only"> {label.toLowerCase()}</span>
        </button>
      </div>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
