"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Tracks a CSS opening: animations that start with the first paint, before
 * hydration. Returns true until every CSS animation inside `target` (whose
 * name contains `name`, when given) has finished, at once when none runs
 * (reduced motion, or hydration after the opening ended), plus a function
 * that ends it early. Render the opening's class or attribute only while it
 * is true, so a later change of preference or a print never replays it.
 */
export function useOpening(target: RefObject<Element | null>, name?: string) {
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    const node = target.current;
    if (!playing || !node) return;
    let cancelled = false;
    const running =
      typeof CSSAnimation === "undefined" || !node.getAnimations
        ? []
        : node
            .getAnimations({ subtree: true })
            .filter(
              (animation): animation is CSSAnimation =>
                animation instanceof CSSAnimation &&
                (!name || animation.animationName.includes(name)),
            );
    void Promise.all(
      running.map((animation) => animation.finished.catch(() => undefined)),
    ).then(() => {
      if (!cancelled) setPlaying(false);
    });
    return () => {
      cancelled = true;
    };
  }, [name, playing, target]);
  return [playing, () => setPlaying(false)] as const;
}
