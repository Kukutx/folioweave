"use client";

// Small client islands of the page: the in-page navigation, the prints, the artwork (mounted when it
// comes near the viewport), the shuffle stack and the footer clock.

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { CardStack, type ImageCard } from "./kit/card-stack";
import { Pocket } from "./kit/pocket";
import { STAGE as POCKET_STAGE } from "./kit/pocket/content";
import { Stamps } from "./kit/stamps";
import { STAGE as STAMPS_STAGE } from "./kit/stamps/content";
import { useFit } from "./work";
import s from "./stack.module.css";

/** Without JavaScript the artwork never mounts: its held space closes up. */
export function NoScriptHolds() {
  return (
    <noscript>
      <style>{`.${s.hold}{display:none}`}</style>
    </noscript>
  );
}

/** In-page navigation scrolls smoothly (instantly when reduced motion is preferred). */
export function NavLinks({ nav }: { nav: { label: string; target: string }[] }) {
  const go = (e: ReactMouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <span className={s.navLinks}>
      {nav.map((n) => (
        <a key={n.target} href={`#${n.target}`} onClick={(e) => go(e, n.target)}>
          {n.label}
        </a>
      ))}
    </span>
  );
}

/** True once the element has come within `rootMargin` of the viewport. */
function useInView<T extends Element>(rootMargin = "0px") {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          // the render it sets off is cut into short slices instead of one long task
          startTransition(() => setOn(true));
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, on] as const;
}

/** Mounts its children once they come near the viewport; until then holds their space (w:h, max height). */
function Lazy({ ratio, max, className, children }: { ratio: number; max: number; className?: string; children: ReactNode }) {
  const [ref, on] = useInView<HTMLDivElement>("700px 0px");
  return (
    <div ref={ref} className={className}>
      {on ? children : <div className={s.hold} style={{ aspectRatio: ratio, maxHeight: max }} aria-hidden />}
    </div>
  );
}

/** The prints: a little wider than the column; on narrow screens the strip shrinks to fit, centred. */
export function Prints({ photos }: { photos: { src: string; alt: string }[] }) {
  const k = useFit(650, 4);
  const strip = useRef<HTMLDivElement>(null);
  const [colW, setColW] = useState(580);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setColW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={strip} className={s.photosBox} style={{ height: 247 * k }}>
      <div className={s.photos} style={k < 1 ? { transform: `translateX(${colW / 2 - 290 * k}px) scale(${k})` } : undefined}>
        {photos.map((p, i) => {
          const at = PRINTS[i];
          return (
            <figure
              key={p.src}
              style={{
                ["--r" as string]: `${at.r}deg`,
                ["--x" as string]: `${at.x}px`,
                ["--y" as string]: `${at.y}px`,
                zIndex: i + 1,
              }}
            >
              <img src={p.src} alt={p.alt} decoding="async" />
            </figure>
          );
        })}
      </div>
    </div>
  );
}
/** the prints, measured from the recording: left/top offset in the 580 px column, tilt in degrees */
const PRINTS = [
  { x: -36, y: 19, r: -1 },
  { x: 124, y: -1, r: 3.5 },
  { x: 285, y: 15, r: -3 },
  { x: 438, y: 10, r: 2.5 },
];

/** The artwork: prints tucked in their pocket, and the stamps. */
export function Art({ pocketLabel }: { pocketLabel?: { title?: string; tool?: string; date?: string } }) {
  return (
    <>
      <Lazy className={s.pocketBox} ratio={POCKET_STAGE.w / POCKET_STAGE.h} max={POCKET_STAGE.h}>
        <Pocket label={pocketLabel ? { ...DEFAULT_POCKET, ...pocketLabel } : undefined} />
      </Lazy>
      <Lazy className={s.stampsBox} ratio={STAMPS_STAGE.w / STAMPS_STAGE.h} max={STAMPS_STAGE.h}>
        <Stamps />
      </Lazy>
    </>
  );
}
const DEFAULT_POCKET = { title: "digital art", tool: "tool: procreate", date: "sep 2024" };

/** The shuffle stack under the fan: the projects' pictures as frosted cards on their grey surface. */
export function Shuffle({ cards }: { cards: ImageCard[] }) {
  return (
    <Lazy className={s.payBox} ratio={620 / 262} max={262}>
      <CardStack cards={cards} className={s.payStack} />
    </Lazy>
  );
}

/** The footer clock shows the author's local time; it ticks only while it is on screen. */
export function WallClock({ timeZone, locale }: { timeZone: string; locale: string }) {
  const [t, setT] = useState("");
  const ref = useRef<HTMLTimeElement>(null);
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen) return;
    let format: Intl.DateTimeFormat;
    try {
      format = new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h12",
        timeZoneName: "shortOffset",
      });
    } catch {
      return;
    }
    let id = 0;
    const tick = () => {
      const parts = Object.fromEntries(format.formatToParts(new Date()).map((p) => [p.type, p.value]));
      const hour = String(parts.hour).replace(/^0(?=\d)/, "");
      setT(`${hour}:${parts.minute}:${parts.second} ${parts.timeZoneName ?? ""}`.trim());
      // tick on whole seconds, like a wall clock
      id = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return () => clearTimeout(id);
  }, [timeZone, locale, seen]);
  return (
    <time ref={ref} suppressHydrationWarning>
      {t}
    </time>
  );
}
