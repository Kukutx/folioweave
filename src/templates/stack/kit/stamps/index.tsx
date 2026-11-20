"use client";

// Stamps — a collage of perforated stamps floating on the page (recordings 338 / 339).
//
//   <Stamps />                                    the six specimen stamps (content.ts)
//   <Stamps stamps={[{ id, src, aged?, label?, x, y, rot }]} onHover={(i) => ...} />
//
// The stamps drift slowly. Hovering (or focusing) one lifts it, blurs the others, pushes its
// neighbours out of the way, shows its name pill and dissolves the print into its aged version
// through a noise mask; it tilts in 3D toward the pointer. Drag a stamp to move it (arrow keys move
// a focused one). Click (Enter) flies it to the centre of a dark lightbox where it keeps tilting under
// a soft light; click anywhere or press Esc to close.
//
// Self-contained (React only). Sizes from its container: the design stage scales to the container
// width. Colours: --ink / --paper (name pill), --stamps-night (lightbox), --stamps-shadow.

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { BOX, CLOSE_HINT, STAGE, STAMPS, type Stamp } from "./content";
import { StampFace, perforationMask } from "./paper";
import s from "./stamps.module.css";

export type { Stamp } from "./content";
export type { StampArt, StampArtProps } from "./paper";
export { StampFace, perforation, perforationMask } from "./paper";

export type StampsProps = {
  stamps?: Stamp[];
  /** Design stage the stamp positions refer to. */
  stage?: { w: number; h: number };
  /** Stamp size on the stage. */
  box?: { w: number; h: number };
  closeHint?: string;
  /** Largest scale of the stage (1 = design size). */
  maxScale?: number;
  onHover?: (index: number) => void;
  onOpen?: (index: number) => void;
  className?: string;
  style?: CSSProperties;
};

// dissolve mask: feTurbulence alpha quantiles (fractalNoise, 2 octaves) at the shares in NQ_P, so a
// threshold θ(m) reveals a share m of the aged print; mask alpha = NK·(n − θ) + .5  (from 338)
const NQ_P = [0, 0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98, 1];
const NQ = [0.141, 0.267, 0.345, 0.42, 0.502, 0.584, 0.659, 0.737, 0.882];
const NK = 12;
const theta = (m: number) => {
  if (m <= 0) return 1 + 1 / NK;
  if (m >= 1) return -1 / NK;
  const p = 1 - m;
  let i = 0;
  while (i < NQ_P.length - 2 && NQ_P[i + 1] < p) i++;
  return (
    NQ[i] + ((NQ[i + 1] - NQ[i]) * (p - NQ_P[i])) / (NQ_P[i + 1] - NQ_P[i])
  );
};

// the lifted stamp grows and settles a little lower; while it is pressed (before a click opens it)
// it slides back up and a little left, as recorded
const HOVER = {
  scale: 0.053,
  drag: 0.07,
  shift: { x: -0.77, y: 3.29 },
  pressed: { x: -1.5, y: -0.1 },
  blur: 8,
  push: 36,
  pushNear: 330,
  pushFar: 430,
};
const DISSOLVE = { delay: 0.13, dur: 0.16, back: 0.22 };
// the dissolve is drawn once at a few shares and cross-faded (opacity only, no filter per frame):
// each print reveals more of the aged print through the same noise than the one under it
const STAGES = [0.3, 0.62, 1];
const stageOpacity = (m: number, k: number) => {
  const lo = k ? STAGES[k - 1] : 0;
  return Math.max(0, Math.min(1, (m - lo) / (STAGES[k] - lo)));
};
const TILT = { k: 0.085, max: 13, persp: 900 };

/** A drift for a stamp that brings none: gentle swings, out of step from stamp to stamp. */
const madeUpDrift = (i: number): NonNullable<Stamp["drift"]> => ({
  x: [3.2, 7.3, ((i * 1.7 + 0.3) / (2 * Math.PI)) * 7.3],
  y: [4.4, 9.1, ((i * 2.3 + 1.1) / (2 * Math.PI)) * 9.1],
  r: [0.7, 11.7, ((i * 0.9 + 2.2) / (2 * Math.PI)) * 11.7],
});

/** The drift's swings as custom properties of the stamp's drift layers. The stamp is turned by
 *  `rot`, so a swing along the page's x or y moves along these directions in its own frame. */
function driftStyle(st: Stamp, i: number): CSSProperties {
  const { x, y, r } = st.drift ?? madeUpDrift(i);
  const t = (st.rot * Math.PI) / 180;
  const c = Math.cos(t),
    sn = Math.sin(t);
  const n = (v: number) => +v.toFixed(3);
  return {
    "--xa": n(x[0] * c),
    "--xb": n(-x[0] * sn),
    "--xp": x[1],
    "--xo": x[2],
    "--ya": n(y[0] * sn),
    "--yb": n(y[0] * c),
    "--yp": y[1],
    "--yo": y[2],
    "--ra": r[0],
    "--rp": r[1],
    "--ro": r[2],
  } as CSSProperties;
}
const TAU = { lift: 0.06, push: 0.16, blur: 0.11, tilt: 0.12, press: 0.09 };
const FLY_OPEN = { ms: 640, ease: "cubic-bezier(0.32, 1.32, 0.42, 1)" };
const FLY_CLOSE = { ms: 420, ease: "cubic-bezier(0.45, 0, 0.2, 1)" };

type Live = {
  ox: number;
  oy: number; // drag offset (stage units)
  lift: number;
  drag: number;
  held: number; // pressed, not yet dragged
  px: number;
  py: number;
  blur: number;
  ta: number;
  tb: number;
  a: number;
  b: number; // tilt target / current
  m: number;
  hoverT: number; // dissolve share, time hovered
};

/** A stamp at rest: on its place, not lifted, dragged, blurred or dissolved. */
const atRest = (): Live => ({
  ox: 0,
  oy: 0,
  lift: 0,
  drag: 0,
  held: 0,
  px: 0,
  py: 0,
  blur: 0,
  ta: 0,
  tb: 0,
  a: 0,
  b: 0,
  m: 0,
  hoverT: 0,
});

export function Stamps({
  stamps = STAMPS,
  stage = STAGE,
  box = BOX,
  closeHint = CLOSE_HINT,
  maxScale = 1,
  onHover,
  onOpen,
  className,
  style,
}: StampsProps) {
  const uid = useId().replace(/:/g, "");
  const root = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.6);
  const kRef = useRef(k);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  // per stamp: [face, out-of-focus copy, lift shadow] — the layers whose opacity the loop sets
  const layers = useRef<(HTMLElement | null)[][]>([]);
  const aged = useRef<(SVGSVGElement | null)[]>([]);
  const pill = useRef<HTMLSpanElement>(null);
  const pillDrift = useRef<HTMLSpanElement>(null);
  const [pillText, setPillText] = useState("");
  const hv = useRef(-1);
  const dg = useRef(-1);
  const order = useRef<number[]>(stamps.map((_, i) => i));
  const live = useRef<Live[]>(stamps.map(atRest));
  const dialog = useRef<HTMLDialogElement>(null);
  const big = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const glare = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(-1);
  const openRef = useRef(-1);
  const closing = useRef(false);
  const byKey = useRef(false);
  const wakeRef = useRef<() => void>(() => {});
  const press = useRef<{
    i: number;
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const onHoverRef = useRef(onHover);
  useLayoutEffect(() => {
    onHoverRef.current = onHover;
  });

  // a new set of stamps starts from rest, in its own stacking order
  useLayoutEffect(() => {
    if (live.current.length === stamps.length) return;
    live.current = stamps.map(atRest);
    order.current = stamps.map((_, i) => i);
  }, [stamps]);

  // scale the stage to the container
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const v = Math.min(maxScale, e.contentRect.width / stage.w);
      kRef.current = v;
      setK(v);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage.w, maxScale]);

  // the frame loop: drift, lift, push, blur, tilt, dissolve, pill
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        // off screen the drift (a CSS animation) pauses too
        root.current?.toggleAttribute("data-off", !visible);
        if (visible) wakeRef.current();
      },
      { rootMargin: "100px" },
    );
    if (root.current) io.observe(root.current);
    let raf = 0;
    let last = performance.now();
    let moving = false;
    const ease = (v: number, to: number, tau: number, dt: number) => {
      if (reduced.matches) return to;
      const n = v + (to - v) * (1 - Math.exp(-dt / tau));
      if (Math.abs(to - n) > 1e-3) moving = true;
      return Math.abs(to - n) > 1e-3 ? n : to;
    };
    // the drift is a CSS animation; this loop runs only while a stamp is held, hovered or settling
    const loop = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      moving = hv.current >= 0 || dg.current >= 0;
      const t = now / 1000;
      const h = hv.current;
      const hs = h >= 0 ? stamps[h] : null;
      const hl = h >= 0 ? live.current[h] : null;
      stamps.forEach((st, i) => {
        const L = live.current[i];
        const el = els.current[i];
        if (!el) return;
        const lifted = i === h || i === dg.current;
        L.lift = ease(L.lift, lifted ? 1 : 0, TAU.lift, dt);
        L.drag = ease(L.drag, i === dg.current ? 1 : 0, TAU.lift, dt);
        const g = press.current;
        L.held = ease(L.held, g && g.i === i && !g.moved ? 1 : 0, TAU.press, dt);
        // near neighbours of the lifted stamp slide out of its way: up along their own turned frame,
        // as recorded (no turn); farther ones stay
        let tx = 0,
          ty = 0;
        if (hs && hl && i !== h && dg.current < 0) {
          const d = Math.hypot(st.x + L.ox - (hs.x + hl.ox), st.y + L.oy - (hs.y + hl.oy));
          const f = Math.max(0, Math.min(1, (HOVER.pushFar - d) / (HOVER.pushFar - HOVER.pushNear)));
          const r = (st.rot * Math.PI) / 180;
          tx = Math.sin(r) * HOVER.push * f;
          ty = -Math.cos(r) * HOVER.push * f;
        }
        L.px = ease(L.px, tx, TAU.push, dt);
        L.py = ease(L.py, ty, TAU.push, dt);
        L.blur = ease(
          L.blur,
          h >= 0 && i !== h && dg.current < 0 ? HOVER.blur : 0,
          TAU.blur,
          dt,
        );
        if (i !== h) {
          L.ta = 0;
          L.tb = 0;
        }
        L.a = ease(L.a, L.ta, TAU.tilt, dt);
        L.b = ease(L.b, L.tb, TAU.tilt, dt);
        // dissolve into the aged print
        if (st.aged) {
          const on = i === h && t - L.hoverT > DISSOLVE.delay;
          L.m = reduced.matches
            ? on
              ? 1
              : 0
            : Math.max(
                0,
                Math.min(
                  1,
                  L.m + (on ? dt / DISSOLVE.dur : -dt / DISSOLVE.back),
                ),
              );
          if (L.m > 0 && L.m < 1) moving = true;
          STAGES.forEach((_, k) => {
            const sv = aged.current[i * STAGES.length + k];
            if (sv) sv.style.opacity = stageOpacity(L.m, k).toFixed(3);
          });
        }
        const shx = HOVER.shift.x + (HOVER.pressed.x - HOVER.shift.x) * L.held;
        const shy = HOVER.shift.y + (HOVER.pressed.y - HOVER.shift.y) * L.held;
        const x = L.ox + L.px + shx * L.lift;
        const y = L.oy + L.py + shy * L.lift;
        const sc =
          1 + HOVER.scale * L.lift + (HOVER.drag - HOVER.scale) * L.drag;
        el.style.transform =
          `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${st.rot.toFixed(2)}deg) scale(${sc.toFixed(4)}) ` +
          `perspective(${TILT.persp}px) rotateX(${L.a.toFixed(2)}deg) rotateY(${L.b.toFixed(2)}deg)`;
        // out of focus: a cross-fade to a copy blurred once, never an animated filter
        const f = L.blur / HOVER.blur;
        const [face, soft, lifted2] = layers.current[i] ?? [];
        if (soft) soft.style.opacity = f.toFixed(3);
        if (face) face.style.opacity = (1 - f * f * f).toFixed(3);
        if (lifted2) lifted2.style.opacity = L.lift.toFixed(3);
      });
      // the name pill rides above the lifted stamp's top edge
      const p = pill.current;
      if (p && hs && hl) {
        const r = (hs.rot * Math.PI) / 180;
        const halfH =
          (box.w * Math.abs(Math.sin(r)) + box.h * Math.abs(Math.cos(r))) / 2;
        // (its wrapper drifts with the stamp; see pillDrift)
        const x = hs.x + hl.ox + HOVER.shift.x * hl.lift;
        const y = hs.y + hl.oy + HOVER.shift.y * hl.lift - halfH * (1 + HOVER.scale * hl.lift) - 12.4;
        // moved by its translate (composited), never by left/top (layout)
        p.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      }
      if (moving) raf = requestAnimationFrame(loop);
    };
    wakeRef.current = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      wakeRef.current = () => {};
    };
  }, [stamps, box.w, box.h]);

  const setHover = (i: number) => {
    if (i === hv.current) return;
    hv.current = i;
    wakeRef.current();
    if (i >= 0) {
      // eslint-disable-next-line react-hooks/purity -- setHover runs from pointer and focus handlers only
      live.current[i].hoverT = performance.now() / 1000;
      raise(i);
      onHoverRef.current?.(i);
    }
    const pd = pillDrift.current;
    if (i >= 0 && pd) {
      const { x, y } = stamps[i].drift ?? madeUpDrift(i);
      const v: [string, number][] = [["--xa", x[0]], ["--xp", x[1]], ["--xo", x[2]], ["--yb", y[0]], ["--yp", y[1]], ["--yo", y[2]]];
      v.forEach(([k, n]) => pd.style.setProperty(k, String(n)));
    }
    const lbl = i >= 0 ? (stamps[i].label ?? "") : "";
    if (lbl) setPillText(lbl);
    pill.current?.setAttribute("data-on", String(!!lbl && dg.current < 0));
  };

  const raise = (i: number) => {
    order.current = [...order.current.filter((j) => j !== i), i];
    order.current.forEach((j, z) => {
      const el = els.current[j];
      if (el) el.style.zIndex = String(z + 1);
    });
  };

  // ---- pointer: hover tilt, drag, click ----
  const toStage = (e: React.PointerEvent) => {
    const b = root.current!.getBoundingClientRect();
    return {
      x: (e.clientX - b.left) / kRef.current,
      y: (e.clientY - b.top) / kRef.current,
    };
  };
  const onMove = (e: React.PointerEvent, i: number) => {
    wakeRef.current();
    const L = live.current[i];
    const st = stamps[i];
    const p = toStage(e);
    const g = press.current;
    if (g && g.i === i) {
      const dx = (e.clientX - g.x) / kRef.current,
        dy = (e.clientY - g.y) / kRef.current;
      if (!g.moved && Math.hypot(dx, dy) > 5) {
        g.moved = true;
        dg.current = i;
        pill.current?.setAttribute("data-on", "false");
        els.current[i]?.setAttribute("data-drag", "");
      }
      if (g.moved) {
        const mx = box.w * 0.3,
          my = box.h * 0.3;
        L.ox = Math.max(mx - st.x, Math.min(stage.w - mx - st.x, g.ox + dx));
        L.oy = Math.max(my - st.y, Math.min(stage.h - my - st.y, g.oy + dy));
        L.ta = 0;
        L.tb = 0;
        return;
      }
    }
    if (
      hv.current !== i ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const cx = st.x + L.ox,
      cy = st.y + L.oy + box.h * 0.12;
    L.ta = Math.max(-TILT.max, Math.min(TILT.max, TILT.k * (cy - p.y)));
    L.tb = Math.max(-TILT.max, Math.min(TILT.max, TILT.k * (p.x - cx)));
  };
  const onDown = (e: React.PointerEvent<HTMLButtonElement>, i: number) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const L = live.current[i];
    press.current = {
      i,
      x: e.clientX,
      y: e.clientY,
      ox: L.ox,
      oy: L.oy,
      moved: false,
    };
    setHover(i);
  };
  const onUp = (e: React.PointerEvent<HTMLButtonElement>, i: number) => {
    const g = press.current;
    press.current = null;
    if (!g || g.i !== i) return;
    if (g.moved) {
      dg.current = -1;
      els.current[i]?.removeAttribute("data-drag");
      const inside = document.elementFromPoint(e.clientX, e.clientY);
      if (!els.current[i]?.contains(inside)) setHover(-1);
      else pill.current?.setAttribute("data-on", String(!!stamps[i].label));
    } else {
      byKey.current = false;
      openStamp(i);
    }
  };

  // ---- lightbox ----
  const flyFrom = (i: number) => {
    const el = els.current[i];
    const tg = big.current;
    if (!el || !tg) return null;
    const a = el.getBoundingClientRect();
    const b = tg.getBoundingClientRect();
    const L = live.current[i];
    const sc = (box.w * kRef.current * (1 + HOVER.scale * L.lift)) / b.width;
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    return `translate(${dx}px, ${dy}px) rotate(${stamps[i].rot}deg) scale(${sc})`;
  };
  const openStamp = (i: number) => {
    if (openRef.current >= 0) return;
    openRef.current = i;
    closing.current = false;
    setOpen(i);
    onOpen?.(i);
  };
  // after the lightbox content for `open` is rendered: show it and fly the stamp in
  useEffect(() => {
    const d = dialog.current;
    if (open < 0 || !d) return;
    if (!d.open) d.showModal();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const from = flyFrom(open);
    const el = els.current[open];
    if (el) el.style.visibility = "hidden";
    pill.current?.setAttribute("data-on", "false");
    hv.current = -1;
    night.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: reduced ? 1 : 380,
      easing: "ease-out",
      fill: "both",
    });
    if (from && !reduced)
      big.current?.animate([{ transform: from }, { transform: "none" }], {
        duration: FLY_OPEN.ms,
        easing: FLY_OPEN.ease,
        fill: "both",
      });
    else
      big.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200,
        fill: "both",
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closeBox = () => {
    const i = openRef.current;
    const d = dialog.current;
    if (i < 0 || !d || closing.current) return;
    closing.current = true;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const el = els.current[i];
    const to = flyFrom(i);
    const done = () => {
      if (el) el.style.visibility = "";
      big.current?.getAnimations().forEach((a) => a.cancel());
      night.current?.getAnimations().forEach((a) => a.cancel());
      d.close();
      // focus returns to the stamp; after a pointer open it should not stay lifted
      if (!byKey.current) {
        el?.blur();
        setHover(-1);
      }
      openRef.current = -1;
      closing.current = false;
      setOpen(-1);
    };
    night.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: reduced ? 1 : FLY_CLOSE.ms,
      easing: "ease-in",
      fill: "both",
    });
    const a =
      to && !reduced
        ? big.current?.animate([{ transform: "none" }, { transform: to }], {
            duration: FLY_CLOSE.ms,
            easing: FLY_CLOSE.ease,
            fill: "both",
          })
        : big.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 160,
            fill: "both",
          });
    if (a) a.onfinish = done;
    else done();
  };

  const tiltBig = (e: React.PointerEvent) => {
    const b = big.current;
    if (
      !b ||
      closing.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const r = b.getBoundingClientRect();
    const nx = Math.max(
      -1,
      Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)),
    );
    const ny = Math.max(
      -1,
      Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9)),
    );
    // written to the two moving layers themselves, so nothing inside the print is restyled
    const t = tilt.current;
    if (t) t.style.transform = `perspective(1100px) rotateX(${(-ny * 11).toFixed(2)}deg) rotateY(${(nx * 13).toFixed(2)}deg)`;
    // the light sits at (50 + 42·n)% of the print; its layer is twice the print's size
    glare.current?.style.setProperty("--tx", `${(nx * 21).toFixed(1)}%`);
    glare.current?.style.setProperty("--ty", `${(ny * 21).toFixed(1)}%`);
  };

  const shown = open >= 0 ? stamps[open] : null;
  const glareMask = shown
    ? shown.aged || (!shown.art && shown.src)
      ? `url(${shown.aged ?? shown.src})`
      : perforationMask(box.w, box.h)
    : undefined;
  const layer = (i: number, j: number) => (el: HTMLElement | null) => {
    (layers.current[i] ??= [])[j] = el;
  };

  return (
    <div
      ref={root}
      className={`${s.root} ${className ?? ""}`}
      style={{ height: stage.h * k, ...style }}
    >
      <div
        className={s.stage}
        style={{ width: stage.w, height: stage.h, transform: `scale(${k})` }}
      >
        {stamps.map((st, i) => (
          <button
            key={st.id}
            ref={(el) => {
              els.current[i] = el;
            }}
            type="button"
            className={s.stamp}
            style={{
              left: st.x - box.w / 2,
              top: st.y - box.h / 2,
              width: box.w,
              height: box.h,
              zIndex: i + 1,
            }}
            aria-label={st.alt ?? st.label ?? st.id}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => !press.current && setHover(-1)}
            onPointerMove={(e) => onMove(e, i)}
            onPointerDown={(e) => onDown(e, i)}
            onPointerUp={(e) => onUp(e, i)}
            onPointerCancel={() => {
              press.current = null;
              dg.current = -1;
            }}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(-1)}
            onKeyDown={(e) => {
              const L = live.current[i];
              const step = e.shiftKey ? 40 : 12;
              wakeRef.current();
              if (e.key === "Enter" || e.key === " ") {
                byKey.current = true;
                openStamp(i);
              } else if (e.key === "ArrowLeft") L.ox -= step;
              else if (e.key === "ArrowRight") L.ox += step;
              else if (e.key === "ArrowUp") L.oy -= step;
              else if (e.key === "ArrowDown") L.oy += step;
              else return;
              e.preventDefault();
            }}
          >
            <span className={s.drift} style={driftStyle(st, i)}>
              <span className={s.driftY}>
                <span className={s.lifted} ref={layer(i, 2)} />
                <span className={s.face} ref={layer(i, 0)}>
                  <StampFace art={st.art} src={st.src} paper={st.paper} w={box.w} h={box.h} seed={i + 3} />
                </span>
                {/* the same stamp blurred once (a lighter drawing: the grain would vanish anyway) */}
                <span className={s.soft} ref={layer(i, 1)}>
                  <StampFace art={st.art} src={st.src} paper={st.paper} w={box.w} h={box.h} lite />
                </span>
                {st.aged &&
                  STAGES.map((m, k) => (
                    <svg
                      key={k}
                      ref={(el) => {
                        aged.current[i * STAGES.length + k] = el;
                      }}
                      className={s.aged}
                      viewBox={`0 0 ${box.w} ${box.h}`}
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      {m < 1 && (
                        <filter
                          id={`${uid}d${i}-${k}`}
                          filterUnits="userSpaceOnUse"
                          x="0"
                          y="0"
                          width={box.w}
                          height={box.h}
                        >
                          <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed={7 + i} result="n" />
                          <feColorMatrix
                            in="n"
                            type="matrix"
                            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                            result="a"
                          />
                          <feComponentTransfer in="a" result="m">
                            <feFuncA type="linear" slope={NK} intercept={0.5 - NK * theta(m)} />
                          </feComponentTransfer>
                          <feComposite in="SourceGraphic" in2="m" operator="in" />
                        </filter>
                      )}
                      <image
                        href={st.aged}
                        x="0"
                        y="0"
                        width={box.w}
                        height={box.h}
                        preserveAspectRatio="none"
                        filter={m < 1 ? `url(#${uid}d${i}-${k})` : undefined}
                      />
                    </svg>
                  ))}
              </span>
            </span>
          </button>
        ))}
        {/* the pill drifts along with the stamp it names (the same swings, along the page's axes) */}
        <span ref={pillDrift} className={s.pillDrift} aria-hidden>
          <span className={s.pillDriftY}>
            <span ref={pill} className={s.pill} data-on="false">
              {pillText}
            </span>
          </span>
        </span>
      </div>

      {shown && (
        <dialog
          ref={dialog}
          className={s.box}
          aria-label={shown.alt ?? shown.label ?? shown.id}
          onCancel={(e) => {
            e.preventDefault();
            closeBox();
          }}
          onClick={closeBox}
          onPointerMove={tiltBig}
        >
          <div ref={night} className={s.night} />
          <div ref={big} className={s.big}>
            <div ref={tilt} className={s.tilt}>
              <div className={s.print}>
                {shown.aged ? (
                  <img src={shown.aged} alt={shown.alt ?? shown.label ?? ""} draggable={false} />
                ) : (
                  <StampFace
                    art={shown.art}
                    src={shown.src}
                    paper={shown.paper}
                    w={box.w}
                    h={box.h}
                    seed={open + 3}
                    title={shown.alt ?? shown.label ?? shown.id}
                  />
                )}
              </div>
              <div
                ref={glare}
                className={s.glare}
                style={{ maskImage: glareMask, WebkitMaskImage: glareMask }}
              />
            </div>
          </div>
          <p className={s.hint}>{closeHint}</p>
        </dialog>
      )}
    </div>
  );
}

export default Stamps;
