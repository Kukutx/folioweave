"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { House } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { scrollToPosition } from "@/lib/scroll";
import styles from "./home-experience.module.css";

export function FloatingHomeButton({
  themeProgress,
}: {
  themeProgress: MotionValue<number>;
}) {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const backgroundColor = useTransform(themeProgress, (value) => {
    const channel = Math.round(255 - 235 * value);
    return `rgba(${channel}, ${channel}, ${channel}, 0.9)`;
  });
  const borderColor = useTransform(themeProgress, (value) => {
    const channel = Math.round(255 * value);
    return `rgba(${channel}, ${channel}, ${channel}, ${0.1 + 0.06 * value})`;
  });
  const color = useTransform(themeProgress, (value) => {
    const channel = Math.round(17 + 238 * value)
      .toString(16)
      .padStart(2, "0");
    return `#${channel}${channel}${channel}`;
  });

  // On a phone the floating controls sit over the text column. They step
  // aside while the reader scrolls down and return on the first scroll up or
  // at the end of the page. Floating plugins follow the same root signal.
  const [tucked, setTucked] = useState(false);
  const tuckedRef = useRef(false);
  const lastY = useRef(0);
  const setTuck = useCallback((next: boolean) => {
    if (next === tuckedRef.current) return;
    tuckedRef.current = next;
    setTucked(next);
    if (next) document.documentElement.dataset.fwFloating = "tucked";
    else delete document.documentElement.dataset.fwFloating;
  }, []);

  const updateVisibility = useCallback(
    (position: number) => {
      const threshold = Math.max(420, window.innerHeight * 0.72);
      const next = position > threshold;
      const delta = position - lastY.current;
      if (Math.abs(delta) >= 8) {
        lastY.current = position;
        // Only phones tuck; wider screens skip the layout read.
        const narrow = window.innerWidth < 768;
        setTuck(
          narrow &&
            next &&
            delta > 0 &&
            position + window.innerHeight <
              document.documentElement.scrollHeight - 24,
        );
      }
      if (next === visibleRef.current) return;
      visibleRef.current = next;
      setVisible(next);
    },
    [setTuck],
  );

  useEffect(() => {
    lastY.current = window.scrollY;
    updateVisibility(window.scrollY);
    // Widening past phone width brings the controls back without waiting for
    // the next scroll.
    const wide = window.matchMedia("(min-width: 768px)");
    const untuck = () => {
      if (wide.matches) setTuck(false);
    };
    wide.addEventListener("change", untuck);
    return () => {
      wide.removeEventListener("change", untuck);
      delete document.documentElement.dataset.fwFloating;
    };
  }, [updateVisibility, setTuck]);

  useMotionValueEvent(scrollY, "change", updateVisibility);

  const goHome = () => {
    if (window.location.pathname === "/" && window.location.hash) {
      window.history.replaceState(null, "", "/");
    }
    scrollToPosition(0, { duration: 0.9, force: true });
  };

  return (
    <AnimatePresence initial={false}>
      {visible && !tucked && (
        <motion.button
          type="button"
          data-floating-home
          className={styles.floatingHome}
          aria-label="Back to home"
          title="Back to home"
          onClick={goHome}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          style={{ backgroundColor, borderColor, color }}
        >
          <House aria-hidden="true" size={16} strokeWidth={2.2} />
          <span className={styles.floatingHomeLabel}>Home</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
