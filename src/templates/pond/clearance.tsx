"use client";

// The site's floating controls (music, the tools launcher) sit at the foot of the screen, where the home page's
// introduction and hint rest too. This measures where they stand and lifts the text just clear of them:
// --pond-clear under the introduction's column, --pond-clear-right under the hint.

import { useEffect, useRef } from "react";

export function Clearance() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const page = ref.current?.closest<HTMLElement>("[data-pond-page]");
    if (!page) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bottom = page.getBoundingClientRect().bottom;
      const column = page.querySelector("[data-pond-intro]")?.getBoundingClientRect();
      const hint = page.querySelector("[data-pond-hint]")?.getBoundingClientRect();
      let clear = 0, clearRight = 0;
      for (const el of document.querySelectorAll<HTMLElement>("body > [data-plugin]")) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.top >= bottom) continue;
        if (column && r.left < column.right && r.right > column.left) clear = Math.max(clear, bottom - r.top);
        if (hint && hint.width && r.left < hint.right && r.right > hint.left)
          clearRight = Math.max(clearRight, bottom - r.top);
      }
      page.style.setProperty("--pond-clear", `${Math.round(clear)}px`);
      page.style.setProperty("--pond-clear-right", `${Math.round(clearRight)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const sizes = new ResizeObserver(schedule);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(page);
      document.querySelectorAll<HTMLElement>("body > [data-plugin]").forEach((el) => sizes.observe(el));
      schedule();
    };
    // plugins mount into <body> after hydration and can come and go
    const mounts = new MutationObserver(watch);
    mounts.observe(document.body, { childList: true });
    window.addEventListener("resize", schedule);
    watch();
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      mounts.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return <span ref={ref} hidden />;
}
