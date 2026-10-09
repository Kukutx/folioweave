"use client";

import { sceneLayout } from "@/components/refract/lib/scene-progress";

import { useEffect } from "react";
import { animate, stagger } from "animejs";

export function Reveal() {
  useEffect(() => {
    const media = window.matchMedia(sceneLayout.reducedQuery);
    const animations: ReturnType<typeof animate>[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        // Rows that arrive together enter one after another, top to bottom.
        const arrived = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target);
        if (!arrived.length) return;
        if (!media.matches)
          animations.push(
            animate(arrived, {
              y: [28, 0],
              opacity: [0.35, 1],
              duration: 950,
              ease: "out(3)",
              delay: stagger(70),
            }),
          );
        arrived.forEach((target) => observer.unobserve(target));
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll(".refract-site [data-refract-reveal]")
      .forEach((node) => observer.observe(node));
    const onMedia = () => {
      if (media.matches) animations.forEach((animation) => animation.revert());
    };
    media.addEventListener("change", onMedia);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.revert());
      media.removeEventListener("change", onMedia);
    };
  }, []);
  return null;
}
