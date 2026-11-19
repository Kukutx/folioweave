"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { StickerAI } from "../ai/provider";
import type { Copy } from "../copy";
import { DropScreen } from "./drop-screen";
import { KeyForm } from "./key-form";
import controls from "./controls.module.css";
import styles from "./printer.module.css";

/**
 * Design with AI: the key first (once per browser), then a character image,
 * an optional style and one button.
 */
export function AiPanel({
  copy,
  ai,
  apiKey,
  onKey,
  reference,
  onReference,
  onClearReference,
  style,
  onStyle,
  onGenerate,
  over,
  alert,
}: {
  copy: Copy;
  ai: StickerAI;
  apiKey: string;
  onKey: (key: string) => void;
  reference: string | null;
  onReference: (file: File) => void;
  onClearReference: () => void;
  style: string;
  onStyle: (style: string) => void;
  onGenerate: () => void;
  over: boolean;
  /** An error, shown right under the button that led to it. */
  alert: ReactNode;
}) {
  const styleId = useId();
  const [editingKey, setEditingKey] = useState(false);

  if (!apiKey || editingKey)
    return (
      <KeyForm
        copy={copy}
        ai={ai}
        initial={editingKey ? apiKey : ""}
        onSave={(key) => {
          onKey(key);
          setEditingKey(false);
        }}
        onCancel={editingKey ? () => setEditingKey(false) : undefined}
      />
    );

  return (
    <>
      {reference ? (
        <div className={`${styles.screen} ${styles.reference}`} data-mode="ai">
          <img src={reference} alt="" className={styles.referenceImage} />
          <button
            type="button"
            className={styles.remove}
            onClick={onClearReference}
            aria-label={copy.removeImage}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <DropScreen
          mode="ai"
          label={copy.dropCharacterLabel}
          title={copy.dropCharacter}
          hint={copy.dropCharacterHint}
          over={over}
          onFile={onReference}
        />
      )}
      <div className={controls.field}>
        <label htmlFor={styleId} className={controls.label}>
          {copy.styleLabel}
        </label>
        <textarea
          id={styleId}
          className={controls.input}
          rows={2}
          placeholder={copy.stylePlaceholder}
          value={style}
          onChange={(event) => onStyle(event.target.value)}
        />
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={controls.primary}
          onClick={onGenerate}
          disabled={!reference}
        >
          {copy.generate}
        </button>
      </div>
      {alert}
      <p className={styles.keyLine}>
        <span>{copy.keySaved(ai.name)}</span>
        <button type="button" className={controls.text} onClick={() => setEditingKey(true)}>
          {copy.keyChange}
        </button>
        <button type="button" className={controls.text} onClick={() => onKey("")}>
          {copy.keyForget}
        </button>
      </p>
    </>
  );
}
