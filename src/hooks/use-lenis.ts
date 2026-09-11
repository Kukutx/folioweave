"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { useMediaQuery } from "./use-media-query";

export function useLenis() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const nativeTouchScroll = useMediaQuery("(hover: none) and (pointer: coarse)");
  useEffect(() => {
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
  }, [reducedMotion, nativeTouchScroll]);
}
