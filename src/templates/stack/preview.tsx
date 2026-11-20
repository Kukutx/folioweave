"use client";

// Links to projects float a preview of the site next to the cursor: a frosted pane appears first, the
// picture settles into it, and the pane lingers a moment after the cursor leaves (as recorded).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { Preview } from "./data";
import s from "./stack.module.css";

type PreviewApi = {
  show: (p: Preview, x: number, y: number, follow: boolean) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
};
const PreviewCtx = createContext<PreviewApi | null>(null);

const CARD_W = 237;
// the picture sits in the wallpaper with these margins (top, right, bottom, left), as recorded
const PAD = [17, 17, 16, 16];
const SHOT_W = CARD_W - PAD[1] - PAD[3];
// a phone screen stands upright in the wallpaper at this height; very wide pictures are cropped
const UPRIGHT_H = 180;
const WIDEST = 2;

/** Size of the picture inside the card. */
export function shotSize(q: Preview) {
  if (q.ratio >= 1) {
    const ratio = Math.min(q.ratio, WIDEST);
    return { w: SHOT_W, h: SHOT_W / ratio };
  }
  const h = Math.min(SHOT_W / q.ratio, UPRIGHT_H);
  return { w: h * q.ratio, h };
}
const height = (q: Preview) => PAD[0] + PAD[2] + shotSize(q).h;

function PreviewLayer({ apiRef }: { apiRef: { current: PreviewApi | null } }) {
  const box = useRef<HTMLDivElement>(null);
  const [p, setP] = useState<Preview | null>(null);
  // glass: frosted pane only · shown: picture in · leaving: picture out, pane fading
  const [phase, setPhase] = useState<"off" | "glass" | "shown" | "leaving">("off");
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const timer = useRef(0);

  const place = useCallback((x: number, y: number, q: Preview) => {
    const vw = document.documentElement.clientWidth;
    const h = height(q);
    // the card's bottom-left corner sits just right of and below the cursor tip; flip left near the edge
    let left = x + 20;
    if (left + CARD_W > vw - 8) left = Math.max(8, x - 20 - CARD_W);
    const top = Math.max(8, y + 14 - h);
    return { x: left, y: top };
  }, []);

  useEffect(() => {
    const step = () => {
      const el = box.current;
      raf.current = 0;
      if (!el) return;
      const t = target.current;
      const c = pos.current;
      c.x += (t.x - c.x) * 0.38;
      c.y += (t.y - c.y) * 0.38;
      if (Math.abs(t.x - c.x) < 0.3 && Math.abs(t.y - c.y) < 0.3) {
        c.x = t.x;
        c.y = t.y;
      } else raf.current = requestAnimationFrame(step);
      el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
    };
    const current = { p: null as Preview | null };
    apiRef.current = {
      show(q, x, y, follow) {
        clearTimeout(timer.current);
        current.p = q;
        const at = place(x, y, q);
        target.current = at;
        pos.current = { ...at };
        if (box.current) box.current.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
        box.current?.setAttribute("data-follow", String(follow));
        setP(q);
        setPhase("glass");
        // the frosted pane holds until the picture is ready (at least a beat, as recorded)
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const t0 = performance.now();
        const im = new Image();
        im.src = q.src;
        const ready = () => {
          if (current.p !== q) return;
          const wait = still ? 0 : Math.max(0, 300 - (performance.now() - t0));
          timer.current = window.setTimeout(() => setPhase("shown"), wait);
        };
        im.decode().then(ready, ready);
      },
      move(x, y) {
        if (!current.p) return;
        target.current = place(x, y, current.p);
        if (!raf.current) raf.current = requestAnimationFrame(step);
      },
      hide() {
        clearTimeout(timer.current);
        current.p = null;
        setPhase((ph) => (ph === "off" ? ph : "leaving"));
        timer.current = window.setTimeout(() => setPhase("off"), 700);
      },
    };
    return () => {
      clearTimeout(timer.current);
      cancelAnimationFrame(raf.current);
      apiRef.current = null;
    };
  }, [apiRef, place]);

  const shot = p ? shotSize(p) : null;
  return (
    <div ref={box} className={s.preview} data-phase={phase} aria-hidden="true">
      {p && shot && (
        <div className={s.previewCard} style={{ height: height(p) }}>
          <div className={s.wallpaper} />
          <div className={s.previewShot} style={{ width: shot.w, height: shot.h }}>
            <img src={p.src} alt="" />
          </div>
        </div>
      )}
    </div>
  );
}

/** One floating preview card for the whole page. */
export function PreviewProvider({ children }: { children: ReactNode }) {
  const api = useRef<PreviewApi | null>(null);
  const [proxy] = useState<PreviewApi>(() => ({
    show: (...a) => api.current?.show(...a),
    move: (...a) => api.current?.move(...a),
    hide: () => api.current?.hide(),
  }));
  return (
    <PreviewCtx.Provider value={proxy}>
      {children}
      <PreviewLayer apiRef={api} />
    </PreviewCtx.Provider>
  );
}

/** Handlers that make an element float a preview while it is hovered (mouse) or focused. */
function usePreviewLink(preview?: Preview | null) {
  const api = useContext(PreviewCtx);
  if (!preview || !api) return {};
  return {
    onPointerEnter: (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse") api.show(preview, e.clientX, e.clientY, true);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse") api.move(e.clientX, e.clientY);
    },
    onPointerLeave: (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse") api.hide();
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.matches(":focus-visible")) return;
      const r = e.currentTarget.getBoundingClientRect();
      // keyboard focus: the card floats just above the focused row, clear of its text
      api.show(preview, r.left + Math.min(r.width, 180), r.top - 18, false);
    },
    onBlur: () => api.hide(),
    // a click navigates away: drop the card so it is not left floating on return
    onClick: () => api.hide(),
  };
}

export function PreviewLink({
  preview,
  className,
  href,
  newTab,
  children,
}: {
  preview?: Preview | null;
  className?: string;
  href: string;
  newTab?: boolean;
  children: ReactNode;
}) {
  const bind = usePreviewLink(preview);
  const external = newTab ?? /^https?:\/\//.test(href);
  return (
    <a
      className={className}
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...bind}
    >
      {children}
    </a>
  );
}
