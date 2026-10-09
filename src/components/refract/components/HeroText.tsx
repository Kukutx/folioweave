"use client";

import { useRefractData } from "../data-context";

import { sceneLayout } from "@/components/refract/lib/scene-progress";

import { useEffect, useLayoutEffect, useRef } from "react";
import { animate, createTimeline, splitText, stagger, utils } from "animejs";

export function HeroText({
  paused,
  reduced,
  entrance: entranceState,
}: {
  paused: boolean;
  reduced: boolean;
  entrance: "waiting" | "animate" | "static";
}) {
  const { copy, profile, siteConfig } = useRefractData();
  const root = useRef<HTMLDivElement>(null);
  const topics = siteConfig.hero.rotatingTopics;
  const canRotate = topics.length > 1 && profile.tagline.endsWith(topics[0]);
  const prefix = canRotate
    ? profile.tagline.slice(0, -topics[0].length)
    : profile.tagline;

  useLayoutEffect(() => {
    if (!root.current || entranceState !== "animate") return;
    const preference = matchMedia(sceneLayout.reducedQuery);
    if (preference.matches) return;
    const heading = splitText(root.current.querySelector("h1")!, {
      words: true,
      chars: true,
    });
    const description = splitText(
      root.current.querySelector(".intro-prefix")!,
      { words: true },
    );
    // Reference sr(): .35em horizontal offset, 25ms stagger, 1000ms outQuint.
    const entrance = createTimeline({
      defaults: { duration: 1000, ease: "outQuint" },
    })
      .add(
        heading.chars,
        {
          x: [".35em", 0],
          opacity: [0, 1],
          delay: stagger(25, { ease: "outIn(2)" }),
        },
        0,
      )
      .add(
        description.words,
        {
          x: [".35em", 0],
          opacity: [0, 1],
          delay: stagger(25, { ease: "outIn(2)" }),
        },
        500,
      )
      .add(
        root.current.querySelectorAll(".rotating-topics,.intro-position"),
        { opacity: [0, 1], duration: 350 },
        500,
      );
    const finish = () => {
      if (preference.matches) entrance.complete();
    };
    preference.addEventListener("change", finish);
    return () => {
      preference.removeEventListener("change", finish);
      entrance.revert();
      heading.revert();
      description.revert();
    };
  }, [entranceState]);

  useEffect(() => {
    if (
      !canRotate ||
      !root.current ||
      paused ||
      reduced ||
      entranceState === "waiting" ||
      matchMedia(sceneLayout.reducedQuery).matches
    )
      return;
    const elements = Array.from(
      root.current.querySelectorAll<HTMLElement>(".rotating-topic"),
    );
    const splits = elements.map((element) =>
      splitText(element, { words: true, chars: true, accessible: false }),
    );
    let current = 0,
      inView = false,
      disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let motion: ReturnType<typeof animate> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed && inView && !document.hidden)
        timer = setTimeout(cycle, 2800);
    };
    const cycle = () => {
      const next = (current + 1) % elements.length;
      motion = animate(splits[current].chars, {
        opacity: 0,
        scaleX: 0,
        duration: 100,
        delay: stagger(25, { from: "last", ease: "in(3)" }),
        onComplete: () => {
          if (disposed) return;
          elements[current].style.visibility = "hidden";
          elements[next].style.visibility = "visible";
          utils.set(splits[next].chars, { opacity: 0, scaleX: 0, x: 10 });
          current = next;
          motion = animate(splits[current].chars, {
            opacity: 1,
            scaleX: 1,
            x: 0,
            duration: 150,
            delay: stagger(25, { ease: "in(3)", start: 100 }),
            ease: "out(3)",
            onComplete: schedule,
          });
        },
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      schedule();
    });
    observer.observe(root.current);
    const visibility = () => {
      if (document.hidden) {
        clearTimeout(timer);
        motion?.pause();
      } else {
        motion?.resume();
        schedule();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      motion?.revert();
      splits.forEach((split) => split.revert());
      elements.forEach((element, i) => {
        element.style.visibility = i ? "hidden" : "visible";
      });
    };
  }, [paused, reduced, canRotate, entranceState, topics]);

  return (
    <div className="intro-text" data-entrance={entranceState} ref={root}>
      <h1>
        {profile.name.split(" ").map((part, index) => (
          <span key={index}>
            {index > 0 && <br />}
            {index > 0 ? ` ${part}` : part}
          </span>
        ))}
      </h1>
      <p className="intro-tagline">
        <span className="intro-prefix">{prefix}</span>
        {canRotate && (
          <span className="rotating-topics">
            <span className="sr-only">{topics[0]}</span>
            {topics.map((topic, i) => (
              <span
                className="rotating-topic"
                aria-hidden="true"
                key={topic}
                style={{ visibility: i ? "hidden" : "visible" }}
              >
                {topic}
              </span>
            ))}
          </span>
        )}
      </p>
      <p className="intro-position">
        {[profile.role, profile.affiliationShort ?? profile.affiliation]
          .filter(Boolean)
          .join(", ")}
      </p>
      <span className="sr-only">
        {copy.basedIn} {profile.location}
      </span>
    </div>
  );
}
