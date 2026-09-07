"use client";

import Link from "next/link";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";
import { scrollToElement } from "@/lib/scroll";
import { ContactCycleButton, TimeWeatherWidget } from "./chrome";

const navigation = siteConfig.navigation.filter((item) => {
  if (item.demoOnly && !siteConfig.features.demoRoutes) return false;
  if (item.sectionId === "about") return siteConfig.features.about;
  if (item.sectionId === "work") return siteConfig.features.work;
  if (item.sectionId === "photography") return siteConfig.features.photography;
  return true;
});

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
  const [compact, setCompact] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const activeRef = useRef<string | null>(null);
  const compactRef = useRef(false);

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
    if (dismissed) return;

    const sections = navigation
      .filter((item) => item.sectionId)
      .map((item) => {
        const id = item.sectionId as string;
        const element = document.getElementById(id);
        return element ? { id, element } : null;
      })
      .filter(Boolean) as { id: string; element: HTMLElement }[];
    const sectionIds = new Map<Element, string>(
      sections.map(({ id, element }) => [element, id]),
    );
    const ratios = new Map<string, number>();

    const updateCompact = () => {
      const next = window.scrollY > 96;
      if (next === compactRef.current) return;
      compactRef.current = next;
      setCompact(next);
    };

    const updateActive = (next: string | null) => {
      if (next === activeRef.current) return;
      activeRef.current = next;
      setActive(next);
    };

    const resolveActive = () => {
      updateCompact();

      if (window.scrollY < window.innerHeight * 0.9) {
        updateActive(null);
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

      updateActive(bestRatio > 0.1 || atBottom ? bestId : null);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = sectionIds.get(entry.target);
          if (id) ratios.set(id, entry.intersectionRatio);
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
    resolveActive();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [dismissed]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setOpen(false);
    const target = document.querySelector<HTMLElement>(id);
    if (!target) return;

    const nav = document.querySelector<HTMLElement>(".nav");
    const offset = nav ? nav.getBoundingClientRect().bottom + 24 : 98;
    scrollToElement(target, { offset: -offset, duration: 1.2 });
  };

  const dismiss = () => {
    setOpen(false);
    setDismissed(true);
  };

  if (dismissed) {
    return (
      <motion.button
        type="button"
        aria-label="Show navigation"
        title="Show navigation"
        onClick={() => setDismissed(false)}
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 20000,
          width: 40,
          height: 40,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          border: "1px solid",
          borderColor,
          backgroundColor,
          color,
          boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          cursor: "pointer",
        }}
      >
        <MenuGlyph size={18} />
      </motion.button>
    );
  }

  return (
    <>
      <motion.nav
        className="nav"
        style={{
          backgroundColor,
          borderColor,
          color,
          padding: compact ? "0.5rem 1rem" : "0.75rem 1.5rem",
          top: compact ? "1rem" : "1.5rem",
          left: "50%",
          x: "-50%",
          zIndex: 20000,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition:
            "top 180ms ease, padding 180ms ease, box-shadow 180ms ease",
        }}
      >
        <div
          className="nav-content"
          style={{
            gap: compact ? "1.5rem" : "3rem",
            transition: "gap 180ms ease",
          }}
        >
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
              {siteConfig.identity.initials}
            </Link>
            {siteConfig.features.weather && (
              <div className="nav-widgets">
                <TimeWeatherWidget />
              </div>
            )}
          </div>
          <div className="nav-links">
            {navigation.map((item) =>
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
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <MenuGlyph size={20} />}
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              flexShrink: 0,
            }}
          >
            <ContactCycleButton compact />
            <button
              type="button"
              className="cycle-btn-mobile-hide"
              aria-label="Hide navigation"
              title="Hide navigation"
              onClick={dismiss}
              style={{
                width: 30,
                height: 30,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
                padding: 0,
                border: "1px solid rgba(127,127,127,.16)",
                borderRadius: 999,
                background: "rgba(127,127,127,.08)",
                color: "inherit",
                opacity: 0.72,
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </motion.nav>
      <div
        className={`mobile-nav-overlay ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
      >
        <div className="mobile-nav-menu" onClick={(e) => e.stopPropagation()}>
          {navigation.map((item) =>
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
