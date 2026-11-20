"use client";

// The letter as it comes out of the envelope: folded in three, it unfolds its two flaps in 3D (each
// darkening while it turns), then fans out into a small stack of sheets; the highlighted phrase is
// redrawn left → right and the round close / previous / next buttons fade in. Paging shuffles the stack
// as recorded: on next the top sheet slides out to the right, turning, and is tucked back under the
// stack while the others move up (previous runs it backwards); the new top sheet redraws its highlight.
// A `bare` page (no paper of its own) is shown alone. Close calls onClose.
// Timing is the recorded one, in frames after the envelope's release (EnvelopeClock); outside an
// envelope the stack is simply open. The frame loop sleeps when nothing moves.
// Theme: --ink (buttons), --letter-paper, --letter-paper-hi / --letter-paper-lo.

import { startTransition, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EnvelopeClock } from "./clock";
import { stackLabels } from "./content";
import { bezier, clamp01, lerp, type Ease } from "./motion";
import s from "./stack.module.css";

export type StackPage = { content?: ReactNode; bare?: boolean };
export type LetterStackProps = {
  /** Pages from the top; the first one arrives folded in three. Missing sheets of the stack are blank. */
  pages: StackPage[];
  depth?: number;
  onClose?: () => void;
  labels?: Partial<typeof stackLabels>;
  /** Build the pages under the first at the next idle moment (ahead of time) instead of once the letter
   *  has opened. */
  prepare?: boolean;
  className?: string;
  style?: CSSProperties;
};

const FLAP_TOP = { f0: 133, dur: 23, ease: bezier(0.3, 0.1, 0.4, 1) };
const FLAP_BOT = { f0: 149, dur: 24, ease: bezier(0.3, 0.1, 0.4, 1) };
const SHADE = 0.42; // a turning flap darkens to this and back (0 → 0.42 → 0)
const STACK_SHADOW_F = 190;
const STACK_IN = { f0: 192, dur: 50, ease: bezier(0.22, 1, 0.36, 1) };
const HILITE_SWEEP = { f0: 206, dur: 40, ease: bezier(0.2, 0, 0.1, 1) };
const CHROME_IN = { f0: 192.5, dur: 27, ease: bezier(0.25, 0.6, 0.4, 1) };
const STACK = { dx: 9.6, dy: 5.1, rot: 0.9 }; // pose of the d-th sheet below the top
// paging (s): the shuffled sheet goes out (fractions of the sheet's size), then back under / on top
const OUT = { dur: 0.283, ease: bezier(0.25, 0.1, 0.25, 1), x: 0.667, y: -0.02, rot: 5 };
const BACK = { dur: 0.42, ease: bezier(0.25, 1, 0.5, 1) };
const MOVE = { dur: 0.283, ease: bezier(0.25, 0.1, 0.25, 1) };
const SWEEP_S = HILITE_SWEEP.dur / 60;
const tw = (F: number, f0: number, dur: number, ease: Ease) => ease((F - f0) / dur);

type Pose = { x: number; y: number; r: number };
type Seg = { t0: number; dur: number; ease: Ease; from: Pose; to: Pose | number; z: number };
type Sheet = { el: HTMLElement; marks: HTMLElement[] | null; pose: Pose; segs: Seg[]; sweep0: number; op: number; op0: number; nseg: number };

export function LetterStack({ pages, depth = 3, onClose, labels, prepare, className, style }: LetterStackProps) {
  const L = { ...stackLabels, ...labels };
  const clock = useContext(EnvelopeClock);
  const root = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  // the pages under the first are mounted once the letter has opened (nothing to build while sealed)
  const [later, setLater] = useState(!clock);
  const n = Math.max(pages.length, depth);
  const all: StackPage[] = Array.from({ length: n }, (_, i) => pages[i] ?? {});
  const bare = all.map((p) => !!p.bare).join();
  const page = useRef<(to: number) => void>(() => {});
  useEffect(() => {
    if (!prepare || later) return;
    const go = () => startTransition(() => setLater(true));
    if (typeof requestIdleCallback !== "function") { const t = setTimeout(go, 200); return () => clearTimeout(t); }
    const h = requestIdleCallback(go, { timeout: 2000 });
    return () => cancelIdleCallback(h);
  }, [prepare, later]);

  useEffect(() => {
    const R = root.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isBare = bare.split(",").map((b) => b === "true");
    const sheets: Sheet[] = [...R.querySelectorAll<HTMLElement>("[data-sheet]")].map((el) => ({
      el, marks: null, pose: { x: 0, y: 0, r: 0 }, segs: [], sweep0: -1, op: 0, op0: 0, nseg: 0,
    }));
    const top = R.querySelector<HTMLElement>("[data-flap='top']"), bot = R.querySelector<HTMLElement>("[data-flap='bot']");
    const shTop = top ? [...top.querySelectorAll<HTMLElement>("[data-sh]")] : [];
    const shBot = bot ? [...bot.querySelectorAll<HTMLElement>("[data-sh]")] : [];
    const chrome = R.querySelector<HTMLElement>("[data-chrome]");
    const lift = R.querySelector<HTMLElement>("[data-lift]");
    const fold = R.querySelector<HTMLElement>("[data-fold]");
    let size = { w: 662, h: 782 };
    const ro = new ResizeObserver(() => { const el = sheets[0]?.el; if (el) size = { w: el.offsetWidth, h: el.offsetHeight }; });
    if (sheets[0]) ro.observe(sheets[0].el);
    let at = 0; // index of the top page
    const slot = (i: number) => (i - at + n) % n;
    const css = (el: HTMLElement | null | undefined, k: string, v: string) => { if (el && el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v); };
    const now = () => performance.now() / 1000;

    page.current = (to: number) => {
      if (to === at || to < 0 || to >= n) return;
      const dir = to > at ? 1 : -1;
      const t = now();
      for (let step = at; step !== to; step += dir) {
        const was = sheets.map((_, i) => (i - step + n) % n);
        const next = step + dir;
        sheets.forEach((sh, i) => {
          const d0 = was[i], d1 = (i - next + n) % n;
          const from = { ...sh.pose };
          const out: Pose = { x: OUT.x * size.w, y: OUT.y * size.h, r: OUT.rot };
          if (reduced) sh.segs = [{ t0: t, dur: 0, ease: MOVE.ease, from, to: d1, z: d1 }];
          else if (dir > 0 && d0 === 0) // the top sheet: out to the right, then tucked under the stack
            sh.segs = [{ t0: t, dur: OUT.dur, ease: OUT.ease, from, to: out, z: -1 }, { t0: t + OUT.dur, dur: BACK.dur, ease: BACK.ease, from: out, to: d1, z: n }];
          else if (dir < 0 && d1 === 0) // the bottom sheet: out from under the stack, then back on top
            sh.segs = [{ t0: t, dur: OUT.dur, ease: OUT.ease, from, to: out, z: n }, { t0: t + OUT.dur, dur: BACK.dur, ease: BACK.ease, from: out, to: 0, z: -1 }];
          else sh.segs = [{ t0: t, dur: MOVE.dur, ease: MOVE.ease, from, to: d1, z: d1 }];
          sh.op0 = sh.op;
          sh.nseg = sh.segs.length;
          if (d1 === 0) { sh.sweep0 = t; sh.marks = null; }
        });
      }
      at = to;
      setCur(to);
      kick();
    };

    let raf = 0, mounted = false;
    const frame = () => {
      raf = 0;
      const tNow = now();
      // frames since the release (no envelope: long open)
      const F = !clock ? 1e4 : clock.at < 0 ? -1e4 : reduced ? 1e4 : ((tNow * 1000 - clock.at) / 1000) * 60;
      const fTop = tw(F, FLAP_TOP.f0, FLAP_TOP.dur, FLAP_TOP.ease), fBot = tw(F, FLAP_BOT.f0, FLAP_BOT.dur, FLAP_BOT.ease);
      // (flat once open: no 3D layer stays behind)
      css(top, "transform", fTop >= 1 ? "none" : `translateZ(${2 * (1 - fTop)}px) rotateX(${-180 * (1 - fTop)}deg)`);
      css(bot, "transform", fBot >= 1 ? "none" : `translateZ(${1 - fBot}px) rotateX(${180 * (1 - fBot)}deg)`);
      const flat = fBot >= 1 && fTop >= 1;
      if (fold && fold.classList.contains(s.flat) !== flat) {
        fold.classList.toggle(s.flat, flat);
        fold.firstElementChild?.toggleAttribute("aria-hidden", !flat);
      }
      const shade = (f: number) => (f <= 0 || f >= 1 ? "0" : (SHADE * Math.sin(Math.PI * f)).toFixed(4));
      shTop.forEach((e) => css(e, "opacity", shade(fTop)));
      shBot.forEach((e) => css(e, "opacity", shade(fBot)));
      const sk = tw(F, STACK_IN.f0, STACK_IN.dur, STACK_IN.ease);
      if (F >= STACK_IN.f0 + STACK_IN.dur && !mounted) { mounted = true; startTransition(() => setLater(true)); } // built in slices
      const shOn = F >= STACK_SHADOW_F;
      const slotPose = (d: number): Pose => ({ x: STACK.dx * sk * d, y: STACK.dy * sk * d, r: STACK.rot * sk * d });
      const topBare = isBare[at];
      let lifted = -1; // the sheet the stack's shadow lies under (the bottom one, when it is paper)
      let moving = F < Math.max(HILITE_SWEEP.f0 + HILITE_SWEEP.dur, CHROME_IN.f0 + CHROME_IN.dur, STACK_IN.f0 + STACK_IN.dur) + 2 && F > -1e3;
      sheets.forEach((sh, i) => {
        const d = slot(i);
        // who shows at rest: the top sheet; the paper sheets under it (not under a bare page, and not when
        // bare themselves); while the letter opens, only the bottom sheet (its shadow) until the stack fans out
        const rest = d === 0 || (d < depth && !topBare && !isBare[i] && (sk > 0 || (shOn && d === depth - 1))) ? 1 : 0;
        let z = d, op = rest;
        let pose = slotPose(d);
        while (sh.segs.length) {
          const g = sh.segs[0];
          const u = g.dur > 0 ? clamp01((tNow - g.t0) / g.dur) : 1;
          if (u >= 1 && sh.segs.length > 1) { sh.segs.shift(); continue; }
          const to = typeof g.to === "number" ? slotPose(g.to) : g.to;
          const e = g.ease(u);
          pose = { x: lerp(g.from.x, to.x, e), y: lerp(g.from.y, to.y, e), r: lerp(g.from.r, to.r, e) };
          z = g.z;
          // fades only where the sheet joins or leaves the visible stack (a shuffled sheet is fully seen out)
          const first = sh.segs.length === sh.nseg, last = sh.segs.length === 1;
          op = sh.nseg === 1 ? lerp(sh.op0, rest, u) : first ? lerp(sh.op0, 1, u) : last ? lerp(1, rest, u) : 1;
          if (u >= 1) sh.segs = [];
          else moving = true;
          break;
        }
        sh.pose = pose;
        sh.op = op;
        css(sh.el, "transform", `translate(${pose.x}px, ${pose.y}px) rotate(${pose.r}deg)`);
        css(sh.el, "z-index", String(100 - Math.round(z * 10)));
        // (an unseen sheet stays painted at opacity 0, so showing it again is only a change of opacity)
        css(sh.el, "opacity", String(op));
        css(sh.el, "pointer-events", d === 0 && !sh.segs.length ? "" : "none");
        if (shOn && d === depth - 1 && !isBare[i]) lifted = i;
        // the highlight: drawn once the letter is open, redrawn whenever a sheet comes to the top
        const sw = sh.sweep0 >= 0 ? SWEEP_S > 0 ? HILITE_SWEEP.ease((tNow - sh.sweep0) / SWEEP_S) : 1
          : shOn || F > 1e3 ? tw(F, HILITE_SWEEP.f0, HILITE_SWEEP.dur, HILITE_SWEEP.ease) : 0;
        if (sh.sweep0 >= 0 && sw < 1) moving = true;
        sh.marks ??= [...sh.el.querySelectorAll<HTMLElement>("[data-sweep]")];
        sh.marks.forEach((m) => css(m, "--sweep", sw >= 1 ? "" : sw.toFixed(4)));
      });
      // the stack's shadow: one layer that follows the bottom sheet (its pose and opacity), never repainted
      const ls = lifted >= 0 ? sheets[lifted] : null;
      if (ls) css(lift, "transform", ls.el.style.transform);
      css(lift, "opacity", ls ? String(ls.op) : "0");
      const ch = tw(F, CHROME_IN.f0, CHROME_IN.dur, CHROME_IN.ease);
      css(chrome, "opacity", String(ch));
      css(chrome, "visibility", ch > 0 ? "" : "hidden");
      css(chrome, "pointer-events", ch > 0.5 ? "auto" : "none");
      if (moving && !raf) raf = requestAnimationFrame(frame);
    };
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    clock?.listen(kick);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (clock?.isListening(kick)) clock.listen(undefined);
      page.current = () => {};
    };
  }, [clock, depth, n, bare]);

  // Only written pages can be reached; the blank sheets under them are the stack.
  const go = (d: number) => {
    const target = cur + d;
    if (target >= 0 && target < pages.length) page.current(target);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  };
  const third = (i: number, origin: string, back: boolean, flap?: "top" | "bot") => (
    <div data-flap={flap} className={s.panel} style={{ top: `${(100 / 3) * i}%`, transformOrigin: origin }}>
      <div className={`${s.face} ${s.paper} ${s[`p${i}`]}`}>
        <div className={s.copy} style={{ top: `${-100 * i}%` }} aria-hidden={i !== 1}>{all[0].content}</div>
        <div data-sh className={s.sh} />
      </div>
      {back && (
        <div className={`${s.face} ${s.paper} ${s.faceBack} ${s[`p${i}`]}`}>
          <div data-sh className={s.sh} />
        </div>
      )}
    </div>
  );

  return (
    <div ref={root} className={`${s.stack} ${className ?? ""}`} style={style} onKeyDown={onKey}>
      <div className={s.deck}>
        {all.map((p, i) => (
          <div key={i} data-sheet className={`${s.sheet} ${p.bare ? s.bare : s.paper}`} style={{ zIndex: 100 - i * 10 }}
            aria-hidden={i !== cur} inert={i !== cur}>
            {i === 0 ? (
              <div data-fold className={s.fold}>
                <div className={s.measure} aria-hidden>{p.content}</div>
                {third(1, "50% 50%", false)}
                {third(2, "50% 0", true, "bot")}
                {third(0, "50% 100%", true, "top")}
              </div>
            ) : (
              later && p.content
            )}
          </div>
        ))}
        <div data-lift className={s.lift} style={{ opacity: 0 }} aria-hidden />
      </div>
      <div data-chrome className={s.chrome} style={{ opacity: 0, visibility: "hidden" }}>
        {onClose && (
          <button type="button" className={`${s.btn} ${s.close}`} aria-label={L.close} onClick={onClose}>
            <svg width="48" height="48" viewBox="-24 -24 48 48" aria-hidden><circle r="20.2" /><path d="M-6.5-6.5L6.5 6.5M6.5-6.5L-6.5 6.5" /></svg>
          </button>
        )}
        {/* One written page: the sheets under it are only the stack, so there is nothing to page to. */}
        {pages.length > 1 && (
          <div className={s.nav}>
            <button type="button" className={s.btn} aria-label={L.prev} disabled={cur === 0} onClick={() => go(-1)}>
              <svg width="48" height="48" viewBox="-24 -24 48 48" aria-hidden><circle r="21" /><path d="M8 0H-8M-2.5-6L-8.5 0L-2.5 6" /></svg>
            </button>
            <button type="button" className={s.btn} aria-label={L.next} disabled={cur === pages.length - 1} onClick={() => go(1)}>
              <svg width="48" height="48" viewBox="-24 -24 48 48" aria-hidden><circle r="21" /><path d="M-8 0H8M2.5-6L8.5 0L2.5 6" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
