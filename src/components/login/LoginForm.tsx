"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { signIn, type FormState } from "@/app/actions";
import buttons from "@/components/ui/buttons.module.css";
import styles from "./LoginForm.module.css";
import { PasswordField } from "./PasswordField";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});

  // Move focus to the field the error is about, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (state.error) document.getElementById(state.field ?? "email")?.focus();
  }, [state.attempt, state.error, state.field]);
  const nextQuery = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={next} />
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
          aria-invalid={state.field === "password" ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="current-password"
        invalid={state.field === "password"}
        describedBy={state.error ? "login-error" : undefined}
      />
      <p id="login-error" role="alert" className={styles.error}>
        {state.error ? `Error: ${state.error}` : ""}
      </p>
      <button
        type="submit"
        className={buttons.primary}
        aria-disabled={pending}
        onClick={(event) => pending && event.preventDefault()}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className={styles.alt}>
        New here? <Link href={`/signup${nextQuery}`}>Create an account</Link>
      </p>
    </form>
  );
}
