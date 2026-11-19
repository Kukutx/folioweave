import type { CSSProperties } from "react";
import type { Copy } from "../copy";
import type { Mode, Phase } from "../state";
import styles from "./printer.module.css";

/** What a busy phase says, and how far along it is (null: unknown). */
function describe(copy: Copy, phase: Phase): { text: string; progress: number | null } {
  switch (phase.kind) {
    case "loading":
      return { text: phase.task === "design" ? copy.designing : copy.reading, progress: null };
    case "cutting":
      return {
        text:
          phase.stage === "scan" ? copy.scanning : copy.cutting(phase.done, phase.total),
        progress: phase.fraction,
      };
    case "naming":
      return {
        text: copy.naming(Math.min(phase.done + 1, phase.total), phase.total),
        progress: phase.total ? phase.done / phase.total : null,
      };
    default:
      return { text: "", progress: null };
  }
}

/** The screen while the printer works: one line of status and a bar. */
export function ProgressScreen({
  copy,
  mode,
  phase,
}: {
  copy: Copy;
  mode: Mode;
  phase: Phase;
}) {
  const { text, progress } = describe(copy, phase);
  const percent = progress === null ? undefined : Math.round(progress * 100);
  return (
    <div className={styles.screen} data-mode={mode}>
      <p className={styles.status} role="status" aria-live="polite">
        {text}
      </p>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={text}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={styles.bar}
          data-indeterminate={progress === null || undefined}
          style={{ "--progress": progress ?? 0 } as CSSProperties}
        />
      </div>
    </div>
  );
}
