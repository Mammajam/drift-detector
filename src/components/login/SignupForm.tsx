"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { signUp, type FormState } from "@/app/actions";
import buttons from "@/components/ui/buttons.module.css";
import styles from "./LoginForm.module.css";
import { PasswordField } from "./PasswordField";

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});

  // Move focus to the field the error is about, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (state.error) document.getElementById(state.field ?? "email")?.focus();
  }, [state.attempt, state.error, state.field]);
  const nextQuery = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  const errorId = state.error ? "signup-error" : undefined;

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
          aria-invalid={state.field === "name" ? true : undefined}
          aria-describedby={["name-hint", state.field === "name" ? errorId : undefined].filter(Boolean).join(" ")}
        />
        <p id="name-hint" className={styles.hint}>
          Shown as the approver on sign-offs.
        </p>
      </div>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          defaultValue={state.email}
          aria-invalid={state.field === "email" ? true : undefined}
          aria-describedby={state.field === "email" ? errorId : undefined}
        />
      </div>
      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="new-password"
        hint="At least 8 characters."
        invalid={state.field === "password"}
        describedBy={state.field === "password" ? errorId : undefined}
      />
      <PasswordField
        id="confirm"
        name="confirm"
        label="Confirm password"
        autoComplete="new-password"
        invalid={state.field === "confirm"}
        describedBy={state.field === "confirm" ? errorId : undefined}
      />
      <p id="signup-error" role="alert" className={styles.error}>
        {state.error ? `Error: ${state.error}` : ""}
      </p>
      <button
        type="submit"
        className={buttons.primary}
        aria-disabled={pending}
        onClick={(event) => pending && event.preventDefault()}
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className={styles.alt}>
        Already have an account? <Link href={`/login${nextQuery}`}>Sign in</Link>
      </p>
    </form>
  );
}
