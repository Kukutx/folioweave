"use client";

import { useAnimationControls } from "framer-motion";
import { useEffect, type RefObject } from "react";
import {
  reducedMotionQuery,
  usePrefersReducedMotion,
} from "@/hooks/use-media-query";

/**
 * A CSS-shorthand root margin in pixels for the current viewport. The observer
 * resolves percentages against the root's width on every side, so a vertical
 * percentage would follow the screen's width; here it follows the height. Each
 * inset stays under half the viewport, so a short window keeps a root to
 * intersect with.
 */
export function viewportMargin(margin: string) {
  const parts = margin.trim().split(/\s+/);
  const [top, right = top, bottom = top, left = right] = parts;
  const resolve = (value: string, size: number) => {
    const number = Number.parseFloat(value) || 0;
    const px = value.endsWith("%") ? (number / 100) * size : number;
    return `${Math.round(Math.max(px, -size * 0.45))}px`;
  };
  const height = window.innerHeight;
  const width = window.innerWidth;
  return [
    resolve(top, height),
    resolve(right, width),
    resolve(bottom, height),
    resolve(left, width),
  ].join(" ");
}

/**
 * Reveal-on-scroll that keeps server HTML readable. The server renders the
 * content in its final, visible state. Once the page is interactive, content
 * on screen stays as it is, and content above or below the viewport is set to
 * its "hidden" variant and animated to "visible" as it scrolls in. With
 * `once: false` it animates out again when it leaves and replays on the way
 * back. Reduced motion, focus reaching the content, and printing show it at
 * once.
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
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (disabled) return;
    const node = target.current;
    if (
      !node ||
      reducedMotion ||
      window.matchMedia(reducedMotionQuery).matches
    ) {
      controls.set("visible");
      return;
    }
    const bounds = node.getBoundingClientRect();
    let hidden = bounds.top >= window.innerHeight || bounds.bottom <= 0;
    // Explicit either way, so a re-run never leaves a previous run's state.
    controls.set(hidden ? "hidden" : "visible");
    // Content on screen at load stays put even inside the observer's margin.
    let first = true;
    const show = () => {
      if (!hidden) return;
      hidden = false;
      controls.set("visible");
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry) return;
        const settledOnScreen = first && !hidden;
        first = false;
        if (entry.isIntersecting) {
          if (hidden) {
            hidden = false;
            void controls.start("visible");
          }
          if (once) observer.disconnect();
        } else if (!once && !hidden && !settledOnScreen) {
          hidden = true;
          void controls.start("hidden");
        }
      },
      { rootMargin: viewportMargin(rootMargin) },
    );
    observer.observe(node);
    node.addEventListener("focusin", show);
    window.addEventListener("beforeprint", show);
    return () => {
      observer.disconnect();
      node.removeEventListener("focusin", show);
      window.removeEventListener("beforeprint", show);
    };
  }, [controls, disabled, once, reducedMotion, rootMargin, target]);
  return controls;
}
