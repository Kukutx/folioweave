"use client";

// Tear-open envelope. The envelope drops in slightly tilted; dragging the perforated strip to the left
// tears it off (the torn part folds back around the tear point, through the gap the envelope's inside
// and the letter show); past a third it finishes on release, a tap (or Enter / Space) runs the whole
// tear by itself. The strip flies off, the envelope straightens while whatever is inside (children)
// slides out, then the envelope drops away and the contents grow to their own size in place.
// Motion timing is the recorded one (frames at 60 fps, relative to the release). Only transforms and
// opacity change per frame; the serrated edge is one fixed set of points (seeded) shared by the strip
// and the front, so the two halves mesh.
//
// Self-contained: imports only react and files in this folder. Sizes from its container (ResizeObserver).
// Theme: --envelope-paper-hi / --envelope-paper-lo (front gradient), --envelope-inside, --envelope-ink,
// --envelope-ink-soft, --muted (hint), --accent (tag), --font-hand, --font-script, --font-stamp.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { envelopeContent, type EnvelopeContent } from "./content";
import { bezier, clamp, clamp01, lerp, type Ease } from "./motion";
import { Clock, EnvelopeClock } from "./clock";
import { Stamps } from "./stamps";
import { grainUrl, prepareGrain } from "./grain";
import s from "./envelope.module.css";

export { LetterStack, type LetterStackProps, type StackPage } from "./letter-stack";
export { Letter, type LetterProps } from "./letter";
export { Stamps, type StampLabels } from "./stamps";
/** Paints the paper grain ahead of time (once per page), e.g. when the page is idle; envelopes otherwise start it when they mount. */
export { prepareGrain as prepareEnvelope } from "./grain";

export type EnvelopeProps = Partial<EnvelopeContent> & {
  /** What is inside the envelope; revealed (at its own size) once the envelope is open. */
  children?: ReactNode;
  /** Called once the contents are fully out. */
  onOpen?: () => void;
  /** Held unseen (built and painted ahead, e.g. while the page is idle, and out of the tab order) until this
   *  turns false; then it drops in as when mounted. Default false. */
  paused?: boolean;
  /** How the contents sit in the envelope: `anchor` = fraction of their height that sits at the envelope's
   *  mouth (a letter folded in three: 1/3), `scale` = their width relative to the envelope's. */
  fold?: { anchor?: number; scale?: number };
  className?: string;
  style?: CSSProperties;
};

// envelope geometry (design px)
const EW = 638, EH = 371, STRIP_H = 35;
const SW = 720, SH = 470, EX = 41, EY = 20; // stage that holds the envelope, the tag and the hint
const ROT0 = -2.873;
// recorded timing (frames)
const IN = { f0: -0.62, dur: 56.5, ease: bezier(0.245, 0.943, 0.473, 0.979), dy: 39.3, dx: -3.1, rot: -4.58, fade0: 1.61, fadeDur: 56.7 };
const HINT_IN = { f0: 74, dur: 18 };
const SWAP = { out: 6, gap: 9, in: 11 };
const TEAR_START = 18;
const PULL = 1.08;
const ROT = { base: -1, perT: -5.5 };
const ARM_DY = 3;
const CURL_W = 30;
const THRESH = 0.32;
const FLY = { f0: 25, dur: 13, ease: bezier(0.4, 0, 1, 1), dx: -70, dy: 14 };
const STRAIGHT = { f0: 40.35, dur: 48, ease: bezier(0.628, 0.051, 0.33, 1.014) };
const SLIDE = { f0: 47.6, dur: 51.6, ease: bezier(0.221, 1.01, 0.368, 0.995) };
const OPEN_OUT = { f0: 97, dur: 9 };
const DROP = { f0: 105.1, dur: 54, ease: bezier(0.414, 0.013, 0.831, 0.093), dy: 700, fade0: 137, fade1: 161, fadeEase: bezier(0.4, 0, 1, 1) };
const GROW = { f0: 103.8, dur: 60, ease: bezier(0.586, 0.074, 0.302, 0.99) };
const END = 166;
const AUTO = { dur: 30, ease: bezier(0.4, 0, 0.6, 1) };
const BACK = { dur: 24, ease: bezier(0.2, 0.9, 0.3, 1.15) };
const RING = { dur: 22, r0: 6, r1: 46 }; // the press ring where the strip is taken
const W = EW;

// the serrated tear line: 241 points, a small arc every 4 points plus a seeded jitter (the same every time)
const EDGE = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const e: number[] = [];
  for (let i = 0; i <= 240; i++) e.push(Math.abs(Math.sin((i * Math.PI) / 4)) * 1.7 + (rnd() - 0.5) * 1.1);
  return e;
})();
const GAP = 0.9; // the front sits this much below the strip: the inside shows through the seam
const edgePts = (dy: number) => EDGE.map((y, i) => `${((i / 240) * EW).toFixed(2)}px ${(STRIP_H + y + dy).toFixed(2)}px`);
const STRIP_CLIP = `polygon(0 0, ${EW}px 0, ${edgePts(0).reverse().join(", ")})`;
const FACE_CLIP = `polygon(0 ${EH}px, ${edgePts(GAP).join(", ")}, ${EW}px ${EH}px)`;
const SEAM = EDGE.map((y, i) => `${i ? "L" : "M"}${((i / 240) * EW).toFixed(2)} ${(STRIP_H + y + GAP).toFixed(2)}`).join("");
const PAD = 14; // room around the strip for the arm's shadow

const lin = (F: number, f0: number, f1: number) => clamp01((F - f0) / (f1 - f0));
const tw = (F: number, f0: number, dur: number, ease: Ease) => ease((F - f0) / dur);

export function Envelope(props: EnvelopeProps) {
  const c = { ...envelopeContent, ...props };
  const { children, onOpen, className, style, paused = false } = props;
  const anchor = props.fold?.anchor ?? 0, foldScale = props.fold?.scale ?? 0.883;
  const root = useRef<HTMLDivElement>(null);
  const [clock] = useState(() => new Clock()); // performance.now() of the release that opened it (read by LetterStack)
  const onOpenRef = useRef(onOpen);
  useLayoutEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  const [open, setOpen] = useState(false);
  const hadFocus = useRef(false);
  const pausedRef = useRef(paused);
  useLayoutEffect(() => { pausedRef.current = paused; }, [paused]);
  const start = useRef<() => void>(() => {});

  // the paper grain: a shared bitmap, painted once (before the first paint when it is ready already)
  useLayoutEffect(() => {
    const R = root.current!;
    let on = true;
    const put = (u: string) => { if (on && u) R.style.setProperty("--env-grain", `url("${u}")`); };
    if (grainUrl()) put(grainUrl());
    else prepareGrain().then(put);
    return () => { on = false; };
  }, []);

  useEffect(() => {
    const R = root.current!;
    const E: Record<string, HTMLElement> = {};
    R.querySelectorAll<HTMLElement>("[data-env]").forEach((el) => { E[el.dataset.env!] = el; });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = {
      drag: false, startX: 0, p: W, tearF: -1, Fu: -1, F: 1, done: false, ring: { F: -1e9, x: 0, y: 0 },
      anim: null as null | { f0: number; from: number; to: number; dur: number; ease: Ease; done?: () => void },
    };
    // sizes, read only when they change (never inside the frame loop)
    const box = { k: 1, Rw: 0, Rh: 0, cw: 1, ch: 1, cl: 0, ct: 0, kl: 0, kt: 0, Ch: 0 };
    const measure = () => {
      box.Rw = R.clientWidth; box.Rh = R.clientHeight;
      box.k = clamp((box.Rw - 24) / SW, 0.3, 1);
      R.style.setProperty("--env-min-h", `${SH * box.k}px`);
      // the contents' own box: their single child when there is one (a stack narrower than the envelope's box)
      const C = E.content;
      if (C) {
        const K = C.childElementCount === 1 ? (C.firstElementChild as HTMLElement) : C;
        box.cw = K.offsetWidth; box.ch = K.offsetHeight; box.cl = C.offsetLeft; box.ct = C.offsetTop; box.Ch = C.offsetHeight;
        box.kl = K === C ? 0 : K.offsetLeft; box.kt = K === C ? 0 : K.offsetTop; // offsets within the contents
      }
      kick();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(R);
    if (E.content) ro.observe(E.content);

    // pointer → the (unrotated) hints layer, where the press ring is drawn; `ext` is any scale applied
    // from outside (read once per press)
    let ext = 1;
    const local = (e: PointerEvent) => {
      const r = R.getBoundingClientRect();
      ext = r.width / Math.max(1, R.offsetWidth) || 1;
      return { x: ((e.clientX - r.left) / ext - (box.Rw - SW * box.k) / 2) / box.k, y: ((e.clientY - r.top) / ext - (box.Rh - SH * box.k) / 2) / box.k };
    };
    const release = () => {
      hadFocus.current = R.contains(document.activeElement);
      st.Fu = reduced ? st.F - END : st.F;
      clock.release(performance.now() - ((st.F - st.Fu) / 60) * 1000);
      R.classList.add(s.opened);
    };
    const onDown = (e: PointerEvent) => {
      if (st.Fu >= 0 || st.anim) return;
      st.drag = true;
      const q = local(e);
      st.startX = e.clientX / (box.k * ext);
      st.ring = { F: st.F, x: q.x, y: q.y };
      E.hit.setPointerCapture(e.pointerId);
      R.classList.add(s.dragging);
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (!st.drag) return;
      const dx = st.startX - e.clientX / (box.k * ext);
      st.p = clamp(W - dx * PULL, 0, W);
      if (st.tearF < 0 && W - st.p > TEAR_START) st.tearF = st.F;
      kick();
    };
    const onUp = () => {
      if (!st.drag) return;
      st.drag = false;
      R.classList.remove(s.dragging);
      const torn = 1 - st.p / W;
      if (torn > THRESH) {
        if (st.p > 0) st.anim = { f0: st.F, from: st.p, to: 0, dur: AUTO.dur * (st.p / W), ease: AUTO.ease, done: release };
        else release();
      } else st.anim = { f0: st.F, from: st.p, to: W, dur: BACK.dur, ease: BACK.ease };
      kick();
    };
    const tap = () => {
      if (st.Fu >= 0 || st.anim || st.drag) return;
      if (st.tearF < 0) st.tearF = st.F;
      if (reduced) { st.p = 0; release(); kick(); return; }
      st.anim = { f0: st.F, from: st.p, to: 0, dur: AUTO.dur * 1.6, ease: AUTO.ease, done: release };
      kick();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(); }
    };
    const hit = E.hit, front = E.front;
    const opts = { passive: true } as const;
    hit.addEventListener("pointerdown", onDown, opts);
    hit.addEventListener("pointermove", onMove, opts);
    hit.addEventListener("pointerup", onUp, opts);
    hit.addEventListener("pointercancel", onUp, opts);
    front.addEventListener("click", tap);
    front.addEventListener("keydown", onKey);

    const css = (el: HTMLElement | undefined, k: string, v: string) => { if (el && el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v); };
    const draw = (F: number) => {
      st.F = F;
      if (st.anim) {
        const a = st.anim;
        st.p = lerp(a.from, a.to, tw(F, a.f0, Math.max(a.dur, 1), a.ease));
        if (F >= a.f0 + a.dur) { st.anim = null; st.p = a.to; a.done?.(); }
      }
      const Fu = st.Fu;
      const after = (d: number) => (Fu < 0 ? -1e9 : F - Fu - d);
      const { k, Rw, Rh } = box;
      const ox = (Rw - SW * k) / 2, oy = (Rh - SH * k) / 2;

      // scene pose
      const mv = reduced ? 1 : tw(F, IN.f0, IN.dur, IN.ease);
      const straight = Fu < 0 ? 0 : tw(after(STRAIGHT.f0), 0, STRAIGHT.dur, STRAIGHT.ease);
      const rot = (ROT0 + IN.rot * (1 - mv)) * (1 - straight);
      const drop = tw(after(DROP.f0), 0, DROP.dur, DROP.ease);
      const dropA = 1 - DROP.fadeEase(lin(after(0), DROP.fade0, DROP.fade1));
      const fade = reduced ? 1 : IN.ease(lin(F, IN.fade0, IN.fade0 + IN.fadeDur));
      const inX = IN.dx * (1 - mv), inY = IN.dy * (1 - mv);
      const sceneT = `translate(${ox}px, ${oy}px) scale(${k}) translate(${inX}px, ${inY + DROP.dy * drop}px) rotate(${rot}deg)`;
      const gone = Fu >= 0 && after(DROP.fade1) >= 0;
      for (const key of ["back", "front"]) {
        css(E[key], "transform", sceneT);
        css(E[key], "opacity", String(fade * dropA));
        css(E[key], "visibility", gone ? "hidden" : "");
      }
      css(E.hints, "transform", `translate(${ox}px, ${oy}px) scale(${k})`);

      // strip: the part still attached runs from 0 to p, the torn part hangs from p, turned over
      const p = st.p;
      const t = 1 - p / W;
      css(E.tear, "transform", `translateX(${p - W}px)`);
      css(E.tearIn, "transform", `translateX(${W - p}px)`);
      const fly = Fu < 0 ? 0 : tw(after(FLY.f0), 0, FLY.dur, FLY.ease);
      css(E.arm, "transform", `translate(${FLY.dx * fly}px, ${FLY.dy * fly + ARM_DY}px) rotate(${ROT.base + ROT.perT * t}deg) scale(-1, -1)`);
      css(E.arm, "transform-origin", `${p}px ${STRIP_H + PAD}px`);
      css(E.arm, "opacity", String(1 - fly));
      css(E.arm, "visibility", t > 0 ? "" : "hidden");
      css(E.armClip, "transform", `translateX(${p}px)`);
      css(E.armIn, "transform", `translateX(${-p}px)`);
      css(E.curl, "transform", `translate(${p + FLY.dx * fly}px, ${FLY.dy * fly}px)`);
      css(E.curl, "opacity", String(t > 0 ? 1 - fly : 0));
      // the press ring
      const rq = (F - st.ring.F) / RING.dur;
      const rv = rq >= 0 && rq < 1 && !reduced;
      css(E.ring, "visibility", rv ? "" : "hidden");
      if (rv) {
        const e = 1 - (1 - rq) ** 2;
        css(E.ring, "transform", `translate(${st.ring.x}px, ${st.ring.y}px) scale(${(RING.r0 + (RING.r1 - RING.r0) * e) / RING.r1})`);
        css(E.ring, "opacity", String(Math.min(1, rq * 6) * (1 - rq)));
      }
      const ts = st.tearF;
      css(E.hint, "opacity", String((reduced ? 1 : lin(F, HINT_IN.f0, HINT_IN.f0 + HINT_IN.dur)) * (ts < 0 ? 1 : 1 - lin(F, ts, ts + SWAP.out))));
      css(E.tag, "opacity", String(ts < 0 ? 1 : 1 - lin(F, ts, ts + SWAP.out)));
      css(E.opening, "opacity", String((ts < 0 ? 0 : lin(F, ts + SWAP.gap, ts + SWAP.gap + SWAP.in)) * (1 - lin(after(OPEN_OUT.f0), 0, OPEN_OUT.dur))));

      // contents: tucked in the envelope (seen through the seam and the torn strip), slide out, then grow
      // (the tucked pose rides on the envelope's frame, without its fall; growing eases it to its own place)
      const C = E.content;
      if (C) {
        const { cw, ch, cl, ct, kl, kt } = box;
        const sd = (EW * foldScale) / Math.max(cw, 1); // content px → stage px
        const slide = tw(after(SLIDE.f0), 0, SLIDE.dur, SLIDE.ease);
        const grow = tw(after(GROW.f0), 0, GROW.dur, GROW.ease);
        const xs = EX + (EW - EW * foldScale) / 2, ys = EY + 9 - anchor * ch * sd - 244.8 * slide;
        const m = new DOMMatrix().translate(ox - cl, oy - ct).scale(k).translate(inX, inY).rotate(rot).translate(xs, ys).scale(sd).translate(-kl, -kt);
        const g = grow, h = 1 - grow;
        css(C, "transform", `matrix(${m.a * h + g}, ${m.b * h}, ${m.c * h}, ${m.d * h + g}, ${m.e * h}, ${m.f * h})`);
        css(C, "opacity", String(fade));
        css(C, "z-index", Fu >= 0 && after(GROW.f0) >= 0 ? "4" : "2");
        // (template addition) a letter longer than the sample is taller, folded in three, than the envelope:
        // until it grows to its own place, nothing of it shows below the envelope's bottom edge (the clip
        // is in the contents' own frame, which rides on the envelope's)
        const bottom = (EY + EH - ys) / sd + kt;
        css(C, "clip-path", Fu < 0 || after(GROW.f0) < 0 ? `inset(0 0 ${Math.max(0, box.Ch - bottom).toFixed(1)}px 0)` : "");
      }
      if (Fu >= 0 && !st.done && after(END) >= 0) {
        st.done = true;
        setOpen(true);
        onOpenRef.current?.();
      }
    };

    // the loop runs while something moves and sleeps otherwise (pointer input wakes it); held (unseen,
    // at its first frame) while paused
    let raf = 0, idle = 0;
    let t0 = performance.now(), held = pausedRef.current;
    start.current = () => { if (!held) return; held = false; t0 = performance.now(); kick(); };
    const loop = (now: number) => {
      raf = 0;
      if (held) { draw(1); return; }
      const F = 1 + ((now - t0) / 1000) * 60;
      draw(F);
      const moving = !st.done && (F < Math.max(IN.f0 + IN.dur, HINT_IN.f0 + HINT_IN.dur) + 2 || st.anim || st.drag || st.Fu >= 0
        || F - st.ring.F < RING.dur + 1 || (st.tearF >= 0 && F - st.tearF < SWAP.gap + SWAP.in + 2));
      idle = moving ? 0 : idle + 1;
      if (idle < 3) raf = requestAnimationFrame(loop);
    };
    function kick() { idle = 0; if (!raf) raf = requestAnimationFrame(loop); }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      raf = -1;
      start.current = () => {};
      ro.disconnect();
      hit.removeEventListener("pointerdown", onDown);
      hit.removeEventListener("pointermove", onMove);
      hit.removeEventListener("pointerup", onUp);
      hit.removeEventListener("pointercancel", onUp);
      front.removeEventListener("click", tap);
      front.removeEventListener("keydown", onKey);
    };
  }, [anchor, foldScale, clock]);

  useEffect(() => { if (!paused) start.current(); }, [paused]);

  // opened from the keyboard: focus moves into the contents (the front it was on is gone)
  useEffect(() => {
    if (!open || !hadFocus.current) return;
    root.current?.querySelector<HTMLElement>("[data-env='content'] :is(button, [href], input, [tabindex='0']):not(:disabled)")?.focus({ preventScroll: true });
  }, [open]);

  const at = (x: number, y: number): CSSProperties => ({ left: x, top: y });
  return (
    <div ref={root} className={`${s.root} ${open ? s.isOpen : ""} ${className ?? ""}`} style={style}>
      <div data-env="content" className={s.content} aria-hidden={!open} inert={!open} style={{ opacity: 0 }}>
        <EnvelopeClock.Provider value={clock}>{children}</EnvelopeClock.Provider>
      </div>
      {!open && (
        <>
          <div data-env="back" className={s.layer} style={{ zIndex: 1, opacity: 0 }}>
            <div className={`${s.body} ${s.back}`} style={{ ...at(EX, EY), width: EW, height: EH }} />
          </div>
          <div data-env="front" className={`${s.layer} ${s.front}`} style={{ zIndex: 3, opacity: 0 }}
            role="button" tabIndex={paused ? -1 : 0} aria-label={c.hint}>
            <div className={`${s.body} ${s.face}`} style={{ ...at(EX, EY), width: EW, height: EH, clipPath: FACE_CLIP }}>
              <svg className={s.flaps} viewBox={`0 0 ${EW} ${EH}`} width={EW} height={EH} aria-hidden>
                <path className={s.flapLine} d={`M96 266 L272 ${EH} M405 ${EH} L596 222`} />
                <path className={s.seam} d={SEAM} />
              </svg>
              {c.stamps ? <img className={s.stamps} src={c.stamps} alt="" style={at(411, 37.5)} draggable={false} />
                : <Stamps className={s.stamps} style={at(411, 37.5)} labels={c.stampLabels} />}
              <div className={s.to} style={at(80.1, 189.8)}>{c.to}</div>
              <div className={s.date} style={at(80.2, 246.7)}>{c.date}</div>
            </div>
            <div data-env="strip" className={s.strip} style={{ ...at(EX, EY - PAD), width: W, height: STRIP_H + 2 * PAD }}>
              <div data-env="tear" className={s.clip}>
                <div data-env="tearIn" className={s.slide}><div className={`${s.paper} ${s.attached}`} style={{ clipPath: STRIP_CLIP }} /></div>
              </div>
              <div data-env="arm" className={s.arm} style={{ visibility: "hidden" }}>
                <div data-env="armClip" className={s.clip}>
                  <div data-env="armIn" className={s.slide}>
                    <div className={s.armShadow} />
                    <div className={`${s.paper} ${s.under}`} style={{ clipPath: STRIP_CLIP }} />
                  </div>
                </div>
              </div>
              <div data-env="curl" className={s.curl} style={{ width: CURL_W, height: STRIP_H * 2 + 4, top: PAD, opacity: 0 }} />
              <div data-env="hit" className={s.hit} style={{ top: PAD - 6, height: STRIP_H + 6 }} />
            </div>
            <div data-env="tag" className={s.tag} style={{ ...at(EX + 610, EY - 17), width: 62.5, height: 41.3 }}>{c.tag}</div>
          </div>
          <div data-env="hints" className={s.layer} style={{ zIndex: 3 }} aria-hidden>
            <div data-env="ring" className={s.ring} style={{ visibility: "hidden" }} />
            <div data-env="hint" className={s.hint} style={{ top: EY + EH + 26, opacity: 0 }}>{c.hint}</div>
            <div data-env="opening" className={s.hint} style={{ top: EY + EH + 26, opacity: 0 }}>{c.opening}</div>
          </div>
        </>
      )}
    </div>
  );
}

export default Envelope;
