"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import type { StickerAI } from "../ai/provider";
import type { Copy } from "../copy";
import { RichText } from "./rich";
import controls from "./controls.module.css";
import styles from "./printer.module.css";

/** The visitor's own API key, asked for where AI design needs it. */
export function KeyForm({
  copy,
  ai,
  initial,
  onSave,
  onCancel,
}: {
  copy: Copy;
  ai: StickerAI;
  initial: string;
  onSave: (key: string) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onSave(value);
  };
  return (
    <form className={`${styles.screen} ${styles.form}`} data-mode="ai" onSubmit={submit}>
      <label htmlFor={id} className={controls.label}>
        {copy.keyLabel(ai.name)}
      </label>
      <div className={styles.formRow}>
        <input
          id={id}
          className={`${controls.input} ${styles.grow}`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={copy.keyPlaceholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby={`${id}-note`}
        />
        <button type="submit" className={controls.primary} disabled={!value.trim()}>
          {copy.keySave}
        </button>
      </div>
      <p id={`${id}-note`} className={controls.note}>
        <RichText value={copy.keyGet(ai.keyUrl)} linkClassName={controls.link} />{" "}
        {copy.keyPrivate(ai.company)}
      </p>
      {onCancel && (
        <button type="button" className={controls.text} onClick={onCancel}>
          {copy.cancel}
        </button>
      )}
    </form>
  );
}
