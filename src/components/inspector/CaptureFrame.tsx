import type { Capture } from "@/lib/types";
import { SampleFrame } from "./SampleFrame";
import styles from "./CaptureFrame.module.css";

type CaptureFrameProps = {
  capture: Capture;
  variant: "design" | "build";
  /** Sample data only: a clean capture renders identical layers. */
  matches?: boolean;
};

/** One layer of the comparison: the captured PNG when there is one, the sample page otherwise. */
export function CaptureFrame({ capture, variant, matches }: CaptureFrameProps) {
  if (!capture.images) {
    return <SampleFrame variant={variant} theme={capture.theme} matches={matches} />;
  }

  return (
    <div className={styles.frame}>
      {/* Data-URL screenshots at their natural size: next/image can't optimise them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.image} src={capture.images[variant]} alt="" draggable={false} />
    </div>
  );
}
