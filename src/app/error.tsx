"use client";

import { StatePanel } from "@/components/ui/StatePanel";
import buttons from "@/components/ui/buttons.module.css";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StatePanel
      kind="error"
      title="Something went wrong"
      message="Nothing was changed. Try loading the page again."
      action={
        <button type="button" className={buttons.secondary} onClick={reset}>
          Try again
        </button>
      }
    />
  );
}
