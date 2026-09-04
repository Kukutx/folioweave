"use client";

import Link from "next/link";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { scrollToElement } from "@/lib/scroll";
import { ContactCycleButton, TimeWeatherWidget } from "./chrome";

function MenuGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-menu"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

export function MainNav({
  themeProgress,
}: {
  themeProgress: MotionValue<number>;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const { scrollY } = useScroll();
  const paddingTarget = useTransform(
    scrollY,
    [0, 100],
    ["0.75rem 1.5rem", "0.5rem 1rem"],
  );
  const topTarget = useTransform(scrollY, [0, 100], ["1.5rem", "1rem"]);
  const gapTarget = useTransform(scrollY, [0, 100], ["3rem", "1.5rem"]);
  const navPadding = useSpring(paddingTarget, {
    stiffness: 150,
    damping: 30,
    mass: 0.5,
  });
  const navTop = useSpring(topTarget, { stiffness: 150, damping: 30, mass: 0.5 });
  const navGap = useSpring(gapTarget, { stiffness: 150, damping: 30, mass: 0.5 });
  const borderColor = useTransform(themeProgress, (value) => {
    const channel = Math.round(255 * value);
    const alpha = 0.08 + 0.07 * value;
    return `rgba(${channel}, ${channel}, ${channel}, ${alpha})`;
  });
  const backgroundColor = useTransform(themeProgress, (value) => {
    const channel = Math.round(255 - 235 * value);
    return `rgba(${channel}, ${channel}, ${channel}, 0.85)`;
  });
  const color = useTransform(themeProgress, (value) => {
    const channel = Math.round(17 + 238 * value)
      .toString(16)
      .padStart(2, "0");
    return `#${channel}${channel}${channel}`;
  });
  useEffect(() => {
    const sections = ["about", "work", "photography"]
      .map((id) => {
        const element = document.getElementById(id);
        return element ? { id, element } : null;
      })
      .filter(Boolean) as { id: string; element: HTMLElement }[];
    const ratios = new Map<string, number>();

    const resolveActive = () => {
      if (window.scrollY < window.innerHeight * 0.9) {
        setActive(null);
        return;
      }

      let bestRatio = 0;
      let bestId: string | null = null;
      ratios.forEach((ratio, id) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      });

      const atBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 100;
      if (atBottom) {
        const photography = document.getElementById("photography");
        if (photography) {
          const rect = photography.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            bestId = "photography";
          }
        }
      }

      setActive(bestRatio > 0.1 || atBottom ? bestId : null);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = sections.find(
            ({ element }) => element === entry.target,
          );
          if (section) ratios.set(section.id, entry.intersectionRatio);
        });
        resolveActive();
      },
      {
        threshold: [
          0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
        ],
        rootMargin: "-5% 0px -40% 0px",
      },
    );
    sections.forEach(({ element }) => observer.observe(element));

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        resolveActive();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setOpen(false);
    const target = document.querySelector<HTMLElement>(id);
    if (!target) return;

    const nav = document.querySelector<HTMLElement>(".nav");
    const offset = nav ? nav.getBoundingClientRect().bottom + 24 : 98;
    scrollToElement(target, { offset: -offset, duration: 1.2 });
  };
  return (
    <>
      <motion.nav
        className="nav"
        style={{
          backgroundColor,
          borderColor,
          color,
          padding: navPadding,
          top: navTop,
          left: "50%",
          x: "-50%",
          zIndex: 20000,
        }}
      >
        <motion.div className="nav-content" style={{ gap: navGap }}>
          <div
            className="nav-logo-group"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "nowrap",
              flexShrink: 0,
            }}
          >
            <Link href="/" className="logo">
              OG
            </Link>
            <div className="nav-widgets">
              <TimeWeatherWidget />
            </div>
          </div>
          <div className="nav-links">
            {siteConfig.navigation.map((item) =>
              item.sectionId ? (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(event) => go(event, item.href)}
                  className={active === item.sectionId ? "active" : ""}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  {...("newTab" in item && item.newTab
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>
          <button
            className={`mobile-menu-toggle ${open ? "open" : ""}`}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <MenuGlyph size={20} />}
          </button>
          <ContactCycleButton compact />
        </motion.div>
      </motion.nav>
      <div
        className={`mobile-nav-overlay ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
      >
        <div className="mobile-nav-menu" onClick={(e) => e.stopPropagation()}>
          {siteConfig.navigation.map((item) =>
            item.sectionId ? (
              <a
                key={item.href}
                href={item.href}
                onClick={(event) => go(event, item.href)}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                {...("newTab" in item && item.newTab
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </>
  );
}
