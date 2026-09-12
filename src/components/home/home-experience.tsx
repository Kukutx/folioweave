"use client";

import {
  MotionConfig,
  motion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { MainNav } from "./navigation";
import { FloatingHomeButton } from "./floating-home-button";
import { GreetingToast, OfflineScreen } from "./chrome";
import { DesignerCursors } from "./designer-cursors";
import { useLenis } from "@/hooks/use-lenis";
import { useMediaQuery, useMobileViewport } from "@/hooks/use-media-query";
import { siteConfig } from "@/config/site";
import styles from "./home-experience.module.css";
import { HomeForeground } from "./theme-scope";

function useSectionRef(id: string) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    ref.current = document.getElementById(id);
    return () => {
      ref.current = null;
    };
  }, [id]);
  return ref;
}

export function HomeExperience({ children }: { children: ReactNode }) {
  useLenis();
  const mobile = useMobileViewport();
  const desktop = useMediaQuery("(min-width: 768px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const nightRef = useSectionRef("interlude");
  const photographyRef = useSectionRef(
    siteConfig.features.photography ? "photography" : "contact",
  );
  const contactRef = useSectionRef("contact");
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
  const themeProgress = useTransform(
    [smoothThemeProgress, rawThemeProgress],
    (values) =>
      Math.min(1, Math.max(0, values[reducedMotion ? 1 : 0] as number)),
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
  return (
    <MotionConfig reducedMotion="user">
      <motion.div className={`app ${styles.root}`} style={{ backgroundColor }}>
        <GreetingToast />
        <OfflineScreen />
        {desktop && !reducedMotion && <DesignerCursors />}
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <MainNav themeProgress={themeProgress} />
        <FloatingHomeButton themeProgress={themeProgress} />
        <HomeForeground value={color}>{children}</HomeForeground>
      </motion.div>
    </MotionConfig>
  );
}
