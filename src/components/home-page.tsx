"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import {
  ContactFooter,
  DesignerCursors,
  GreetingToast,
  MainNav,
  OfflineScreen,
} from "./home-ui";
import { Hero } from "./home/hero-section";
import { NightAndSimple } from "./home/night-section";
import { Photography } from "./home/photography-section";
import { WorkSection } from "./home/work-section";
import { useLenis } from "@/hooks/use-lenis";
import { useMobileViewport } from "@/hooks/use-media-query";
import { scrollToPosition } from "@/lib/scroll";
import { siteConfig } from "@/config/site";

export function HomePage() {
  useLenis();
  const mobile = useMobileViewport();
  const nightRef = useRef<HTMLElement>(null);
  const photographyRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  type ScrollOptions = NonNullable<Parameters<typeof useScroll>[0]>;
  const nightOffset: ScrollOptions["offset"] = mobile
    ? ["start 90%", "end 10%"]
    : ["start 85%", "end 15%"];
  const revealOffset: ScrollOptions["offset"] = mobile
    ? ["start 100%", "start 20%"]
    : ["start 100%", "start 15%"];
  const { scrollYProgress: nightProgress } = useScroll({
    target: nightRef,
    offset: nightOffset,
  });
  const { scrollYProgress: photographyProgress } = useScroll({
    target: photographyRef,
    offset: revealOffset,
  });
  const { scrollYProgress: contactProgress } = useScroll({
    target: contactRef,
    offset: revealOffset,
  });

  const rawThemeProgress = useTransform(
    [nightProgress, photographyProgress, contactProgress],
    (values) => {
      const [night, photography, contact] = values as [number, number, number];
      const nightEnvelope =
        night < 0.3 ? night / 0.3 : night < 0.7 ? 1 : 1 - (night - 0.7) / 0.3;
      const photographyReveal = siteConfig.features.photography
        ? photography < 0.2
          ? photography / 0.2
          : 1
        : 0;
      const contactReveal = contact < 0.3 ? contact / 0.3 : 1;
      return contactReveal > 0
        ? photographyReveal * (1 - contactReveal)
        : Math.max(nightEnvelope, photographyReveal);
    },
  );
  const smoothThemeProgress = useSpring(rawThemeProgress, {
    stiffness: 150,
    damping: 22,
    mass: 0.5,
  });
  const themeProgress = useTransform(smoothThemeProgress, (value) =>
    Math.min(1, Math.max(0, value)),
  );
  const backgroundColor = useTransform(themeProgress, (value) => {
    const channel = Math.round(255 - 245 * value)
      .toString(16)
      .padStart(2, "0");
    return `#${channel}${channel}${channel}`;
  });
  const color = useTransform(themeProgress, (value) => {
    const channel = Math.round(17 + 238 * value)
      .toString(16)
      .padStart(2, "0");
    return `#${channel}${channel}${channel}`;
  });

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    let userInteracted = false;
    const markInteraction = () => {
      userInteracted = true;
    };
    const reset = () => {
      if (userInteracted) return;
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    reset();
    const frame = window.requestAnimationFrame(reset);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener("wheel", markInteraction, { passive: true, once: true });
    window.addEventListener("touchstart", markInteraction, { passive: true, once: true });
    window.addEventListener("pointerdown", markInteraction, { passive: true, once: true });
    window.addEventListener("keydown", markInteraction, { once: true });
    window.addEventListener("pageshow", onPageShow);

    const onLogoClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const logo = target?.closest<HTMLAnchorElement>("a.logo");
      if (!logo) return;
      const url = new URL(logo.href, window.location.origin);
      if (
        url.origin !== window.location.origin ||
        url.pathname !== "/" ||
        window.location.pathname !== "/"
      )
        return;
      event.preventDefault();
      scrollToPosition(0, { duration: 1.1 });
    };
    document.addEventListener("click", onLogoClick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("wheel", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("click", onLogoClick);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  return (
    <motion.div
      className="app"
      style={{
        backgroundColor,
        color,
        position: "relative",
      }}
    >
      <GreetingToast />
      <OfflineScreen />
      {!mobile && <DesignerCursors />}
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <MainNav themeProgress={themeProgress} />
      <Hero />
      <NightAndSimple sectionRef={nightRef} />
      {siteConfig.features.work && <WorkSection />}
      {siteConfig.features.photography && (
        <Photography sectionRef={photographyRef} />
      )}
      <div className="container">
        <ContactFooter sectionRef={contactRef} />
      </div>
    </motion.div>
  );
}
