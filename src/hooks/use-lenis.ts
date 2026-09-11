"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { useMediaQuery } from "./use-media-query";

export function useLenis() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const nativeTouchScroll = useMediaQuery("(hover: none) and (pointer: coarse)");
  useEffect(() => {
    // useSyncExternalStore hydrates from a server-safe `false` snapshot. Read the
    // browser queries again here so Lenis is never created for a single effect
    // turn on touch devices or reduced-motion sessions before the store syncs.
    const reduceNow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touchNow = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;
    if (reducedMotion || nativeTouchScroll || reduceNow || touchNow) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });
    window.__lenis = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = window.requestAnimationFrame(raf);
    };
    const start = () => {
      if (!frame) frame = window.requestAnimationFrame(raf);
    };
    const stop = () => {
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    start();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
      lenis.destroy();
      delete window.__lenis;
    };
  }, [reducedMotion, nativeTouchScroll]);
}
