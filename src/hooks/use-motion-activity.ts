"use client";

import { type RefObject } from "react";
import { useMediaQuery } from "./use-media-query";
import { useViewportActivity } from "./use-viewport-activity";

/** Continuous decoration is opt-in after hydration and stops when not useful. */
export function useMotionActivity(
  target: RefObject<HTMLElement | null> | string,
  { finePointer = false } = {},
) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const pointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const visible = useViewportActivity(target, "0px");
  return {
    active: visible && !reducedMotion && (!finePointer || pointer),
    reducedMotion,
  };
}
