"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy as CopyIcon, X } from "lucide-react";
import type { StickerAI } from "../ai/provider";
import type { Copy } from "../copy";
import { Modal } from "./modal";
import { RichText } from "./rich";
import controls from "./controls.module.css";
import styles from "./dialog.module.css";

type CopyState = "idle" | "copied" | "failed";

/** How it works: three steps, the helper prompt, privacy and the credit. */
export function HelpDialog({
  copy,
  ai,
  onClose,
}: {
  copy: Copy;
  ai: StickerAI | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = (state: CopyState) => {
    setCopyState(state);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopyState("idle"), 2000);
  };

  // Without the async clipboard (an insecure origin, an old browser) the
  // selection is copied the old way.
  const copyBySelection = () => {
    const area = document.createElement("textarea");
    area.value = copy.helperPrompt;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    closeRef.current?.parentElement?.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    area.remove();
    flash(copied ? "copied" : "failed");
  };

  const copyPrompt = () => {
    if (!navigator.clipboard) return copyBySelection();
    navigator.clipboard
      .writeText(copy.helperPrompt)
      .then(() => flash("copied"), copyBySelection);
  };

  const link = controls.link;
  const steps = ai
    ? [copy.helpSteps.cut, copy.helpSteps.ai, copy.helpSteps.result, copy.helpSteps.fix]
    : [copy.helpSteps.cut, copy.helpSteps.result, copy.helpSteps.fix];

  return (
    <Modal
      labelledBy={titleId}
      tone="light"
      initialFocus={closeRef}
      onClose={onClose}
      className={styles.card}
    >
      <button
        ref={closeRef}
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label={copy.close}
      >
        <X size={20} aria-hidden />
      </button>
      <h2 id={titleId} className={styles.title}>
        {copy.help}
      </h2>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={index}>
            <RichText value={step} linkClassName={link} />
          </li>
        ))}
      </ol>

      <section className={styles.section}>
        <h3 className={styles.heading}>{copy.promptTitle}</h3>
        <p className={styles.body}>{copy.promptIntro}</p>
        <div className={styles.prompt}>
          <p className={styles.promptText}>{copy.helperPrompt}</p>
          <button type="button" className={styles.copy} onClick={copyPrompt}>
            {copyState === "copied" ? (
              <Check size={16} aria-hidden />
            ) : (
              <CopyIcon size={16} aria-hidden />
            )}
            <span aria-live="polite">
              {copyState === "copied"
                ? copy.copied
                : copyState === "failed"
                  ? copy.copyFailed
                  : copy.copyPrompt}
            </span>
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>{copy.privacyTitle}</h3>
        <p className={styles.body}>
          {copy.privacyCut}
          {ai && ` ${copy.privacyAi(ai.company)}`}
        </p>
      </section>

      <p className={styles.credit}>
        <RichText value={copy.credit} linkClassName={link} />
      </p>
    </Modal>
  );
}
