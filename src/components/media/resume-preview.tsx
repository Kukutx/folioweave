"use client";

import { motion } from "framer-motion";
import { Check, Download, X } from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { siteConfig } from "@/config/site";
import { useManagedTimeouts } from "@/hooks/use-managed-timeouts";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { useModalDialog } from "@/hooks/use-modal-dialog";
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

/** Keys that read the sheet wherever focus is in the viewer. */
const SCROLL_KEYS: Record<string, (page: number) => ScrollToOptions> = {
  ArrowDown: () => ({ top: 60 }),
  ArrowUp: () => ({ top: -60 }),
  PageDown: (page) => ({ top: page }),
  PageUp: (page) => ({ top: -page }),
};

/**
 * The printed resume opened at reading size over the page. The page behind is
 * locked and inert; Escape, the close button or a click outside the sheet
 * closes it and focus returns to `returnFocus`. The sheet scrolls with the
 * wheel, touch, and the arrow and page keys. The PDF (and the Word copy, when
 * the profile has one) stays one tap away.
 * Mount it inside AnimatePresence so it can fade out.
 */
export function ResumePreview({
  onClose,
  returnFocus,
}: {
  onClose: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  // A short "Saved" confirms the download, as the printer always did.
  const [saved, setSaved] = useState<string | null>(null);
  const { scheduleTimeout } = useManagedTimeouts();
  const { image, pdf, downloadName, docx } = siteConfig.resume as {
    image: string;
    pdf: string;
    downloadName: string;
    docx?: string;
  };
  const downloads = [
    { format: "PDF", href: pdf, name: downloadName },
    ...(docx
      ? [
          {
            format: "DOCX",
            href: docx,
            name: downloadName.replace(/\.pdf$/i, ".docx"),
          },
        ]
      : []),
  ];
  const size = sheetSize(image);
  const { keyboardClosing, dialogProps } = useModalDialog({
    onClose,
    initialFocus: closeRef,
    returnFocus,
    onKey: (event) => {
      const scroller = scrollerRef.current;
      const step = SCROLL_KEYS[event.key];
      // The focused scroller handles its own keys natively.
      if (!scroller || !step || document.activeElement === scroller) return;
      event.preventDefault();
      scroller.scrollBy({
        ...step(scroller.clientHeight * 0.9),
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
  });

  const quick = reducedMotion || keyboardClosing;
  return createPortal(
    <motion.dialog
      {...dialogProps}
      className={styles.dialog}
      aria-label="Resume preview"
      // Lenis stays out of the viewer, so its own scroll works natively.
      data-lenis-prevent=""
      initial={{ opacity: reducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: keyboardClosing ? 1 : 0 }}
      transition={{ duration: quick ? 0 : 0.3, ease }}
    >
      <div
        className={styles.bar}
        data-formats={downloads.length > 1 ? "" : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <span className={styles.title}>{siteConfig.identity.name}</span>
        {downloads.map(({ format, href, name }) => {
          const done = saved === format;
          return (
            <a
              key={format}
              className={styles.download}
              href={href}
              download={name}
              aria-label={done ? `${format} saved` : `Download ${format}`}
              data-saved={done || undefined}
              onClick={() => {
                setSaved(format);
                scheduleTimeout(
                  () => setSaved((current) => (current === format ? null : current)),
                  1600,
                );
              }}
            >
              {done ? (
                <Check size={16} aria-hidden />
              ) : (
                <Download size={16} aria-hidden />
              )}
              <span className={styles.label}>
                {done ? (
                  "Saved"
                ) : (
                  <>
                    <span className={styles.verb}>Download </span>
                    {format}
                  </>
                )}
              </span>
            </a>
          );
        })}
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
      <div
        ref={scrollerRef}
        className={styles.scroller}
        // A keyboard stop of its own, so the sheet can be read without a
        // pointer.
        tabIndex={0}
        role="region"
        aria-label="Resume"
      >
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
