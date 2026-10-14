"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changeDriftStatus, type FormState } from "@/app/actions";
import { StatusPill } from "@/components/ui/StatusPill";
import buttons from "@/components/ui/buttons.module.css";
import type { DriftStatus } from "@/lib/types";
import styles from "./StatusForm.module.css";

type StatusFormProps = { ticketId: string; status: DriftStatus; canEdit: boolean };

export function StatusForm({ ticketId, status, canEdit }: StatusFormProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeDriftStatus, {});

  return (
    <div className={styles.wrap}>
      <p className={styles.current}>
        Status: <StatusPill status={status} />
      </p>
      {canEdit ? (
        <form action={action} className={styles.form}>
          <input type="hidden" name="id" value={ticketId} />
          <label htmlFor="drift-status" className={styles.label}>
            Change status
          </label>
          <div className={styles.row}>
            <select id="drift-status" name="status" defaultValue={status} className={styles.select}>
              <option value="open">Open</option>
              <option value="fixed">Fixed</option>
              <option value="wont-fix">Won&apos;t fix</option>
            </select>
            <button type="submit" className={buttons.primary} disabled={pending}>
              {pending ? "Updating…" : "Update status"}
            </button>
          </div>
          <p key={state.attempt} role="status" className={styles.message}>
            {state.message ?? ""}
          </p>
        </form>
      ) : (
        <p className={styles.hint}>
          <Link href={`/login?next=/drifts/${ticketId}`}>Sign in</Link> or{" "}
          <Link href={`/signup?next=/drifts/${ticketId}`}>create an account</Link> to change the status.
        </p>
      )}
    </div>
  );
}
