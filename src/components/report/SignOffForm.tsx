"use client";

import { useActionState, useEffect } from "react";
import { signOffAction, type FormState } from "@/app/actions";
import buttons from "@/components/ui/buttons.module.css";
import styles from "./SignOffForm.module.css";

type SignOffFormProps = { routeId: string; previewUrl: string; approver: string };

export function SignOffForm({ routeId, previewUrl, approver }: SignOffFormProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(signOffAction, {});

  // The form is replaced by the "Signed off" message; keep keyboard and screen-reader users in place.
  useEffect(() => {
    if (state.done) document.getElementById("approval")?.focus();
  }, [state.done]);

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="routeId" value={routeId} />
      <input type="hidden" name="previewUrl" value={previewUrl} />
      <p>
        You&apos;ll be recorded as the approver: <strong>{approver}</strong>.
      </p>
      <button type="submit" className={buttons.primary} disabled={pending}>
        {pending ? "Signing off…" : "Sign off this build"}
      </button>
      <p key={state.attempt} role="alert" className={styles.error}>
        {state.error ?? ""}
      </p>
    </form>
  );
}
