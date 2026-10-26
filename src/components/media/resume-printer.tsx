"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";
import { useManagedTimeouts } from "@/hooks/use-managed-timeouts";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { ResumePreview } from "./resume-preview";

export type ResumeState =
  | "idle"
  | "morphing"
  | "printing"
  | "ready"
  | "closing"
  | "collapsing";

function ResumeFileIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}

/**
 * Prints the resume: the button turns into a printer and feeds out the sheet.
 * Once it is out, Preview (or a click on the sheet) opens it at reading size,
 * with the PDF one tap away there; the cross feeds it back in.
 */
export function ResumePrinter({
  state,
  setState,
}: {
  state: ResumeState;
  setState: (s: ResumeState) => void;
}) {
  const morphing = state === "morphing";
  const printing = state === "printing";
  const ready = state === "ready";
  const closing = state === "closing";
  const collapsing = state === "collapsing";
  const active = morphing || printing || ready || closing || collapsing;
  const reducedMotion = usePrefersReducedMotion();
  const paperRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  // One print at a time: the sheet's preload is awaited before the state
  // leaves idle, and a second click must not start another run meanwhile.
  const starting = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // The sheet image is fetched once someone heads for the button, not with
  // the page.
  const [sheetWanted, setSheetWanted] = useState(false);
  const { scheduleTimeout } = useManagedTimeouts();
  const paperHeight = 326;
  const printDelay = reducedMotion ? 0 : 0.48;
  const paperFrames = [-326, -326, -249, -249, -163, -163, -75, -75, 2];
  const printTimes = [0, 0.1, 0.29, 0.35, 0.54, 0.6, 0.79, 0.85, 1];
  const closeTimes = printTimes.map((time) => 1 - time).reverse();
  const printOpacity = [0, 1, 1, 1, 1, 1, 1, 1, 1];
  const closeOpacity = [1, 1, 1, 1, 1, 1, 1, 1, 0];

  const preloadImage = useCallback(
    (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
        image.decode?.().then(() => resolve(image)).catch(() => {});
      }),
    [],
  );

  // Hover, focus or touch warms the sheet before the click.
  const warmSheet = useCallback(() => {
    setSheetWanted(true);
    preloadImage(siteConfig.resume.image).catch(() => {});
  }, [preloadImage]);

  useEffect(() => {
    const target = printing
      ? paperRef.current
      : ready
        ? actionsRef.current
        : null;
    if (!target) return;

    let frame = 0;
    let delayTimer = 0;
    const keepVisible = () => {
      const rect = target.getBoundingClientRect();
      const viewportBottom = window.innerHeight - (printing ? 108 : 28);
      const overflow = rect.bottom - viewportBottom;
      if (overflow > 0.5) {
        const absoluteTarget = window.scrollY + overflow;
        const lenis = window.__lenis;
        if (lenis) {
          lenis.scrollTo(
            absoluteTarget,
            printing
              ? { lerp: 0.32, force: true }
              : { duration: 0.42, force: true },
          );
        } else {
          window.scrollTo({
            top: printing
              ? window.scrollY + overflow * 0.32
              : absoluteTarget,
            behavior: printing ? "auto" : "smooth",
          });
        }
      }
      if (printing) frame = requestAnimationFrame(keepVisible);
    };
    const begin = () => {
      frame = requestAnimationFrame(keepVisible);
    };

    if (printing && printDelay > 0) {
      delayTimer = window.setTimeout(begin, printDelay * 1000);
    } else {
      begin();
    }
    return () => {
      window.clearTimeout(delayTimer);
      cancelAnimationFrame(frame);
    };
  }, [printing, ready, printDelay]);

  const start = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    if (state !== "idle" || starting.current) return;
    starting.current = true;
    event?.currentTarget.blur();
    setSheetWanted(true);
    try {
      await preloadImage(siteConfig.resume.image);
    } catch {}
    starting.current = false;
    setState("morphing");
    scheduleTimeout(
      () => {
        setState("printing");
        scheduleTimeout(() => setState("ready"), 2550);
      },
      reducedMotion ? 10 : 1050,
    );
  };

  const beginClose = () => {
    setState("closing");
    scheduleTimeout(() => setState("collapsing"), 1880);
    scheduleTimeout(() => setState("idle"), 2880);
  };

  const openPreview = () => {
    if (ready) setPreviewOpen(true);
  };

  const close = () => {
    if (!ready) return;
    beginClose();
  };

  return (
    <motion.div
      layout
      transition={{
        layout: reducedMotion
          ? { duration: 0.01 }
          : { duration: 1.05, ease: [0.16, 1, 0.3, 1] },
      }}
      className={"resume-printer " + (morphing ? "is-morphing " : "") + (printing ? "is-printing " : "") + (ready ? "is-ready " : "") + (closing ? "is-closing " : "") + (collapsing ? "is-collapsing " : "")}
    >
      <div className="resume-printer-stage">
        <button
          type="button"
          className="resume-print-button"
          onPointerEnter={warmSheet}
          onFocus={warmSheet}
          onTouchStart={warmSheet}
          onClick={start}
          disabled={state !== "idle"}
          aria-label={ready ? "Resume printed" : "Print resume"}
        >
          <span className="resume-button-label">
            {printing ? (
              "Printing..."
            ) : (
              <>
                Resume <ResumeFileIcon size={15} />
              </>
            )}
          </span>
        </button>
        <div className="resume-paper-slot" aria-hidden={!active}>
          <motion.div
            ref={paperRef}
            className="resume-paper"
            // A click on the printed sheet opens it too; the Preview button
            // is the accessible way in.
            onClick={openPreview}
            initial={false}
            animate={
              closing
                ? {
                    y: [...paperFrames].reverse(),
                    height: paperHeight,
                    opacity: closeOpacity,
                  }
                : printing
                  ? {
                      y: paperFrames,
                      height: paperHeight,
                      opacity: printOpacity,
                    }
                  : ready
                    ? { y: 2, height: paperHeight, opacity: 1 }
                    : {
                        y: -paperHeight,
                        height: paperHeight,
                        opacity: 0,
                      }
            }
            transition={{
              duration: printing || closing ? 1.8 : 0.25,
              delay: printing ? printDelay : 0,
              times: closing
                ? closeTimes
                : printing
                  ? printTimes
                  : undefined,
              ease:
                printing || closing
                  ? "linear"
                  : [0.18, 0.84, 0.32, 1],
            }}
          >
            {sheetWanted && (
              <img
                src={siteConfig.resume.image}
                alt=""
                draggable={false}
                decoding="sync"
              />
            )}
          </motion.div>
        </div>
        <div className="resume-slot-mouth" aria-hidden />
      </div>
      <AnimatePresence>
        {ready && (
          <motion.div
            ref={actionsRef}
            className="resume-actions"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={
              reducedMotion
                ? { duration: 0.01 }
                : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
            }
            style={{ willChange: "transform, opacity" }}
          >
            <button
              ref={previewButtonRef}
              type="button"
              className="resume-preview-button"
              onClick={openPreview}
              aria-haspopup="dialog"
            >
              Preview <Eye size={15} aria-hidden />
            </button>
            <button
              type="button"
              className="resume-discard-button"
              onClick={close}
              aria-label="Discard printed resume"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {previewOpen && (
          <ResumePreview
            onClose={() => setPreviewOpen(false)}
            returnFocus={previewButtonRef}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
