"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { scrollToElement, scrollToPosition } from "@/lib/scroll";

/** How long the hero waits, unscrolled, before it suggests scrolling. */
const IDLE_MS = 3500;
/** Scrolling this far counts as having found the way down. */
const SCROLLED_PX = 8;
const DESKTOP = "(hover: hover) and (pointer: fine) and (min-width: 768px)";
const ease = [0.22, 1, 0.36, 1] as const;

/**
 * A quiet "scroll" cue at the foot of the hero, on the line where the
 * floating Home button later sits. It is not there at first: it appears only
 * when a desktop visitor has stayed at the top for a few seconds, and leaves
 * for good with the first scroll. A click scrolls down.
 * Phones get none: people swipe without being told, and the foot of a phone
 * screen belongs to the floating controls.
 */
export function ScrollHint({ blocked }: { blocked: boolean }) {
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const scrolled = () => window.scrollY > SCROLLED_PX;
    const onScroll = () => {
      if (scrolled()) setDone(true);
    };
    const timer = window.setTimeout(() => {
      if (scrolled() || !window.matchMedia(DESKTOP).matches) return;
      // Only where the hero leaves room for it above the fold: the cue
      // (1rem from the bottom, 72px tall) and a clear gap.
      const content = document.querySelector(".hero-content");
      const bottom = content?.getBoundingClientRect().bottom ?? 0;
      const rem = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      if (bottom > window.innerHeight - rem - 72 - 2 * rem) return;
      setShown(true);
    }, IDLE_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [done]);

  const goDown = () => {
    setDone(true);
    const about = document.getElementById("about");
    if (about) scrollToElement(about, { offset: -100 });
    else scrollToPosition(window.innerHeight * 0.9);
  };

  return (
    <AnimatePresence>
      {shown && !done && !blocked && (
        <motion.button
          type="button"
          className="hero-scroll-indicator"
          onClick={goDown}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6, transition: { duration: 0.3, ease } }}
          transition={{ duration: 0.7, ease }}
        >
          <span className="hero-scroll-mouse" aria-hidden>
            <span className="hero-scroll-wheel" />
          </span>
          <span className="hero-scroll-label">Scroll to explore</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
