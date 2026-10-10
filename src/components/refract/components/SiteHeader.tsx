"use client";

import { useRefractData } from "../data-context";

import { sceneLayout } from "@/components/refract/lib/scene-progress";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { animate, createDraggable } from "animejs";
import { FeaturedLinkMark, featuredLinkTarget } from "./FeaturedLink";

const navigationPaths: Record<string, string> = {
  About:
    "M8 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3ZM10 5v14",
  Research: "M4 18C14 18 10 6 20 6",
  News: "M5 6h14v12H5ZM8 9h3v3H8ZM14 9h2M14 12h2M8 15h8",
  Tools: "m12 4 8 5v6l-8 5-8-5V9ZM4 9l8 5 8-5M12 14v6M12 4v6",
  CV: "M7 4h7l4 4v12H7ZM14 4v5h4M10 13h5M10 16h5",
  Contact: "M4 6h16v12H4ZM4 6l8 7 8-7",
};

export function SiteHeader() {
  const { copy, profile, sections, siteConfig } = useRefractData();
  // The pane offers the tile's link; a placeholder leads nowhere and stays out.
  const featured = siteConfig.hero.featuredLink?.href
    ? siteConfig.hero.featuredLink
    : null;
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const drawer = useRef<ReturnType<typeof createDraggable> | null>(null);
  const motion = useRef<ReturnType<typeof animate> | null>(null);
  const unlock = useRef<() => void>(() => {});

  useEffect(() => {
    const element = menu.current!,
      container = header.current!;
    const breakpoint = matchMedia(sceneLayout.menuQuery);
    const setup = () => {
      motion.current?.pause();
      drawer.current?.revert();
      drawer.current = null;
      setOpen(false);
      element.style.removeProperty("width");
      element.style.removeProperty("--menu-width");
      element.style.removeProperty("visibility");
      container.style.setProperty("--menu-progress", "0");
      if (!breakpoint.matches) {
        element.inert = false;
        return;
      }
      // As wide as its longest label, in whole pixels so no label is clipped
      // by a fraction, and short of covering the page behind it.
      const width = Math.min(
        Math.ceil(element.getBoundingClientRect().width) + 1,
        innerWidth - 56,
      );
      let dragged = false;
      // The reference doubles its intrinsic panel width and exposes one half.
      element.style.setProperty("--menu-width", `${width}px`);
      element.style.width = `${width * 2}px`;
      drawer.current = createDraggable(element, {
        container: [0, width * 2, innerHeight, width],
        x: { snap: width },
        y: false,
        velocityMultiplier: 4,
        minVelocity: 2,
        onGrab: () => {
          dragged = true;
          motion.current?.pause();
        },
        onUpdate: (drag) => {
          const amount = Math.max(0, Math.min(1, 1 - drag.progressX));
          container.style.setProperty("--menu-progress", String(amount));
          element.style.visibility = amount > 0.001 ? "visible" : "hidden";
          element.inert = amount < 0.001;
          if (dragged && amount < 0.001) {
            dragged = false;
            setOpen(false);
          }
        },
        onSettle: (drag) => {
          dragged = false;
          if (drag.progressX > 0.99) setOpen(false);
        },
      });
      drawer.current.progressX = 1;
      element.inert = true;
    };
    setup();
    breakpoint.addEventListener("change", setup);
    return () => {
      breakpoint.removeEventListener("change", setup);
      motion.current?.pause();
      drawer.current?.revert();
    };
  }, []);

  useEffect(() => {
    if (!drawer.current) return;
    motion.current?.pause();
    motion.current = animate(drawer.current, {
      progressX: open ? 0 : 1,
      duration: matchMedia(sceneLayout.reducedQuery).matches
        ? 0
        : open
          ? 500
          : 250,
      ease: open ? "outElastic(.75, 1.25)" : "inOut(2.5)",
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const y = scrollY;
    const rootStyle = document.documentElement.style,
      bodyStyle = document.body.style;
    const saved = {
      overflow: rootStyle.overflow,
      position: bodyStyle.position,
      top: bodyStyle.top,
      width: bodyStyle.width,
    };
    rootStyle.overflow = "hidden";
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${y}px`;
    bodyStyle.width = "100%";
    let locked = true;
    const restore = () => {
      if (!locked) return;
      locked = false;
      rootStyle.overflow = saved.overflow;
      bodyStyle.position = saved.position;
      bodyStyle.top = saved.top;
      bodyStyle.width = saved.width;
      window.scrollTo({ top: y, behavior: "instant" });
    };
    unlock.current = restore;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
      if (event.key === "Tab") {
        const items = [
          toggle.current!,
          ...menu.current!.querySelectorAll<HTMLAnchorElement>("a"),
        ];
        const index = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && index === items.length - 1) {
          event.preventDefault();
          items[0].focus();
        }
      }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close, { passive: true });
    return () => {
      restore();
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !open ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (!event.currentTarget.hash) {
      unlock.current();
      setOpen(false);
      return;
    }
    event.preventDefault();
    const hash = event.currentTarget.hash;
    unlock.current();
    setOpen(false);
    history.pushState(null, "", hash);
    const target = document.getElementById(hash.slice(1));
    if (target) {
      target.scrollIntoView({
        behavior: matchMedia(sceneLayout.reducedQuery).matches
          ? "instant"
          : "smooth",
      });
      // The closing pane becomes inert. Continue keyboard reading at the
      // destination instead of dropping focus onto the document body.
      // Tools uses a decorative scroll anchor inside its content section.
      const destination = target.closest("section") ?? target;
      destination.tabIndex = -1;
      destination.focus({ preventScroll: true });
    }
  };

  return (
    <header className="site-header" ref={header} data-menu-open={open}>
      <a className="wordmark" href="#home" onClick={() => setOpen(false)}>
        {profile.name}
      </a>
      <button
        className="menu-backdrop"
        inert={!open}
        tabIndex={-1}
        aria-label={copy.closeNavigation}
        onClick={() => setOpen(false)}
      />
      <button
        ref={toggle}
        className="menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="main-navigation"
        aria-label={open ? copy.closeNavigation : copy.openNavigation}
        onClick={() => setOpen(!open)}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="4" y="12" width="16" height="1.75" />
          <rect x="4" y="12" width="16" height="1.75" />
        </svg>
      </button>
      <nav
        ref={menu}
        id="main-navigation"
        aria-label={copy.mainNavigation}
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget) &&
            event.relatedTarget !== toggle.current
          )
            setOpen(false);
        }}
      >
        {sections.map((item) => (
          <a key={item.href} href={item.href} onClick={navigate}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={navigationPaths[item.icon]} />
            </svg>
            <span>{item.label}</span>
          </a>
        ))}
        {featured && (
          <div className="menu-featured">
            <a
              href={featured.href}
              {...featuredLinkTarget(featured)}
              onClick={() => {
                unlock.current();
                setOpen(false);
              }}
            >
              <span>{featured.label}</span>
              <FeaturedLinkMark link={featured} />
            </a>
          </div>
        )}
      </nav>
      <noscript>
        <style>{`:where(.refract-site) .site-header .menu-toggle{display:none}@media(max-width:1199px){:where(.refract-site) .site-header{height:auto;flex-wrap:wrap}:where(.refract-site) .site-header #main-navigation{position:static;display:flex;flex-direction:row;flex-wrap:wrap;visibility:visible;opacity:1;pointer-events:auto;width:100%;height:auto;padding:0;border:0;transform:none}:where(.refract-site) .site-header #main-navigation a{min-height:44px;border:0;font-size:.7rem}:where(.refract-site) .site-header #main-navigation svg{display:none}}`}</style>
      </noscript>
    </header>
  );
}
