"use client";

import Lenis from "lenis";
import { useEffect } from "react";

export function useLenis() {
  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const nativeTouchScroll = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;
    if (reducedMotion || nativeTouchScroll) return;

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
  }, []);
}
