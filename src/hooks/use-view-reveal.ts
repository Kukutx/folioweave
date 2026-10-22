"use client";

import { useAnimationControls } from "framer-motion";
import { useEffect, type RefObject } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";

const REDUCE = "(prefers-reduced-motion: reduce)";

/**
 * Reveal-on-scroll that keeps server HTML readable. The server renders the
 * content in its final, visible state. Once the page is interactive, content
 * that is already on screen stays exactly as it is, and content further down
 * is set to its "hidden" variant while out of sight and animated to "visible"
 * as it scrolls in. With `once: false` it hides again after leaving the
 * viewport and replays on the way back. Reduced motion shows everything at
 * once, also when the preference changes while something is hidden, and so
 * does printing.
 *
 * Pass the returned controls as `animate`, with `initial={false}`. Children
 * with matching variants follow, so a stagger needs no observer of its own.
 * Animate opacity and transform only, on a wrapper rather than an image.
 */
export function useViewReveal(
  target: RefObject<Element | null>,
  {
    once = true,
    rootMargin = "0px 0px -10% 0px",
    disabled = false,
  }: { once?: boolean; rootMargin?: string; disabled?: boolean } = {},
) {
  const controls = useAnimationControls();
  // Subscribing re-runs the effect when the preference changes. The effect
  // reads the live value itself: this hook reports false during hydration.
  const reducedMotion = useMediaQuery(REDUCE);
  useEffect(() => {
    if (disabled) return;
    const node = target.current;
    if (!node || reducedMotion || window.matchMedia(REDUCE).matches) {
      controls.set("visible");
      return;
    }
    const bounds = node.getBoundingClientRect();
    let hidden = bounds.top >= window.innerHeight || bounds.bottom <= 0;
    if (hidden) controls.set("hidden");
    const show = () => {
      if (!hidden) return;
      hidden = false;
      controls.set("visible");
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (hidden) {
            hidden = false;
            void controls.start("visible");
          }
          if (once) observer.disconnect();
        } else if (!once && !hidden) {
          // Out of sight again: reset quietly so the way back replays it.
          hidden = true;
          controls.set("hidden");
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    window.addEventListener("beforeprint", show);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", show);
      // Never leave content hidden behind a torn-down observer.
      controls.set("visible");
    };
  }, [controls, disabled, once, reducedMotion, rootMargin, target]);
  return controls;
}
