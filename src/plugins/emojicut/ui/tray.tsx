"use client";

import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { Download, Plus, RotateCcw } from "lucide-react";
import { useOpening } from "@/hooks/use-opening";
import type { Copy } from "../copy";
import { safeFileName } from "../lib/files";
import type { Sticker } from "../state";
import controls from "./controls.module.css";
import styles from "./tray.module.css";

function StickerCard({
  copy,
  sticker,
  onRename,
}: {
  copy: Copy;
  sticker: Sticker;
  onRename: (name: string) => void;
}) {
  // The drop-in plays once; the attribute goes when it ends (at once when
  // motion is reduced), so a later change of preference never replays it.
  const cardRef = useRef<HTMLLIElement>(null);
  const [opening] = useOpening(cardRef, "drop");
  const [editing, setEditing] = useState(false);
  const refocus = useRef(false);

  const finish = (input: HTMLInputElement, keep: boolean) => {
    if (!editing) return;
    const name = input.value.trim();
    refocus.current = true;
    setEditing(false);
    if (keep && name && name !== sticker.name) onRename(name);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // Focus returns to the name button: keep this Enter from pressing it.
      event.preventDefault();
      finish(event.currentTarget, true);
    }
    if (event.key === "Escape") {
      // Leave the edit, not the page's dialogs.
      event.stopPropagation();
      finish(event.currentTarget, false);
    }
  };

  return (
    <li
      ref={cardRef}
      className={styles.card}
      data-sticker=""
      data-opening={opening || undefined}
      style={{ "--order": sticker.order } as CSSProperties}
    >
      <div className={styles.art}>
        <img
          src={sticker.url}
          alt={sticker.name}
          width={sticker.width}
          height={sticker.height}
          decoding="async"
          draggable={false}
        />
      </div>
      <div className={styles.meta}>
        {editing ? (
          <input
            className={styles.nameInput}
            aria-label={copy.nameLabel}
            defaultValue={sticker.name}
            maxLength={80}
            spellCheck={false}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => finish(event.currentTarget, true)}
            onKeyDown={onKeyDown}
          />
        ) : (
          <button
            ref={(node) => {
              if (node && refocus.current) {
                refocus.current = false;
                node.focus();
              }
            }}
            type="button"
            className={styles.name}
            data-naming={sticker.naming || undefined}
            aria-label={copy.rename(sticker.name)}
            title={sticker.name}
            onClick={() => setEditing(true)}
          >
            {sticker.name}
          </button>
        )}
        <a
          className={styles.download}
          href={sticker.url}
          download={`${safeFileName(sticker.name)}.png`}
          aria-label={copy.download(sticker.name)}
          title={copy.download(sticker.name)}
        >
          <Download size={16} aria-hidden />
        </a>
      </div>
    </li>
  );
}

/** The results under the printer: one row of actions and the stickers. */
export function Tray({
  copy,
  stickers,
  zipping,
  canAdd,
  onDownloadAll,
  onAdd,
  onStartOver,
  onRename,
}: {
  copy: Copy;
  stickers: Sticker[];
  zipping: boolean;
  canAdd: boolean;
  onDownloadAll: () => void;
  onAdd: () => void;
  onStartOver: () => void;
  onRename: (id: string, name: string) => void;
}) {
  return (
    <section className={styles.tray} aria-label={copy.stickers}>
      <div className={styles.actions}>
        <p className={styles.count} aria-live="polite">
          {copy.count(stickers.length)}
        </p>
        <div className={styles.buttons}>
          <button
            type="button"
            className={controls.primary}
            onClick={onDownloadAll}
            disabled={zipping}
            aria-busy={zipping}
          >
            <Download size={18} aria-hidden />
            {copy.downloadAll}
          </button>
          <button
            type="button"
            className={controls.secondary}
            onClick={onAdd}
            disabled={!canAdd}
          >
            <Plus size={18} aria-hidden />
            {copy.addManually}
          </button>
          <button type="button" className={controls.secondary} onClick={onStartOver}>
            <RotateCcw size={18} aria-hidden />
            {copy.startOver}
          </button>
        </div>
      </div>
      <ul className={styles.grid}>
        {stickers.map((sticker) => (
          <StickerCard
            key={sticker.id}
            copy={copy}
            sticker={sticker}
            onRename={(name) => onRename(sticker.id, name)}
          />
        ))}
      </ul>
    </section>
  );
}
