"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { PluginProps } from "@/core/contracts";
import { badgeCopy } from "./copy";
import { MiniFace } from "./mini-face";
import { MiniHardware } from "./mini-hardware";
import type { BadgeOptions } from "./options.generated";
import { loadLanyard } from "./lanyard/load";
import BadgeOverlay from "./overlay";
import { MAX_HANG, findSpot, footprintFor, pageObstacles } from "./placement";
import { badgeSettings, showsTrigger, type BadgeSettings } from "./settings";
import styles from "./trigger.module.css";

/** The address fragment that opens the badge (the manifest's action). */
const HASH = "badge";
const PULL_TO_OPEN = 34;
const PULL_MAX = 64;
/** Scrolled further than this, the strap retracts: the badge belongs to the
 * top of the page, and content scrolling under it would be covered. */
const AWAY_AFTER = 24;

const warmed = new Set<string>();
/** Fetch the cards' pictures with the scene, so they do not pop in. */
function warmImages(settings: BadgeSettings) {
  const { cards, strapImage } = settings.scene;
  for (const src of [
    ...cards.flatMap((card) => [card.frontImage, card.backImage, card.logo]),
    strapImage,
  ])
    if (src && !warmed.has(src)) {
      warmed.add(src);
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    }
}

/** The small badge's hardware in the scene's metal. */
const MINI_FINISH = { silver: "silver", gold: "gold", graphite: "black" } as const;

const emptySubscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function Badge({ options, context }: PluginProps<BadgeOptions>) {
  const settings = useMemo(() => badgeSettings(options), [options]);
  const text = badgeCopy(context.locale, settings.copy);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const pull = useRef<{ id: number; y: number; distance: number } | null>(null);
  const pulled = useRef(false);

  // On intent (hover, focus, press) the scene starts downloading, so it is
  // usually there by the time the badge opens.
  const prepare = useCallback(() => {
    warmImages(settings);
    void loadLanyard().catch(() => {});
  }, [settings]);

  // The overlay opens at once; the scene swings in as soon as it has loaded.
  const show = useCallback(() => {
    prepare();
    setOpen(true);
  }, [prepare]);

  // The small badge is retracted (and so cannot take focus) while the badge
  // is open; it gets focus back once it is shown again.
  const refocus = useRef(false);
  useEffect(() => {
    if (open || !refocus.current) return;
    refocus.current = false;
    if (document.activeElement === document.body || !document.activeElement)
      trigger.current?.focus({ preventScroll: true });
  }, [open]);

  const hide = useCallback(() => {
    refocus.current = true;
    setOpen(false);
    if (location.hash === `#${HASH}`)
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
  }, []);

  // https://site/#badge opens the badge on arrival and whenever a link sets
  // the hash.
  useEffect(() => {
    const check = () => {
      if (location.hash === `#${HASH}`) show();
    };
    check();
    window.addEventListener("hashchange", check);
    window.addEventListener("popstate", check);
    return () => {
      window.removeEventListener("hashchange", check);
      window.removeEventListener("popstate", check);
    };
  }, [show]);

  const visible = showsTrigger(settings.trigger.show, pathname);
  const side = settings.trigger.side;
  const extra = settings.trigger.offsetTop ?? 0;

  // Find a free column near the top, again when the page settles, fonts
  // arrive or the viewport changes; retract while the page is scrolled.
  useEffect(() => {
    const element = root.current;
    if (!visible || !element) return;
    let timer = 0;
    const place = () => {
      if (window.scrollY > AWAY_AFTER) return;
      const start = performance.now();
      const footprint = footprintFor(window.innerWidth);
      const spot = findSpot(
        pageObstacles(MAX_HANG + extra + footprint.height + 16, side),
        { width: window.innerWidth, height: window.innerHeight },
        side,
        extra,
        footprint,
      );
      performance.measure("badge:placement", { start });
      if (!spot) {
        element.dataset.room = "none";
        return;
      }
      delete element.dataset.room;
      element.style.setProperty("--badge-inline", `${spot.inset - 32}px`);
      element.style.setProperty("--badge-strap", `${spot.hang}px`);
      element.dataset.placed = "";
    };
    const later = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(place, delay);
    };
    let away = false;
    const onScroll = () => {
      const next = window.scrollY > AWAY_AFTER;
      if (next === away) return;
      away = next;
      if (away) element.dataset.away = "";
      else {
        delete element.dataset.away;
        later(120);
      }
    };
    const onResize = () => later(150);
    const frame = requestAnimationFrame(place);
    // Again as the page settles: late fonts, images, and passing notices
    // (a greeting toast) that cover the top for a few seconds.
    const settled = [600, 1600, 3200, 6000, 10000].map((delay) =>
      window.setTimeout(place, delay),
    );
    void document.fonts?.ready.then(() => later(0));
    window.addEventListener("load", onResize);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      settled.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(timer);
      window.removeEventListener("load", onResize);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, [visible, side, extra, pathname]);

  const setPull = (distance: number) =>
    root.current?.style.setProperty("--badge-pull", `${distance}px`);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    prepare();
    if (event.button !== 0) return;
    pulled.current = false;
    pull.current = { id: event.pointerId, y: event.clientY, distance: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = pull.current;
    if (!current || current.id !== event.pointerId) return;
    current.distance = Math.max(0, event.clientY - current.y);
    if (current.distance > 4) root.current?.setAttribute("data-pulling", "");
    // Rubber band: the strap gives less the further it is pulled.
    setPull(PULL_MAX * (1 - Math.exp(-current.distance / PULL_MAX)));
  };
  const endPull = (event: PointerEvent<HTMLButtonElement>) => {
    const current = pull.current;
    if (!current || current.id !== event.pointerId) return;
    pull.current = null;
    root.current?.removeAttribute("data-pulling");
    setPull(0);
    if (current.distance > 4) pulled.current = true;
    if (current.distance >= PULL_TO_OPEN) show();
  };

  const card = settings.scene.cards[0];
  const style = {
    "--badge-strap-color": settings.scene.strapColor,
  } as CSSProperties;

  return (
    <>
      {visible ? (
        <div
          ref={root}
          data-plugin="badge"
          data-side={settings.trigger.side}
          data-open={open || undefined}
          className={styles.root}
          style={style}
        >
          <div className={styles.swing}>
            <svg
              className={styles.ribbons}
              viewBox="0 0 30 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M3 0 L13 100 M27 0 L17 100"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className={styles.hang}>
              <span className={styles.hardware}>
                <MiniHardware
                  id="badge-mini"
                  finish={MINI_FINISH[settings.scene.metal]}
                  strap={settings.scene.strapColor}
                />
              </span>
              <button
                ref={trigger}
                type="button"
                className={styles.trigger}
                aria-label={settings.trigger.label ?? text.open}
                aria-haspopup="dialog"
                aria-expanded={open}
                onPointerEnter={prepare}
                onFocus={prepare}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPull}
                onPointerCancel={endPull}
                onClick={() => {
                  if (pulled.current) pulled.current = false;
                  else show();
                }}
              >
                <span
                  className={styles.mini}
                  style={{ backgroundColor: card.cardColor }}
                >
                  <MiniFace card={card} />
                  <span className={styles.miniHole} />
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {open ? (
        <BadgeOverlay
          settings={settings}
          text={text}
          onClose={hide}
          returnFocus={trigger}
        />
      ) : null}
    </>
  );
}

export default function BadgePlugin(props: PluginProps<BadgeOptions>) {
  const ready = useSyncExternalStore(emptySubscribe, clientReady, serverReady);
  // A body portal keeps the fixed trigger and the dialog clear of template
  // transforms and clipping.
  return ready ? createPortal(<Badge {...props} />, document.body) : null;
}
