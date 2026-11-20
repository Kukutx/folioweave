"use client";

// Pocket — a perforated paper pocket holding a few square prints (recording 343).
//
//   <Pocket />                                         the "digital art" pocket (content.ts)
//   <Pocket prints={[{ id, src, x, y, rot, fan, spread, open }]} label={{ title, tool, date }} />
//
// Grab the pocket and drag it: while held the outer prints fan out and the prints spread sideways in
// proportion to how fast the pocket moves (a spring driven by the drag speed); on release everything
// settles and the pocket glides back to its place. Click a print (or focus it and press Enter) and it
// grows into a large square in the middle of the window; click anywhere or press Esc to put it back.
//
// Self-contained (React only). Sizes from its container. Colours: --paper / --ink (the pocket's paper
// is mixed from them), --muted (its text).

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  FAN,
  FAN_FPS,
  LABEL,
  PERF,
  POCKET,
  PRINT,
  PRINTS,
  STAGE,
  type PocketPrint,
} from "./content";
import s from "./pocket.module.css";

export type { PocketPrint } from "./content";

export type PocketProps = {
  prints?: PocketPrint[];
  label?: { title?: string; tool?: string; date?: string };
  className?: string;
  style?: CSSProperties;
};

// sideways spread: damped spring whose target is k × the pocket's speed (px/s) one frame earlier
const SPREAD = { k: 0.02133, w: 9.84, z: 0.5458 };
// the pocket glides home after release
const HOME = { w: 11, z: 0.9 };
const OPEN = {
  ms: 294,
  closeMs: 208,
  ease: "cubic-bezier(0, 0.4066, 0.4377, 1)",
};

/** The pocket's outline, a rectangle with round holes punched along every edge, as a crisp vector mask. */
function perforation(w: number, h: number) {
  const { r, inset, x0, dx, nx, y0, dy, ny } = PERF;
  const c = (x: number, y: number) =>
    `<circle cx='${x.toFixed(2)}' cy='${y.toFixed(2)}' r='${r}'/>`;
  const holes: string[] = [];
  for (let i = 0; i < nx; i++)
    holes.push(c(x0 + i * dx, inset), c(x0 + i * dx, h - inset));
  for (let j = 0; j < ny; j++)
    holes.push(c(inset, y0 + j * dy), c(w - inset, y0 + j * dy));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><mask id='m'><rect width='${w}' height='${h}' fill='white'/><g fill='black'>${holes.join("")}</g></mask><rect width='${w}' height='${h}' mask='url(#m)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const POCKET_MASK = perforation(POCKET.w, POCKET.h);

const table = (tab: readonly number[], tau: number) => {
  const x = tau * FAN_FPS;
  if (x <= 0) return tab[0];
  if (x >= tab.length - 1) return tab[tab.length - 1];
  const i = Math.floor(x),
    f = x - i;
  return tab[i] + (tab[i + 1] - tab[i]) * f;
};

export function Pocket({
  prints = PRINTS,
  label = LABEL,
  className,
  style,
}: PocketProps) {
  const root = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  const [rw, setRw] = useState(STAGE.w);
  const kRef = useRef(1);
  const group = useRef<HTMLDivElement>(null);
  const pocket = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const big = useRef<HTMLImageElement>(null);
  const [open, setOpen] = useState(-1);
  // the enlarged-print layer is mounted the first time a print is opened
  const [used, setUsed] = useState(false);
  const openRef = useRef(-1);
  const busy = useRef(false);
  const st = useRef({
    D: { x: 0, y: 0, vx: 0, vy: 0 },
    grab: { x: 0, y: 0 },
    dragging: false,
    pressT: -1e9,
    releaseT: -1e9,
    releaseFan: 0,
    releaseLift: 0,
    sp: { s: 0, v: 0, px: 0, py: 0, speed: 0, prev: 0 },
    pressAt: { x: 0, y: 0 },
  });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const v = Math.min(1, e.contentRect.width / STAGE.w);
      kRef.current = v;
      setK(v);
      setRw(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const S = st.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fanAt = (t: number) => {
      if (reduced.matches) return { fan: 0, lift: 0 };
      if (S.dragging)
        return {
          fan: table(FAN.press, t - S.pressT),
          lift: table(FAN.lift, t - S.pressT),
        };
      const decay = table(FAN.release, t - S.releaseT) / FAN.release[0];
      return { fan: S.releaseFan * decay, lift: S.releaseLift * decay };
    };
    // the loop runs only while something moves: from a press until everything has settled again
    let raf = 0;
    let last = performance.now() / 1000;
    const wake = () => {
      if (raf) return;
      last = performance.now() / 1000;
      raf = requestAnimationFrame(loop);
    };
    const loop = () => {
      raf = 0;
      const t = performance.now() / 1000;
      const dt = Math.min(0.05, t - last);
      last = t;
      const D = S.D,
        sp = S.sp;
      // glide home when let go
      if (!S.dragging && (D.x || D.y || D.vx || D.vy)) {
        for (let j = 0; j < 4; j++) {
          const h = dt / 4;
          D.vx += (-HOME.w * HOME.w * D.x - 2 * HOME.z * HOME.w * D.vx) * h;
          D.vy += (-HOME.w * HOME.w * D.y - 2 * HOME.z * HOME.w * D.vy) * h;
          D.x += D.vx * h;
          D.y += D.vy * h;
        }
        if (
          Math.abs(D.x) + Math.abs(D.y) < 0.05 &&
          Math.abs(D.vx) + Math.abs(D.vy) < 0.5
        )
          D.x = D.y = D.vx = D.vy = 0;
        if (reduced.matches) D.x = D.y = D.vx = D.vy = 0;
      }
      if (dt > 0) {
        sp.prev = sp.speed;
        sp.speed = Math.hypot(D.x - sp.px, D.y - sp.py) / dt;
        sp.px = D.x;
        sp.py = D.y;
        const target = reduced.matches
          ? 0
          : SPREAD.k * (S.dragging ? sp.prev : 0);
        for (let j = 0; j < 8; j++) {
          const h = dt / 8;
          sp.v +=
            (SPREAD.w * SPREAD.w * (target - sp.s) -
              2 * SPREAD.z * SPREAD.w * sp.v) *
            h;
          sp.s += sp.v * h;
        }
      }
      if (group.current)
        group.current.style.transform = `translate(${D.x.toFixed(2)}px, ${D.y.toFixed(2)}px)`;
      const { fan, lift } = fanAt(t);
      prints.forEach((c, i) => {
        const el = cards.current[i];
        if (el)
          el.style.transform = `translate(${(c.spread * sp.s).toFixed(2)}px, ${lift.toFixed(2)}px) rotate(${(c.rot + c.fan * fan).toFixed(2)}deg)`;
      });
      const still =
        !S.dragging &&
        !D.x &&
        !D.y &&
        Math.abs(sp.s) < 0.01 &&
        Math.abs(sp.v) < 0.01 &&
        t - S.releaseT > FAN.release.length / FAN_FPS;
      if (!still) raf = requestAnimationFrame(loop);
    };

    const toStage = (e: PointerEvent) => ({
      x: e.clientX / kRef.current,
      y: e.clientY / kRef.current,
    });
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || openRef.current >= 0) return;
      pocket.current?.setPointerCapture(e.pointerId);
      const p = toStage(e);
      S.dragging = true;
      S.pressT = performance.now() / 1000;
      S.grab = { x: p.x - S.D.x, y: p.y - S.D.y };
      S.D.vx = S.D.vy = 0;
      root.current?.setAttribute("data-drag", "");
      wake();
    };
    const onMove = (e: PointerEvent) => {
      if (!S.dragging) return;
      const p = toStage(e);
      S.D.x = p.x - S.grab.x;
      S.D.y = p.y - S.grab.y;
    };
    const onUp = () => {
      if (!S.dragging) return;
      const f = fanAt(performance.now() / 1000);
      S.releaseFan = f.fan;
      S.releaseLift = f.lift;
      S.dragging = false;
      S.releaseT = performance.now() / 1000;
      root.current?.removeAttribute("data-drag");
      wake();
    };
    const pk = pocket.current!;
    pk.addEventListener("pointerdown", onDown);
    pk.addEventListener("pointermove", onMove, { passive: true });
    pk.addEventListener("pointerup", onUp);
    pk.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(raf);
      pk.removeEventListener("pointerdown", onDown);
      pk.removeEventListener("pointermove", onMove);
      pk.removeEventListener("pointerup", onUp);
      pk.removeEventListener("pointercancel", onUp);
    };
  }, [prints]);

  // the enlarged print flies out of (and back into) its card
  const cardPose = (i: number) => {
    const c = cards.current[i],
      b = big.current;
    if (!c || !b) return null;
    const a = c.getBoundingClientRect(); // rotated bounds: the centre is what matters
    const r = b.getBoundingClientRect();
    const m = new DOMMatrix(getComputedStyle(c).transform);
    const rot = (Math.atan2(m.b, m.a) * 180) / Math.PI;
    const sc = (PRINT * kRef.current) / r.width;
    return `translate(${a.left + a.width / 2 - (r.left + r.width / 2)}px, ${a.top + a.height / 2 - (r.top + r.height / 2)}px) rotate(${rot}deg) scale(${sc})`;
  };
  const openPrint = (i: number) => {
    if (openRef.current >= 0 || st.current.dragging) return;
    openRef.current = i;
    setUsed(true);
    setOpen(i);
  };
  useEffect(() => {
    const d = dialog.current;
    if (open < 0 || !d) return;
    if (!d.open) d.showModal();
    const from = cardPose(open);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const card = cards.current[open];
    card?.animate(
      [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }],
      { duration: reduced ? 1 : OPEN.ms, fill: "forwards" },
    );
    big.current?.animate(
      from && !reduced
        ? [
            { transform: from, opacity: 0 },
            { opacity: 1, offset: 0.5 },
            { transform: "none", opacity: 1 },
          ]
        : [{ opacity: 0 }, { opacity: 1 }],
      { duration: OPEN.ms, easing: OPEN.ease, fill: "both" },
    );
  }, [open]);
  const closePrint = () => {
    const i = openRef.current,
      d = dialog.current;
    if (i < 0 || !d || busy.current) return;
    busy.current = true;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const card = cards.current[i];
    const to = cardPose(i);
    card?.getAnimations().forEach((a) => a.cancel());
    card?.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }],
      { duration: reduced ? 1 : OPEN.closeMs },
    );
    const a = big.current?.animate(
      to && !reduced
        ? [
            { transform: "none", opacity: 1 },
            { opacity: 1, offset: 0.5 },
            { transform: to, opacity: 0 },
          ]
        : [{ opacity: 1 }, { opacity: 0 }],
      { duration: OPEN.closeMs, easing: OPEN.ease, fill: "both" },
    );
    const done = () => {
      d.close();
      openRef.current = -1;
      busy.current = false;
      setOpen(-1);
    };
    if (a) a.onfinish = done;
    else done();
  };

  const left = Math.max(0, (rw - STAGE.w * k) / 2);
  const shown = open >= 0 ? prints[open] : null;

  return (
    <div
      ref={root}
      className={`${s.root} ${className ?? ""}`}
      style={{ height: STAGE.h * k, ...style }}
    >
      <div
        className={s.stage}
        style={{
          width: STAGE.w,
          height: STAGE.h,
          left,
          transform: `scale(${k})`,
        }}
      >
        <div ref={group} className={s.group}>
          {prints.map((c, i) => (
            <button
              key={c.id}
              ref={(el) => {
                cards.current[i] = el;
              }}
              type="button"
              className={s.print}
              style={{
                left: c.x - PRINT / 2,
                top: c.y - PRINT / 2,
                width: PRINT,
                height: PRINT,
              }}
              aria-label={c.alt ?? c.id}
              onClick={() => openPrint(i)}
            >
              <img src={c.src} alt="" draggable={false} />
            </button>
          ))}
          <div
            ref={pocket}
            className={s.pocket}
            style={{
              left: POCKET.x,
              top: POCKET.y,
              width: POCKET.w,
              height: POCKET.h,
              WebkitMaskImage: POCKET_MASK,
              maskImage: POCKET_MASK,
            }}
          >
            <span className={s.title}>{label.title}</span>
            <span className={s.meta}>
              <span>{label.tool}</span>
              <span>{label.date}</span>
            </span>
          </div>
        </div>
      </div>
      {used && (
        <dialog
          ref={dialog}
          className={s.box}
          aria-label={shown ? (shown.alt ?? shown.id) : undefined}
          onCancel={(e) => {
            e.preventDefault();
            closePrint();
          }}
          onClick={closePrint}
        >
          {shown && (
            <img
              ref={big}
              className={s.big}
              src={shown.src}
              alt={shown.alt ?? ""}
              style={{ ["--size" as string]: `${shown.open}px` }}
              draggable={false}
            />
          )}
        </dialog>
      )}
    </div>
  );
}

export default Pocket;
