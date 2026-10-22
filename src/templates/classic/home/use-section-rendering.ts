"use client";

import { useEffect, type RefObject } from "react";

/** Defer offscreen rendering only after measuring this profile's real layout. */
export function useSectionRendering(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const container = root.current;
    if (!container || !CSS.supports("content-visibility", "auto")) return;
    const sections = Array.from(
      container.querySelectorAll<HTMLElement>("[data-theme-scope]"),
    );
    let disposed = false;
    let frame = 0;
    let width = 0;
    let observingVisibility = false;
    const reset = () => {
      for (const section of sections) {
        section.style.removeProperty("content-visibility");
        section.style.removeProperty("contain-intrinsic-block-size");
      }
    };
    const measure = () => {
      reset();
      // Batch reads before writes; estimates must not move anchor destinations.
      const bounds = sections.map((section) => section.getBoundingClientRect());
      sections.forEach((section, index) => {
        section.style.containIntrinsicBlockSize = `auto ${bounds[index].height}px`;
        section.style.contentVisibility =
          bounds[index].bottom >= -240 && bounds[index].top <= innerHeight + 240
            ? "visible"
            : "auto";
      });
      if (!observingVisibility) {
        observingVisibility = true;
        sections.forEach((section) => visibility.observe(section));
      }
    };
    // Keep visible text/overflow on the original paint path (including font AA).
    const visibility = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          (entry.target as HTMLElement).style.contentVisibility =
            entry.isIntersecting ? "visible" : "auto";
      },
      { rootMargin: "240px 0px" },
    );
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === width) return;
      width = entry.contentRect.width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    // Measure only once the page has settled: fonts, the load event (images
    // and lazily imported sections) and an idle frame. On a slow phone an
    // earlier measurement recorded pre-hydration heights, and sections that
    // grew afterwards pushed the content below them when they were rendered
    // again during a scroll (layout shifts of 0.5 under 4x CPU throttling).
    const loaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", () => resolve(), { once: true });
    });
    const idle = () =>
      new Promise<void>((resolve) => {
        if (typeof window.requestIdleCallback === "function")
          window.requestIdleCallback(() => resolve(), { timeout: 2000 });
        else setTimeout(resolve, 200);
      });
    void Promise.all([document.fonts.ready, loaded])
      .then(idle)
      .then(() => {
        if (!disposed) {
          // ResizeObserver supplies the initial width as well. Measure once,
          // before visibility observers can skip any unmeasured section.
          observer.observe(container);
        }
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      reset();
    };
  }, [root]);
}
