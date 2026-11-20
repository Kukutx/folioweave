"use client";

import { useRef } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { ImageUp } from "lucide-react";
import type { Mode } from "../state";
import controls from "./controls.module.css";
import styles from "./printer.module.css";

/**
 * The printer's screen as a place to put an image: click it, press Enter or
 * Space on it, or drop a file on the printer. With `button`, a primary
 * button below the screen opens the same chooser.
 */
export function DropScreen({
  mode,
  label,
  title,
  hint,
  over,
  onFile,
  button,
}: {
  mode: Mode;
  label: string;
  title: string;
  hint: string;
  over: boolean;
  onFile: (file: File) => void;
  button?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    pick();
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFile(file);
  };

  return (
    <>
      <div
        className={`${styles.screen} ${styles.drop}`}
        data-mode={mode}
        data-over={over || undefined}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={pick}
        onKeyDown={onKeyDown}
      >
        <ImageUp size={36} className={styles.screenIcon} aria-hidden />
        <p className={styles.screenTitle}>{title}</p>
        <p className={styles.screenHint}>{hint}</p>
      </div>
      {button && (
        <div className={styles.controls}>
          <button type="button" className={controls.primary} onClick={pick}>
            {button}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        onChange={onChange}
      />
    </>
  );
}
