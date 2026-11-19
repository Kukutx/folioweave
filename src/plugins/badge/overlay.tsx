"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import type { BadgeCopy } from "./copy";
import type { LanyardScene } from "./lanyard/engine";
import { loadLanyard } from "./lanyard/load";
import type { BadgeSettings } from "./settings";
import styles from "./overlay.module.css";

export type BadgeOverlayProps = {
  settings: BadgeSettings;
  text: BadgeCopy;
  /** Unmount the overlay (the parent removes the address's hash). */
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
};

function hexLuminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

const hexRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** The open badge: the lanyard over a dimmed page, closed by the button,
 * Escape or a click beside the cards. */
export default function BadgeOverlay({
  settings,
  text,
  onClose,
  returnFocus,
}: BadgeOverlayProps) {
  const { scene, backdrop } = settings;
  const [still] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [leaving, setLeaving] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LanyardScene | null>(null);
  const [Lanyard, setLanyard] = useState<Awaited<
    ReturnType<typeof loadLanyard>
  > | null>(null);

  // The scene is usually loaded by now (the small badge starts it on
  // intent); otherwise it swings in once it arrives. Without it (offline),
  // the overlay still closes as usual.
  useEffect(() => {
    let current = true;
    loadLanyard().then(
      (component) => current && setLanyard(() => component),
      () => {},
    );
    return () => {
      current = false;
    };
  }, []);

  const close = useCallback(() => {
    if (still) onClose();
    else setLeaving(true);
  }, [onClose, still]);

  const { dialogProps } = useModalDialog({
    onClose,
    initialFocus: stageRef,
    returnFocus,
  });

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onClose, 200);
    return () => window.clearTimeout(timer);
  }, [leaving, onClose]);

  const onStageKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    sceneRef.current?.flip();
  };

  const light = hexLuminance(backdrop.color) > 0.36;
  const style = {
    "--badge-backdrop": `rgb(${hexRgb(backdrop.color)} / ${backdrop.opacity})`,
    "--badge-blur": `${backdrop.blur}px`,
    "--badge-ink": light ? "#1b2230" : "#f3f5f9",
    "--badge-surface": light ? "#ffffff" : "#20242c",
  } as CSSProperties;
  const described = scene.cards
    .map((card) => card.alt)
    .filter(Boolean)
    .join(". ");

  return (
    <dialog
      {...dialogProps}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      // The ring round the cards shows only once the keyboard is used: the
      // stage takes focus as the badge opens, whatever opened it.
      onKeyDownCapture={() => stageRef.current?.setAttribute("data-keys", "")}
      onPointerDownCapture={() => stageRef.current?.removeAttribute("data-keys")}
      className={styles.dialog}
      style={style}
      aria-label={settings.label ?? text.dialog}
      data-plugin-overlay="badge"
      data-leaving={leaving || undefined}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        role="button"
        tabIndex={0}
        aria-label={[described || text.cards, scene.interactive ? text.flip : ""]
          .filter(Boolean)
          .join(". ")}
        onKeyDown={scene.interactive ? onStageKey : undefined}
      >
        {/* A tap beside the cards closes, as on a backdrop. */}
        {Lanyard ? (
          <Lanyard settings={scene} sceneRef={sceneRef} onMiss={close} />
        ) : null}
      </div>
      {scene.interactive ? (
        <p className={styles.hint} aria-hidden="true">
          {settings.copy.hint ?? (still ? text.hintStill : text.hint)}
        </p>
      ) : null}
      <button
        type="button"
        className={styles.close}
        aria-label={settings.copy.close ?? text.close}
        onClick={close}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M5 5l10 10M15 5 5 15" />
        </svg>
      </button>
    </dialog>
  );
}
