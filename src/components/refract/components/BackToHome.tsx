"use client";

import { sceneLayout } from "@/components/refract/lib/scene-progress";

import { useEffect, useRef } from "react";
import { ArrowIcon } from "./Icons";

export function BackToHome({ label, home }: { label: string; home: string }) {
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const control = link.current;
    if (!control) return;
    const experience = control
      .closest(".refract-site")
      ?.querySelector<HTMLElement>(".portfolio-experience");
    let previous: boolean | undefined;
    const update = () => {
      const visible =
        window.scrollY > 0 && experience?.dataset.footerCleared === "true";
      if (visible === previous) return;
      previous = visible;
      control.dataset.visible = String(visible);
      control.inert = !visible;
    };
    update();
    const observer = new MutationObserver(update);
    if (experience)
      observer.observe(experience, {
        attributes: true,
        attributeFilter: ["data-footer-cleared"],
      });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <a
      ref={link}
      data-visible="false"
      className="back-to-home"
      href="#home"
      aria-label={label}
      title={label}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        if (window.location.hash !== "#home")
          window.history.pushState(null, "", "#home");
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia(sceneLayout.reducedQuery).matches
            ? "instant"
            : "smooth",
        });
        // Move keyboard focus back to the start as well as scrolling there.
        event.currentTarget
          .closest(".refract-site")
          ?.querySelector<HTMLAnchorElement>(".wordmark")
          ?.focus({ preventScroll: true });
      }}
    >
      <ArrowIcon />
      <span>{home}</span>
    </a>
  );
}
