"use client";

import { StatePanel } from "@/components/ui/StatePanel";

export default function InspectorError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StatePanel
      kind="error"
      title="The inspector hit a problem"
      message="Nothing was changed. Try loading it again."
      action={
        <button type="button" onClick={reset}>
          Try again
        </button>
      }
    />
  );
}
