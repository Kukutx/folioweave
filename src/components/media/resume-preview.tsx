"use client";

import { motion } from "framer-motion";
import { Check, Download, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { siteConfig } from "@/config/site";
import { useManagedTimeouts } from "@/hooks/use-managed-timeouts";
import { useMediaQuery } from "@/hooks/use-media-query";
import { lockPageScroll } from "@/lib/scroll-lock";
import { mediaDimensions } from "@/portfolio/media";
import styles from "./resume-preview.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

/** The sheet's own size reserves its box before it decodes; an A4 page if
 * the image is unknown to the media manifest. */
function sheetSize(src: string) {
  try {
    return mediaDimensions(src);
  } catch {
    return { width: 1240, height: 1754 };
  }
}

/**
 * The printed resume opened at reading size over the page. The page behind is
 * locked and inert; Escape, the close button or a click outside the sheet
 * closes it and focus returns to what opened it. The PDF stays one tap away.
 * Mount it inside AnimatePresence so it can fade out.
 */
export function ResumePreview({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [keyboardClosing, setKeyboardClosing] = useState(false);
  // A short "Saved" confirms the download, as the printer always did.
  const [saved, setSaved] = useState(false);
  const { scheduleTimeout } = useManagedTimeouts();
  const { image, pdf, downloadName } = siteConfig.resume;
  const size = sheetSize(image);

  useLayoutEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const root = document.documentElement;
    // Cover a classic scrollbar's gutter too while the page is locked.
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    const releaseScroll = lockPageScroll();
    dialog?.style.setProperty("--modal-scrollbar-width", `${scrollbarWidth}px`);
    dialog?.showModal();
    closeRef.current?.focus({ preventScroll: true });
    // The page behind is inert; keep Tab cycling inside the viewer.
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>("a[href], button"),
      ];
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      dialog?.close();
      releaseScroll();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  const quick = reducedMotion || keyboardClosing;
  return createPortal(
    <motion.dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Resume preview"
      // Lenis stays out of the viewer, so its own scroll works natively.
      data-lenis-prevent=""
      initial={{ opacity: reducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: keyboardClosing ? 1 : 0 }}
      transition={{ duration: quick ? 0 : 0.3, ease }}
      onCancel={(event) => {
        event.preventDefault();
        flushSync(() => {
          setKeyboardClosing(true);
          onClose();
        });
      }}
      onClick={onClose}
    >
      <div className={styles.bar} onClick={(event) => event.stopPropagation()}>
        <span className={styles.title}>{siteConfig.identity.name}</span>
        <a
          className={styles.download}
          href={pdf}
          download={downloadName}
          aria-label={saved ? "PDF saved" : "Download PDF"}
          data-saved={saved || undefined}
          onClick={() => {
            setSaved(true);
            scheduleTimeout(() => setSaved(false), 1600);
          }}
        >
          {saved ? (
            <Check size={16} aria-hidden />
          ) : (
            <Download size={16} aria-hidden />
          )}
          <span>{saved ? "Saved" : "Download PDF"}</span>
        </a>
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close resume preview"
        >
          <X size={20} aria-hidden />
        </button>
      </div>
      <div className={styles.scroller}>
        <motion.img
          className={styles.sheet}
          src={image}
          alt={`${siteConfig.identity.name} resume`}
          width={size.width}
          height={size.height}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          initial={reducedMotion ? false : { opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={quick ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={quick ? { duration: 0 } : { duration: 0.45, ease }}
        />
      </div>
    </motion.dialog>,
    document.body,
  );
}
