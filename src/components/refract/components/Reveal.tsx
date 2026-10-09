"use client";

import { sceneLayout } from "@/components/refract/lib/scene-progress";

import { useEffect } from "react";
import { animate } from "animejs";

export function Reveal() {
  useEffect(() => {
    const media = window.matchMedia(sceneLayout.reducedQuery);
    const animations: ReturnType<typeof animate>[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (!media.matches) {
            animations.push(
              animate(entry.target, {
                y: [28, 0],
                opacity: [0.35, 1],
                duration: 950,
                ease: "out(3)",
              }),
            );
          }
          observer.unobserve(entry.target);
        });
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
