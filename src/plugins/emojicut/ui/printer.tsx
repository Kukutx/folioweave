"use client";

import { useId, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent, ReactNode } from "react";
import type { Copy } from "../copy";
import type { Mode } from "../state";
import controls from "./controls.module.css";
import styles from "./printer.module.css";

const MODES: Mode[] = ["cut", "ai"];

/** The two modes as tabs: arrow keys move between them. */
function ModeSwitch({
  copy,
  mode,
  onMode,
  disabled,
  panelId,
}: {
  copy: Copy;
  mode: Mode;
  onMode: (mode: Mode) => void;
  disabled: boolean;
  panelId: string;
}) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home" ? "cut" : event.key === "End" ? "ai" : mode === "cut" ? "ai" : "cut";
    onMode(next);
    tabs.current[MODES.indexOf(next)]?.focus();
  };
  return (
    <div className={controls.modes} role="tablist" aria-label={copy.modes} onKeyDown={onKeyDown}>
      {MODES.map((value, index) => (
        <button
          key={value}
          ref={(node) => {
            tabs.current[index] = node;
          }}
          id={`${panelId}-${value}`}
          type="button"
          role="tab"
          className={controls.mode}
          aria-selected={mode === value}
          aria-controls={panelId}
          tabIndex={mode === value ? 0 : -1}
          disabled={disabled && mode !== value}
          onClick={() => onMode(value)}
        >
          {value === "cut" ? copy.modeCut : copy.modeAi}
        </button>
      ))}
    </div>
  );
}

/**
 * The pink printer: the mode switch, then whatever the mode shows. A file
 * dropped anywhere on it goes to `onDropFile`; `children` learns whether a
 * file is being dragged over it.
 */
export function Printer({
  copy,
  aiEnabled,
  mode,
  onMode,
  busy,
  onDropFile,
  children,
}: {
  copy: Copy;
  aiEnabled: boolean;
  mode: Mode;
  onMode: (mode: Mode) => void;
  busy: boolean;
  onDropFile: (file: File) => void;
  children: (over: boolean) => ReactNode;
}) {
  const panelId = useId();
  const [over, setOver] = useState(false);
  // Files dropped while busy are swallowed rather than opened by the browser.
  const carriesFile = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  return (
    <section
      className={styles.printer}
      onDragOver={(event) => {
        if (!carriesFile(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = busy ? "none" : "copy";
        setOver(!busy);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(event) => {
        setOver(false);
        if (!carriesFile(event)) return;
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file && !busy) onDropFile(file);
      }}
    >
      {aiEnabled && (
        <ModeSwitch
          copy={copy}
          mode={mode}
          onMode={onMode}
          disabled={busy}
          panelId={panelId}
        />
      )}
      <div
        id={panelId}
        className={styles.panel}
        role={aiEnabled ? "tabpanel" : undefined}
        aria-labelledby={aiEnabled ? `${panelId}-${mode}` : undefined}
      >
        {children(over)}
      </div>
      <div className={styles.slot} aria-hidden />
    </section>
  );
}
