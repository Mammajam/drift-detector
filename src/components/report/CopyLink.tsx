"use client";

import { useState } from "react";
import buttons from "@/components/ui/buttons.module.css";
import styles from "./CopyLink.module.css";

/** Copies the page's address so the report can be shared. */
export function CopyLink() {
  const [message, setMessage] = useState("");

  async function copy() {
    // Clear first so repeating the action announces the message again.
    setMessage("");
    let result: string;
    try {
      await navigator.clipboard.writeText(window.location.href);
      result = "Link copied.";
    } catch {
      result = "Couldn't copy. Copy the address from your browser instead.";
    }
    setTimeout(() => setMessage(result), 50);
    setTimeout(() => setMessage(""), 5000);
  }

  return (
    <>
      <button type="button" className={buttons.secondary} onClick={copy}>
        Copy report link
      </button>
      <span role="status" className={styles.message}>
        {message}
      </span>
    </>
  );
}
