"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ScaledFrame.module.css";

type ScaledFrameProps = {
  width: number;
  height: number;
  /** Content drawn at the frame's real pixel size, then scaled down to fit. */
  children: ReactNode;
  /** Drawn on top at the scaled size and not scaled itself (pins stay a readable size). */
  overlay?: ReactNode;
};

export function ScaledFrame({ width, height, children, overlay }: ScaledFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(width);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAvailable(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(1, available / width);

  return (
    <div ref={ref} className={styles.box}>
      <div className={styles.sized} style={{ width: width * scale, height: height * scale }}>
        <div
          className={styles.inner}
          style={{ width, height, transform: `scale(${scale})` }}
          aria-hidden="true"
        >
          {children}
        </div>
        {overlay}
      </div>
    </div>
  );
}
