"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";
import { useManagedTimeouts } from "@/hooks/use-managed-timeouts";

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

const reduced = () =>
  typeof window !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const reducedMotion = reduced();
  const paperRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [downloaded, setDownloaded] = useState(false);
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

  useEffect(() => {
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
    if (state !== "idle") return;
    event?.currentTarget.blur();
    try {
      await preloadImage(siteConfig.resume.image);
    } catch {}
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

  const save = () => {
    if (!ready) return;
    const anchor = document.createElement("a");
    anchor.href = siteConfig.resume.pdf;
    anchor.download = siteConfig.resume.downloadName;
    anchor.click();
    setDownloaded(true);
    scheduleTimeout(() => {
      setDownloaded(false);
      beginClose();
    }, 900);
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
      className={"resume-printer " + (morphing ? "is-morphing " : "") + (printing ? "is-printing " : "") + (ready ? "is-ready " : "") + (closing ? "is-closing " : "") + (collapsing ? "is-collapsing " : "") + (downloaded ? "is-downloaded" : "")}
    >
      <div className="resume-printer-stage">
        <button
          type="button"
          className="resume-print-button"
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
            <img
              src={siteConfig.resume.image}
              alt=""
              draggable={false}
              loading="eager"
              decoding="sync"
            />
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
              type="button"
              className="resume-download-button"
              onClick={save}
            >
              {downloaded ? (
                <>
                  Saved <Check size={14} />
                </>
              ) : (
                <>
                  Download <Download size={14} />
                </>
              )}
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
    </motion.div>
  );
}
