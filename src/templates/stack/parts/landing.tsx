"use client";

import { useEffect } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Sets each object marked `data-land` down on the pile as it scrolls into view. The server
 * renders everything in place; once the page is interactive, objects outside the viewport
 * wait lifted and transparent (`data-landing="wait"`, styled in stack.module.css) and land
 * the first time they come in. What is on screen at that moment stays as it is. Reduced
 * motion leaves everything alone; focus reaching a waiting object and printing land it at
 * once. One observer serves the whole page.
 */
export function Landing() {
  useEffect(() => {
    const motion = window.matchMedia(REDUCED);
    if (motion.matches || typeof IntersectionObserver === "undefined") return;
    const waiting = new Set<HTMLElement>();
    const timers = new Set<number>();
    const land = (element: HTMLElement) => {
      if (!waiting.delete(element)) return;
      element.dataset.landing = "in";
      observer.unobserve(element);
      // once settled, the object's own transitions (hover, pick up) take over again
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (element.dataset.landing === "in")
          element.removeAttribute("data-landing");
      }, 1800);
      timers.add(timer);
    };
    const landAll = () => [...waiting].forEach(land);
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (entry) => entry.isIntersecting && land(entry.target as HTMLElement),
        ),
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-land]",
    )) {
      const { top, bottom } = element.getBoundingClientRect();
      if (top < window.innerHeight && bottom > 0) continue;
      element.dataset.landing = "wait";
      waiting.add(element);
      observer.observe(element);
    }
    const onFocus = (event: FocusEvent) => {
      for (const element of waiting)
        if (element.contains(event.target as Node)) {
          // no transition: focus must not wait for an animation to see its target
          element.removeAttribute("data-landing");
          waiting.delete(element);
          observer.unobserve(element);
        }
    };
    document.addEventListener("focusin", onFocus);
    window.addEventListener("beforeprint", landAll);
    motion.addEventListener("change", landAll);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("beforeprint", landAll);
      motion.removeEventListener("change", landAll);
    };
  }, []);
  return null;
}
