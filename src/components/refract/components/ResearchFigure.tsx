"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate } from "animejs";
import type { ResearchProject } from "../data";
import type { ResearchFigureConfig } from "../data";
import {
  panelMotion,
  sceneLayout,
} from "@/components/refract/lib/scene-progress";
import { NorthEastIcon } from "./Icons";
import { useRefractData } from "../data-context";

/** Reference showCard / hideCard: 120% travel, 350 / 250ms, inOut(3). */
export function ResearchFigure({
  project,
  definition,
  active,
  playing,
}: {
  project: ResearchProject;
  definition: ResearchFigureConfig;
  active: boolean;
  playing: boolean;
}) {
  const { copy } = useRefractData();
  const { source, animatedSource, width, height, caption } = definition;
  const figure = useRef<HTMLElement>(null);
  const motion = useRef<ReturnType<typeof animate> | null>(null);
  const [readySource, setReadySource] = useState<string>();
  const animationReady = readySource === animatedSource;

  useEffect(() => {
    if (!animatedSource || !active || !playing || animationReady) return;
    let disposed = false;
    const image = new Image();
    image.src = animatedSource;
    image
      .decode()
      .then(() => {
        if (!disposed) setReadySource(animatedSource);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [animatedSource, active, playing, animationReady]);

  useLayoutEffect(() => {
    const element = figure.current!;
    const desktop = matchMedia(sceneLayout.desktopQuery);
    const reduced = matchMedia(sceneLayout.reducedQuery);
    const render = (transition = true) => {
      motion.current?.pause();
      element.inert = !active;
      if (!desktop.matches || reduced.matches) {
        element.style.transform = "none";
        element.style.opacity = !desktop.matches || active ? "1" : "0";
        element.style.visibility =
          !desktop.matches || active ? "visible" : "hidden";
        return;
      }
      if (active) element.style.visibility = "visible";
      // Start at the current position on a quick reversal; never reset mid-flight.
      motion.current = animate(element, {
        translateY: active ? "0%" : panelMotion.offset,
        opacity: active ? 1 : 0,
        duration: transition
          ? active
            ? panelMotion.enter
            : panelMotion.leave
          : 0,
        ease: panelMotion.ease,
        onComplete: () => {
          if (!active) element.style.visibility = "hidden";
        },
      });
    };
    render();
    // A breakpoint change switches layout, not chapters. Do not briefly reveal
    // every formerly static mobile figure while returning to desktop.
    const adapt = () => render(false);
    desktop.addEventListener("change", adapt);
    reduced.addEventListener("change", adapt);
    return () => {
      motion.current?.pause();
      desktop.removeEventListener("change", adapt);
      reduced.removeEventListener("change", adapt);
    };
  }, [active]);

  return (
    <div className="research-figure-slot" data-mobile-panel="figure">
      <figure className="research-figure" ref={figure}>
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${copy.viewFigure}: ${project.title}`}
        >
          <img
            src={
              animatedSource && animationReady && active && playing
                ? animatedSource
                : source
            }
            alt={project.imageAlt ?? project.title}
            width={width}
            height={height}
            loading="lazy"
          />
        </a>
        <figcaption>
          {caption ?? project.imageCaption ?? project.title}
        </figcaption>
        <a
          className="figure-link"
          href={source}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.viewFigure}
          <NorthEastIcon />
        </a>
      </figure>
    </div>
  );
}
