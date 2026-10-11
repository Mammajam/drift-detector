"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "@/app/actions";
import buttons from "@/components/ui/buttons.module.css";
import styles from "./LoginForm.module.css";

export function LoginForm({ next, needsPasscode }: { next: string; needsPasscode: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={next} />
      <div className={styles.field}>
        <label htmlFor="name">Your name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={60}
          autoComplete="name"
          defaultValue={state.name}
          aria-invalid={state.error?.startsWith("Enter your name") ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
        <p id="name-hint" className={styles.hint}>
          Shown as the approver on sign-offs.
        </p>
      </div>
      {needsPasscode ? (
        <div className={styles.field}>
          <label htmlFor="passcode">Passcode</label>
          <input
            id="passcode"
            name="passcode"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={state.error?.includes("passcode") ? true : undefined}
            aria-describedby={state.error ? "login-error" : undefined}
          />
        </div>
      ) : null}
      <button type="submit" className={buttons.primary} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p key={state.attempt} id="login-error" role="alert" className={styles.error}>
        {state.error ?? ""}
      </p>
    </form>
  );
}
