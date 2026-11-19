"use client";

// Ticket Club — a little link collection on a washing line (one red page, 1500 × 807 design stage at 60 fps),
// ported from the replicas project `ticket-club`. One to three tickets drop onto the line and swing in;
// hovering (or focusing) one turns its corner icon into a QR code of its link; dragging a stub down tears it
// off along the perforation (a percentage counts the holes), the stub falls, the ticket swings, "TAKEN. GOOD
// CHOICE." fades in and the link lands on the clipboard and a toast. Enter / Space tears it off from the
// keyboard. "PRINT ANOTHER ↻" / "Fresh tickets" hang new tickets, "Edit your links" edits what the stubs
// hand out (in this browser only).
//
// Differences from the original's runtime, for the template contract: the page is laid out by CSS (the
// stage scale is a CSS ratio, `--k`), so it is complete in the server HTML and without JavaScript; the
// entrance plays as CSS keyframes from the first paint (ticket-club.module.css) and this component takes it
// over at the same frame once it hydrates; the frame loop sleeps whenever nothing moves.

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { bezier, clamp01, lerp } from "./motion";
import {
  STAGE, TW, TH, VP, BARCODE, PIVOT, CARD_C, CARD_TXT, AGAIN_BOX,
  HINT, PANEL, PANEL_TXT, ROW_ICON, TOAST, PHONE, DIAMOND, HOLES, posesFor, roleOf, phoneCentres, phoneStart, type T4,
} from "./geometry";
import type { ClubData, IconName } from "./data";
import { copyText, shortLink } from "./data";
import {
  ArrowNE, Asterisk, Backdrop, Barcode, Clip, ClipDefs, Diamond, Glyph, HookArrow, QrCard,
} from "./parts";
import { cond, inter, mono } from "./fonts";
import { DeskHead, PhoneHead } from "./header";
import s from "./ticket-club.module.css";

/** phone layout, exactly as the stylesheet decides it */
export const PHONE_QUERY = `(max-width: ${PHONE.below - 0.02}px), (max-aspect-ratio: 100/105)`;

// ---------- keyframe helpers ----------
const kf = (F: number, k: number[][]) => {
  if (F <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++)
    if (F <= k[i][0]) return lerp(k[i - 1][1], k[i][1], (F - k[i - 1][0]) / (k[i][0] - k[i - 1][0]));
  return k[k.length - 1][1];
};
const kfn = (F: number, k: number[][], j: number) => kf(F, k.map((r) => [r[0], r[j]]));
const tw = (F: number, f0: number, dur: number, ease: (u: number) => number) => ease((F - f0) / dur);

// ---------- measured timing (frames, F = 1 + 60·t) ----------
// (the entrance's CSS twin is in ticket-club.module.css: keep the two in step)
const STRING_IN = { f0: 1.77, dur: 24.9, ease: bezier(0.198, 0.815, 0.35, 0.956), dy: -120 };
const STRING_FADE = { f0: 0.63, dur: 13.4, ease: bezier(0.4615, 0.961, 0.606, 0.781) };
const HERO_IN = { f0: 1.81, dur: 37.42, ease: bezier(0.132, 1.146, 0.673, 0.973), s0: 1.06, origin: [-85, 971] };
const HINT_FADE = [[1, 0], [2, 0.12], [4, 0.3], [6, 0.5], [8, 0.63], [10, 0.74], [12, 0.82], [14, 0.89], [16, 0.93], [18, 0.97], [20, 0.98], [26, 1]];
// tickets drop in tilted, then swing twice; the second / third start 6 / 12 frames later
const STAGGER = [0, 5.7, 12.3];
const DROP = { f0: 7.8, dur: 37, ease: bezier(0.245, 0.863, 0.256, 0.993), a0: [10.76, -0.38, -7.5], a1: 2, y0: -333.7, y1: 7.57 };
const T_FADE = { f0: 5.25, dur: 30.74, ease: bezier(0.208, 1.104, 0.634, 0.955) };
const SWING = bezier(0.179, 0.911, 0.35, 0.987);
const SW2 = { f0: 48.4, dur: 13.69 };
const SW3 = { f0: 61.58, dur: 9.96 };
const SETTLED = 80; // entrance frames
// QR on hover
const HOVER_OFF = 6;
const QR = { delay: 0.5, dur: 12.96, ease: bezier(0.758, 0.929, 0.278, 0.83) };
// tear, by pull T (px below the press): [T, stub angle (deg), hinge u] — the torn part turns about (hinge, VP)
const TEAR = [[0, 0, 480], [30, 0, 480], [39, -0.43, 484], [46, -0.84, 313], [48, -1.15, 264], [54, -1.8, 212], [62, -2.9, 176],
  [67, -4.0, 160], [75, -5.33, 166], [81, -5.97, 175], [86, -6.69, 194], [90, -6.95, 194], [98, -7.11, 205], [145, -7.85, 227]];
const PCT = [[10, 0], [20, 4], [30, 12], [37, 20], [46, 28], [57, 36], [63, 44], [73, 52], [85, 60], [95, 68], [98, 72], [130, 100]];
const DETACH_T = 128;
const LEAN = { max: 0.4, per: 0.0038 }; // the ticket leans towards the pulled side
const PCT_IN = 3;
const PCT_OUT = 10;
const BACK = { dur: 14, ease: bezier(0.2, 0.9, 0.3, 1.1) }; // released before tearing off: the stub springs back
const AUTO = { dur: 18, ease: bezier(0.45, 0, 0.35, 1) }; // keyboard: the stub is pulled for you
// after the stub comes off (k = F − D)
const SWING_D = [0, -0.84, -1.22, -1.41, -1.52, -1.58, -1.6, -1.07, -0.19, 0.31, 0.61, 0.81, 0.94, 1.02, 1.07, 1.1, 0.96, 0.4, 0.06,
  -0.12, -0.23, -0.31, -0.36, -0.38, -0.4, -0.34, -0.19, -0.11, -0.06, -0.04, -0.01, -0.01, 0];
const FALL = { v: 1.7, g: 0.34, vx: -0.9, dx0: -7, rot: [[0, 0], [1, -1.3], [3, -2.9], [5, -4.1], [7, -4.7], [13, -5.2], [15, -5.7], [19, -9.8], [23, -12.2], [45, -25]], piece: -11.4, hinge: 311, life: 45 };
const TAKEN_IN = [[22.8, 0], [24, 0.055], [25, 0.11], [27, 0.248], [28, 0.337], [29, 0.414], [30, 0.474], [31, 0.55], [32, 0.63],
  [33, 0.72], [34, 0.8], [35, 0.87], [36, 0.9], [37, 0.92], [38, 0.93], [44, 1]];
const HINT_DONE = 0.5; // hint → "A good link…" at D + 1
const HINT_IDLE = 43; // … and back to the idle line once every ticket is taken
const SWAP = 2; // clipboard rows + toast text change at D + 2
const PANEL_FADE = [[1, 0], [2, 0.037], [3, 0.112], [4, 0.216], [5, 0.346], [6, 0.463], [7, 0.577], [8, 0.669], [9, 0.799], [11, 0.852],
  [12, 0.895], [14, 0.926], [16, 0.971], [17, 0.996], [18, 1]];
// clipboard wiggle on every take: [k, scale, angle]
const WIGGLE = [[0, 1, 2], [1, 1.0004, 2.004], [2, 1.0054, 1.797], [3, 1.0101, 1.593], [4, 1.0144, 1.413], [5, 1.0181, 1.249], [6, 1.0218, 1.093],
  [7, 1.0253, 0.942], [8, 1.0281, 0.819], [9, 1.0307, 0.71], [10, 1.0329, 0.619], [11, 1.0344, 0.551], [12, 1.0353, 0.512], [13, 1.0342, 0.558],
  [14, 1.0316, 0.672], [15, 1.029, 0.784], [16, 1.0266, 0.888], [17, 1.0243, 0.983], [18, 1.0219, 1.088], [19, 1.0198, 1.178], [20, 1.0178, 1.265],
  [21, 1.0157, 1.355], [22, 1.0138, 1.436], [23, 1.012, 1.511], [24, 1.0102, 1.588], [25, 1.0086, 1.66], [26, 1.0071, 1.723], [27, 1.0057, 1.781],
  [28, 1.0044, 1.837], [29, 1.0033, 1.886], [30, 1.0016, 1.955], [32, 1.001, 1.98], [33, 1.0006, 1.999], [34, 1, 2]];
const TOAST_Y = [[2, 14], [4, 11], [5, 9], [6, 6.5], [7, 5], [8, 3], [9, 1.5], [11, 1], [12, 0.5], [14, 0]];
const TOAST_A = [[2, 0], [3, 0.23], [5, 0.57], [7, 0.8], [9, 0.96], [13, 1]];
const REHANG_AT = 4; // a re-hung ticket starts its entrance this many frames in (fade, then drop and swing)
// frames the loop keeps running after something happens (the longest reaction: a take, ~60 frames)
const WAKE = { hover: 24, take: 90, hang: SETTLED + 30 };
// the perforation: a row of round holes centred on the card's lower edge / the stub's upper edge
const holes = (y: string) => {
  const m = `radial-gradient(circle at ${HOLES.pitch / 2}px ${y}, transparent ${HOLES.r}px, #000 ${HOLES.r + 0.5}px) ${HOLES.u0 - HOLES.pitch / 2}px 0 / ${HOLES.pitch}px 100% repeat-x`;
  return { WebkitMask: m, mask: m } as CSSProperties;
};
const CARD_MASK = holes("100%");
const STUB_MASK = holes("0.5px");
// the line: the recorded curve, continued along its tangents past the stage edges
const STRING_D = "M-200 91.4L0 104.446Q750 153.36 1500 103.246L1700 89.9";

type Hov = { F0: number; from: number; to: number };
type Tk = {
  drag: boolean; y0: number; py: number; sign: number;
  T: number; back: null | { F0: number; T0: number }; auto: number;
  downF: number; D: number; hov: Hov; fall: DOMMatrix | null; leaveAt: number; base: number;
  kbd: boolean; // torn off from the keyboard: hand the focus on to "PRINT ANOTHER"
};
type Fit = { phone: boolean; k: number; x0: number; y0: number };
type Act = { again: (i: number) => void; fresh: () => void; wake: (frames: number) => void };

/** the settled pose of a ticket, as a transform (server HTML, no JavaScript, reduced motion) */
const restPose = (P: [number, number], a: number) => `translate(${P[0]}px, ${P[1]}px) rotate(${a}deg) translate(${-PIVOT.u}px, ${-PIVOT.v}px)`;
/** a short stable key of the author's links, so a visitor's edits never outlive a change of the tickets */
const keyOf = (links: string[]) => {
  let h = 0;
  for (const c of links.join("\n")) h = (Math.imul(h, 31) + c.codePointAt(0)!) | 0;
  return `ticket-club:links:${(h >>> 0).toString(36)}`;
};

/** Copies text; resolves false when the browser refuses (no permission, no clipboard, insecure page). */
async function copy(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* refused: try the older way below */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    const back = document.activeElement as HTMLElement | null;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    back?.focus?.({ preventScroll: true });
    return ok;
  } catch {
    return false;
  }
}

export function TicketClub({ data }: { data: ClubData }) {
  const C = data;
  const L = C.labels;
  const N = C.tickets.length;
  const { poses, roles, centres } = useMemo(
    () => ({ poses: posesFor(N), roles: Array.from({ length: N }, (_, i) => roleOf(i, N)), centres: phoneCentres(N) }),
    [N],
  );
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fitRef = useRef<Fit>({ phone: false, k: 1, x0: 0, y0: 0 });
  const [phone, setPhone] = useState(false);
  const [editing, setEditing] = useState(false);
  const authored = C.tickets.map((t) => t.link);
  const [links, setLinks] = useState(authored);
  const linksRef = useRef(links);
  const act = useRef<Act | null>(null);
  /** where the frame clock starts (kept across a remount, so the entrance is not replayed) */
  const clock = useRef<{ t0: number; offset: number } | null>(null);
  const storeKey = keyOf(authored);

  // a visitor's own links survive a reload (in this browser, until the author changes the tickets)
  useEffect(() => {
    linksRef.current = links;
    act.current?.wake(2);
  }, [links]);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storeKey) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after hydration
      if (Array.isArray(v) && v.length === N && v.every((x) => typeof x === "string")) setLinks(v);
    } catch { /* storage unavailable */ }
  }, [N, storeKey]);
  const setLink = (i: number, v: string) => setLinks((ls) => {
    const n = ls.map((x, j) => (j === i ? v : x));
    try { localStorage.setItem(storeKey, JSON.stringify(n)); } catch { /* storage unavailable */ }
    return n;
  });

  // the layout itself is CSS; the frame loop only needs the same numbers (falling stubs, pointer → stage)
  useLayoutEffect(() => {
    const el = root.current!;
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => {
      const W = el.clientWidth;
      const was = fitRef.current;
      if (mq.matches) {
        const k = Math.min(1, W / PHONE.refW);
        fitRef.current = { phone: true, k, x0: centres[0] - W / 2 / k, y0: PHONE.y0 };
      } else fitRef.current = { phone: false, k: W / STAGE.w, x0: 0, y0: 0 };
      const f = fitRef.current, t = track.current;
      // phone: start with the middle ticket in view (again whenever the track is laid out anew, as the
      // original does); snapping is off while it moves, so the track then snaps to that ticket
      if (f.phone && t && (!was.phone || was.k !== f.k || was.x0 !== f.x0)) {
        t.style.scrollSnapType = "none";
        t.scrollLeft = (centres[phoneStart(N)] - f.x0) * f.k - t.clientWidth / 2;
        void t.scrollLeft;
        t.style.scrollSnapType = "";
      }
      setPhone(mq.matches);
      act.current?.wake(2);
    };
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    mq.addEventListener("change", on);
    return () => { ro.disconnect(); mq.removeEventListener("change", on); };
  }, [centres, N]);

  useLayoutEffect(() => {
    const R = root.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const E: Record<string, HTMLElement> = {};
    R.querySelectorAll<HTMLElement>("[data-k]").forEach((el) => { E[el.dataset.k!] = el; });
    // the entrance has been playing as CSS since the first paint: carry on from the frame it has reached
    if (!clock.current) {
      const opening = R.getAnimations?.({ subtree: true }).find((a) => a instanceof CSSAnimation && a.animationName.includes("tcLine"));
      const elapsed = opening && typeof opening.currentTime === "number" ? opening.currentTime : -1;
      // reduced motion, or no opening to carry on from: the line is at rest
      clock.current = { t0: performance.now() - Math.max(0, elapsed), offset: reduced || elapsed < 0 ? SETTLED + 120 : 0 };
    }
    const { t0, offset: settledOffset } = clock.current;
    const st = { F: 1, takes: [] as { i: number; D: number; failed: boolean }[], fx: "", dockOn: false, until: SETTLED + 20 };
    const tk: Tk[] = C.tickets.map((_, i) => ({
      drag: false, y0: 0, py: 0, sign: 1, T: 0, back: null, auto: -1, downF: -1, D: -1,
      hov: { F0: -1e9, from: 0, to: 0 }, fall: null, leaveAt: -1, base: STAGGER[roles[i]] ?? 0, kbd: false,
    }));
    const toStage = (e: PointerEvent) => {
      const rc = stage.current!.getBoundingClientRect();
      const kk = rc.width / STAGE.w;
      return { x: (e.clientX - rc.left) / kk, y: (e.clientY - rc.top) / kk };
    };
    const hovVal = (h: Hov, F: number) => lerp(h.from, h.to, QR.ease((F - h.F0 - QR.delay) / QR.dur));
    const setHov = (i: number, on: boolean) => {
      const h = tk[i].hov;
      const to = on ? 1 : 0;
      if (h.to === to) return;
      tk[i].hov = { F0: st.F, from: hovVal(h, st.F), to };
      wake(WAKE.hover);
    };
    const cleanups: (() => void)[] = [];
    const on = (el: EventTarget | undefined | null, ev: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
      if (!el) return;
      el.addEventListener(ev, fn, opts);
      cleanups.push(() => el.removeEventListener(ev, fn, opts));
    };
    const rehang = (i: number, delay = 0) => {
      Object.assign(tk[i], { D: -1, T: 0, back: null, auto: -1, downF: -1, fall: null, drag: false, kbd: false, base: reduced ? st.F - 400 : st.F - REHANG_AT + delay });
      wake(WAKE.hang + delay);
    };

    C.tickets.forEach((_, i) => {
      const body = E["body" + i], hit = E["hit" + i];
      on(body, "pointerenter", () => setHov(i, true));
      on(body, "pointerleave", () => { if (!tk[i].drag) setHov(i, false); });
      on(hit, "focus", () => setHov(i, true));
      on(hit, "blur", () => { if (!tk[i].drag) setHov(i, false); });
      on(hit, "pointerdown", (ev) => {
        const e = ev as PointerEvent, t = tk[i];
        if (t.D >= 0 || t.auto >= 0 || e.button > 0) return;
        t.kbd = false;
        const p = toStage(e);
        t.drag = true; t.y0 = p.y; t.py = p.y; t.back = null; t.downF = st.F;
        t.sign = Math.sign(p.x - poses[i].P[0]) || 1;
        hit.setPointerCapture(e.pointerId);
        R.classList.add(s.grabbing);
        e.preventDefault();
        wake(2);
      });
      on(hit, "pointermove", (ev) => { if (tk[i].drag) tk[i].py = toStage(ev as PointerEvent).y; });
      const up = () => {
        const t = tk[i];
        if (!t.drag) return;
        t.drag = false;
        R.classList.remove(s.grabbing);
        if (t.D < 0) t.back = { F0: st.F, T0: t.T };
        else t.leaveAt = st.F + HOVER_OFF; // the hover ends a little after the release
        wake(WAKE.hover);
      };
      on(hit, "pointerup", up);
      on(hit, "pointercancel", up);
      on(hit, "lostpointercapture", up);
      // keyboard: Enter / Space pulls the stub off
      on(hit, "keydown", (ev) => {
        const e = ev as KeyboardEvent, t = tk[i];
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (t.D >= 0 || t.drag || t.auto >= 0) return;
        t.sign = -1; t.downF = st.F; t.back = null; t.kbd = true;
        if (reduced) t.T = DETACH_T;
        t.auto = st.F;
        wake(2);
      });
    });
    // phone: the falling stubs follow the track's scroll
    on(track.current, "scroll", () => wake(1), { passive: true });

    const set = (el: HTMLElement | undefined, css: Partial<CSSStyleDeclaration>) => { if (el) Object.assign(el.style, css); };
    const txt = (el: HTMLElement | undefined, v: string) => { if (el && el.textContent !== v) el.textContent = v; };
    const attr = (el: HTMLElement | undefined, a: string, v: string) => { if (el && el.getAttribute(a) !== v) el.setAttribute(a, v); };
    const ticketM = (i: number, a: number, dy: number) => {
      const P = poses[i].P;
      return new DOMMatrix().translate(P[0], P[1] + dy).rotate(a).translate(-PIVOT.u, -PIVOT.v);
    };
    const ICONS = ["web", "github", "chat"];
    const showIcon = (row: string, name: string) => ICONS.forEach((n) => set(E[`r${row}i_${n}`], { display: n === name ? "block" : "none" }));

    const draw = (F: number) => {
      st.F = F;
      // the falling stubs live above the track (they must not be clipped by it): follow its scroll
      const Lf = fitRef.current;
      const sl = Lf.phone && track.current ? track.current.scrollLeft : 0;
      const fx = `translate(${-Lf.x0 * Lf.k - sl}px, ${-Lf.y0 * Lf.k}px) scale(${Lf.k})`;
      if (fx !== st.fx) { st.fx = fx; set(E.fx, { transform: fx }); }

      // ----- string / hero / hint entrance -----
      set(E.string, {
        transform: `translateY(${0.4 + STRING_IN.dy * (1 - tw(F, STRING_IN.f0, STRING_IN.dur, STRING_IN.ease))}px)`,
        opacity: String(tw(F, STRING_FADE.f0, STRING_FADE.dur, STRING_FADE.ease)),
      });
      set(E.hero, { transform: `scale(${lerp(HERO_IN.s0, 1, tw(F, HERO_IN.f0, HERO_IN.dur, HERO_IN.ease))})` });

      // ----- tickets -----
      let lastD = -1;
      let pullOn = false;
      C.tickets.forEach((_, i) => {
        const t = tk[i];
        const Fi = F - t.base;
        let ar: number, yr: number;
        if (Fi < SW2.f0) {
          const u = tw(Fi, DROP.f0, DROP.dur, DROP.ease);
          ar = lerp(DROP.a0[roles[i]], DROP.a1, u); yr = lerp(DROP.y0, DROP.y1, u);
        } else if (Fi < SW3.f0) {
          ar = lerp(2, -1, tw(Fi, SW2.f0, SW2.dur, SWING)); yr = 3.6 * ar + 0.37;
        } else {
          ar = lerp(-1, 0, tw(Fi, SW3.f0, SW3.dur, SWING)); yr = 3.25 * ar;
        }
        // pull
        if (t.drag && t.D < 0) t.T = Math.max(0, t.py - t.y0);
        else if (t.auto >= 0 && t.D < 0) t.T = Math.max(t.T, (DETACH_T + 2) * AUTO.ease((F - t.auto) / AUTO.dur));
        else if (t.back) {
          t.T = t.back.T0 * (1 - tw(F, t.back.F0, BACK.dur, BACK.ease));
          if (F >= t.back.F0 + BACK.dur) { t.back = null; t.T = 0; }
        }
        if ((t.drag || t.auto >= 0) && t.D < 0 && t.T >= DETACH_T) {
          t.D = F;
          t.auto = -1;
          const take = { i, D: F, failed: false };
          st.takes.push(take);
          void copy(copyText(linksRef.current[i])).then((ok) => { if (!ok) { take.failed = true; wake(2); } });
          const fm = t.sign > 0 ? -1 : 1;
          const fh = t.sign > 0 ? TW - FALL.hinge : FALL.hinge;
          t.fall = ticketM(i, poses[i].a + ar, yr).translate(fh, VP).rotate(fm * FALL.piece).translate(-fh, -VP);
          if (!t.drag) t.leaveAt = F + HOVER_OFF;
          wake(WAKE.take);
        }
        const D = t.D;
        if (D >= 0) lastD = Math.max(lastD, D);
        if ((t.drag || t.auto >= 0) && D < 0) pullOn = true;
        let a = poses[i].a + ar;
        if (D < 0) a += t.sign * Math.min(LEAN.max, LEAN.per * t.T);
        else if (!reduced) a += SWING_D[Math.min(SWING_D.length - 1, Math.max(0, Math.round(F - D)))];
        const M = ticketM(i, a, yr).toString();
        set(E["tk" + i], { transform: M, opacity: String(tw(Fi, T_FADE.f0, T_FADE.dur, T_FADE.ease)) });
        set(E["ov" + i], { transform: M });
        // QR
        if (t.leaveAt >= 0 && F >= t.leaveAt) {
          t.leaveAt = -1;
          const b = E["body" + i], h = E["hit" + i];
          if (!b?.matches(":hover") && document.activeElement !== h) setHov(i, false);
        }
        set(E["qr" + i], { opacity: String(clamp01(hovVal(t.hov, F))) });
        // stub: the tear runs from the end that is pulled (the side of the press relative to the clip)
        const mir = t.sign > 0;
        const ang = kfn(t.T, TEAR, 1) * (mir ? -1 : 1), hinge = kfn(t.T, TEAR, 2);
        const hc = Math.min(hinge, TW);
        set(E["stubL" + i], {
          clipPath: mir ? `inset(-6px -6px -6px ${TW - hc}px)` : `inset(-6px ${TW - hc}px -6px -6px)`,
          transformOrigin: `${mir ? TW - hinge : hinge}px ${VP}px`,
          transform: `rotate(${ang}deg)`,
          visibility: D < 0 ? "visible" : "hidden",
        });
        set(E["stubR" + i], {
          clipPath: mir ? `inset(-6px ${hc}px -6px -6px)` : `inset(-6px -6px -6px ${hc}px)`,
          visibility: D < 0 && hc < TW ? "visible" : "hidden",
        });
        const live = D < 0;
        set(E["hit" + i], { pointerEvents: live ? "" : "none" });
        attr(E["hit" + i], "tabindex", live ? "0" : "-1");
        attr(E["hit" + i], "aria-hidden", live ? "false" : "true");
        // percentage
        const pct = D >= 0 ? 100 : Math.floor(kf(t.T, PCT) / 4 + 1e-6) * 4;
        const pa = t.downF < 0 || D >= 0 ? 0 : t.drag || t.auto >= 0 ? clamp01((F - t.downF) / PCT_IN) : 0;
        txt(E["pct" + i], pct + "%");
        set(E["pct" + i], { opacity: String(pa) });
        set(E["pctLo" + i], { opacity: String(D < 0 ? 0 : 1 - clamp01((F - D) / PCT_OUT)) });
        // the stub that came off
        if (D >= 0 && t.fall && F - D < FALL.life && !reduced) {
          const q = F - D;
          const c = t.fall.transformPoint(new DOMPoint(TW / 2, (VP + TH) / 2));
          const fm = t.sign > 0 ? -1 : 1;
          const r = fm * kf(q, FALL.rot);
          const m = new DOMMatrix().translate(fm * (FALL.vx * q + FALL.dx0 * clamp01(q)), FALL.v * q + FALL.g * q * q)
            .translate(c.x, c.y).rotate(r).translate(-c.x, -c.y).multiply(t.fall);
          set(E["fall" + i], { transform: m.toString(), visibility: "visible" });
        } else set(E["fall" + i], { visibility: "hidden" });
        // taken
        const takenA = D < 0 ? 0 : kf(F - D, TAKEN_IN);
        set(E["taken" + i], { opacity: String(takenA), visibility: takenA > 0 ? "visible" : "hidden" });
        attr(E["again" + i], "tabindex", takenA > 0.5 ? "0" : "-1");
        if (t.kbd && takenA > 0) {
          t.kbd = false;
          if (document.activeElement === E["hit" + i]) E["again" + i]?.focus({ preventScroll: true });
        }
      });

      // ----- hint -----
      const all = tk.every((t) => t.D >= 0);
      let hint = L.hintIdle;
      const lastDown = Math.max(...tk.map((t) => t.downF));
      if (pullOn) hint = L.hintPull;
      else if (lastD >= 0 && F >= lastD + HINT_DONE && !(all && F >= lastD + HINT_IDLE)) hint = lastDown > lastD ? L.hintPull : L.hintDone;
      txt(E.hintText, hint);
      set(E.hint, { opacity: String(kf(F, HINT_FADE)) });

      // ----- clipboard + toast -----
      const takes = st.takes;
      const first = takes.length ? takes[0].D : -1;
      if (first >= 0) {
        if (!st.dockOn) { st.dockOn = true; E.dock?.setAttribute("data-on", ""); }
        // rows: the history as of the newest take whose swap frame has passed
        const done = takes.filter((x) => F >= x.D + SWAP);
        const hist = C.tickets.map((_, j) => j).reverse().slice(0, 2);
        done.forEach((x) => { const j = hist.indexOf(x.i); if (j >= 0) hist.splice(j, 1); hist.unshift(x.i); });
        const a1 = hist[0], a2 = hist[1];
        txt(E.r1t, C.tickets[a1].label); txt(E.r1s, copyText(linksRef.current[a1]));
        showIcon("1", C.tickets[a1].icon);
        if (a2 !== undefined) {
          txt(E.r2t, C.tickets[a2].label); txt(E.r2s, copyText(linksRef.current[a2]));
          showIcon("2", C.tickets[a2].icon);
        }
        const kq = reduced ? 99 : F - takes[takes.length - 1].D;
        set(E.panel, {
          opacity: String(reduced ? 1 : kf(F - first, PANEL_FADE)),
          transform: `rotate(${kfn(kq, WIGGLE, 2)}deg) scale(${kfn(kq, WIGGLE, 1)})`,
        });
        if (done.length) {
          const last = done[done.length - 1];
          txt(E.toastText, last.failed ? L.copyFailed.replace("{link}", shortLink(linksRef.current[last.i])) : C.tickets[last.i].toast);
        }
        const kt = reduced ? 99 : F - first;
        set(E.toast, {
          opacity: String(kf(kt, TOAST_A)),
          transform: `translate(-50%, ${kf(kt, TOAST_Y)}px)`,
          visibility: F - first >= SWAP ? "visible" : "hidden",
        });
      } else {
        set(E.panel, { opacity: "0" });
        set(E.toast, { visibility: "hidden" });
      }
    };

    // the loop runs while something moves and sleeps otherwise (input wakes it)
    let raf = 0;
    const frameAt = (now: number) => 1 + ((now - t0) / 1000) * 60 + settledOffset;
    const loop = (now: number) => {
      raf = 0;
      const F = frameAt(now);
      draw(F);
      if (F < st.until || tk.some((t) => t.drag || t.auto >= 0 || t.back)) raf = requestAnimationFrame(loop);
    };
    function wake(frames: number) {
      st.until = Math.max(st.until, st.F + frames);
      if (!raf) raf = requestAnimationFrame(loop);
    }
    act.current = { again: (i) => rehang(i), fresh: () => tk.forEach((_, i) => rehang(i, STAGGER[roles[i]] ?? 0)), wake };
    // take over from the CSS opening in this same frame: draw, then drop the keyframes
    draw(frameAt(performance.now()));
    R.removeAttribute("data-opening");
    raf = requestAnimationFrame(loop);
    // a ticket's title that is wider than the card is set smaller until it fits (once its face is loaded)
    let live = true;
    const fitTitles = () => R.querySelectorAll<HTMLElement>(`.${s.big}`).forEach((el) => {
      const base = Number(el.dataset.size ?? (el.dataset.size = String(parseFloat(el.style.fontSize))));
      el.style.fontSize = `${base}px`;
      if (el.scrollWidth > el.clientWidth + 0.5) el.style.fontSize = `${Math.max(base * 0.5, (base * el.clientWidth) / el.scrollWidth)}px`;
    });
    void document.fonts?.ready.then(() => { if (live) fitTitles(); });
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      cleanups.forEach((f) => f());
      act.current = null;
    };
    // the loop is set up once per set of tickets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [C]);

  // ---------- markup ----------
  const T = (p: T4, cls: string, color: string, text: ReactNode, key?: string, extra?: CSSProperties) => (
    <div data-k={key} className={`${s.line} ${cls}`}
      style={{ left: p[0], top: p[1], fontSize: p[2], letterSpacing: p[3], color, ...extra }}>{text}</div>
  );
  const M = mono.className, B = cond.className, I = inter.className;
  const stubContent = (i: number) => {
    const d = C.tickets[i];
    const c = d.light ? ["rgb(5,29,25)", "rgb(19,56,50)", "rgb(36,83,76)"] : ["rgb(204,245,236)", "rgb(190,226,218)", "rgb(180,214,205)"];
    return (
      <>
        <div className={s.stub} style={{ top: VP - 0.5, height: TH - VP + 0.5, background: d.light ? CARD_C.light.stub : CARD_C.dark.stub, ...STUB_MASK }} />
        <div className={s.icon} style={{ left: 258.1, top: 393.1, width: 30.8, height: 30.8 }}><Glyph name="arrowSE" size={30.8} color={c[0]} w={1.15} /></div>
        <div className={s.icon} style={{ left: 0, top: BARCODE.v, width: TW, height: BARCODE.h }}><Barcode color={c[0]} /></div>
        {T(CARD_TXT.take, `${I} ${s.w800} ${s.take}`, c[0], d.take)}
        {T(CARD_TXT.url, `${M} ${s.w500} ${s.url}`, c[1], shortLink(links[i]))}
        {T(CARD_TXT.pull, `${M} ${s.w500}`, c[2], L.pull)}
      </>
    );
  };
  const check = (x: number, y: number, w: number, color: string, sw = 1.1) => (
    <svg className={s.abs} style={{ left: x, top: y, width: w, height: w * 0.75, overflow: "visible" }} viewBox="0 0 12 9" aria-hidden>
      <path d="M1 4.8 4.3 8 11 1.2" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const TAKEN_C = "rgb(254,180,157)";
  const ICON_C = "rgb(172,228,219)";
  // the clipboard starts with the last tickets on it, newest first (the recording: 3, then 2)
  const seed = C.tickets.map((_, j) => j).reverse().slice(0, 2);
  const rowIcon = (row: string, v: number, initial: IconName) => (
    <div className={s.rowIcon} style={{ left: ROW_ICON.u, top: v, width: ROW_ICON.s, height: ROW_ICON.s }}>
      {(["web", "github", "chat"] as IconName[]).map((n) => (
        <span key={n} data-k={`r${row}i_${n}`} style={{ display: n === initial ? "block" : "none" }}>
          <Glyph name={n} size={16} color="rgb(96,108,84)" w={1.6} />
        </span>
      ))}
    </div>
  );
  const heroText = (

    <>
      <p className={`${s.tagline} ${M}`}><i className={s.dot} />{L.tagline}</p>
      <h1 className={`${s.title} ${B}`}>
        {L.titleTop}<br />{L.titleBottom}
        <span className={s.titleAst}><Asterisk size={46} color="rgb(241,204,163)" w={1.5} /></span>
      </h1>
      <p className={`${s.sub} ${I}`}><b>{L.subLead}</b><br />{L.subTail}</p>
      <div className={`${s.tools} ${M}`}>
        <button type="button" className={`${s.tool} ${s.scripted} ${editing ? s.toolOn : ""}`} aria-pressed={editing}
          onClick={() => { if (!editing) act.current?.fresh(); setEditing((v) => !v); }}>
          <Glyph name="sliders" size={12} color="currentColor" w={1.8} />{L.edit}
        </button>
        <span className={`${s.slash} ${s.scripted}`} aria-hidden>/</span>
        <button type="button" className={`${s.tool} ${s.scripted}`} onClick={() => act.current?.fresh()}>
          <span className={s.spin}><Glyph name="refresh" size={12} color="currentColor" w={1.8} /></span>{L.fresh}
        </button>
        {C.writing && (
          <>
            <span className={`${s.slash} ${s.scripted}`} aria-hidden>/</span>
            <Link className={s.tool} href={C.writing}>
              <span className={s.toolArrow}><ArrowNE color="currentColor" /></span>{L.writing}
            </Link>
          </>
        )}
      </div>
    </>
  );
  /** "PERSONAL EDITION ↗" opens the personal edition (the letter page). */
  const head = { brandTop: L.brandTop, brandBottom: L.brandBottom, edition: L.edition, editionHref: C.edition };
  const pose = (i: number) => restPose(poses[i].P, poses[i].a);
  const vars = {
    "--c0": centres[0],
    "--cspan": centres[centres.length - 1] - centres[0],
  } as CSSProperties;

  return (
    <div ref={root} data-opening="" className={`${s.page} ${M} ${editing ? s.editing : ""}`} style={vars}>
      <noscript><style>{`.${s.scripted}{display:none!important}`}</style></noscript>
      <Backdrop />
      <ClipDefs />
      {/* phone header (desktop: on the stage) */}
      <PhoneHead {...head} />
      <div className={s.hero}>
        <div ref={track} className={s.track}>
          <div className={s.trackInner}>
            {centres.map((x, i) => (
              <i key={i} className={s.snap} style={{ "--x": x } as CSSProperties} />
            ))}
            <div ref={stage} className={s.stage}>
              {/* header */}
              <DeskHead {...head} />
              {/* the line */}
              <svg data-k="string" className={`${s.string} ${s.openString}`} width={STAGE.w} height={200} viewBox={`0 0 ${STAGE.w} 200`}
                style={{ transform: "translateY(0.4px)" }} aria-hidden>
                <path className={s.strShadow} d={STRING_D} />
                <path className={s.strLine} d={STRING_D} />
              </svg>
              {/* tickets */}
              {C.tickets.map((d, i) => (
                <div key={i} data-k={"tk" + i} className={`${s.ticket} ${s.openTicket}`}
                  style={{
                    transform: pose(i),
                    "--px": poses[i].P[0], "--py": poses[i].P[1], "--a": poses[i].a, "--a0": DROP.a0[roles[i]],
                    "--base": `${(STAGGER[roles[i]] - 1) / 60}s`, "--fade": `${(STAGGER[roles[i]] + T_FADE.f0 - 1) / 60}s`,
                  } as CSSProperties}>
                  <div data-k={"body" + i} className={s.body}>
                    <div className={s.card} style={{ height: VP, ...CARD_MASK, ["--card" as string]: d.light ? CARD_C.light.card : CARD_C.dark.card }} />
                    <Clip />
                    <div className={s.icon} style={{ left: 261, top: 45.5, width: 20, height: 20 }}><Asterisk size={20} color={ICON_C} w={1.5} /></div>
                    <div className={s.icon} style={{ left: DIAMOND.u, top: DIAMOND.v, width: DIAMOND.w, height: DIAMOND.h }}><Diamond light={d.light} /></div>
                    <div className={s.icon} style={{ left: 263.5, top: 208, width: 19, height: 19 }}><Glyph name={d.icon} size={19} color={ICON_C} w={1.45} /></div>
                    <div className={s.rule} style={{ left: 21, top: 351, width: 261 }} />
                    <div data-k={"qr" + i} className={s.qr} style={{ opacity: 0 }}><QrCard text={links[i]} /></div>
                    {T(CARD_TXT.tc, `${M} ${s.w500}`, "rgb(154,162,152)", `TC / ${d.n}`)}
                    {T(CARD_TXT.pass, `${M} ${s.w500} ${s.pass}`, "rgb(154,162,152)", L.pass)}
                    {T(CARD_TXT.club, `${B} ${s.w600} ${s.club}`, "rgb(232,236,222)", L.club)}
                    {T(CARD_TXT.kind, `${M} ${s.w500} ${s.kind}`, "rgb(184,218,208)", `${d.n} / ${d.kind}`)}
                    <h2 className={s.ticketTitle}>
                      {T(d.title.length > 1 ? CARD_TXT.t1 : CARD_TXT.t2, `${B} ${s.w600} ${s.big}`, "rgb(226,232,215)", d.title[0])}
                      {d.title.length > 1 && T(CARD_TXT.t2, `${B} ${s.w600} ${s.big}`, "rgb(226,232,215)", d.title[1])}
                    </h2>
                    {T(CARD_TXT.sub, `${I} ${s.w400} ${s.subLine}`, "rgb(132,135,128)", d.sub)}
                    {T(CARD_TXT.name, `${M} ${s.w500} ${s.name}`, "rgb(232,234,224)", C.name)}
                    {T(CARD_TXT.year, `${M} ${s.w500}`, "rgb(214,217,206)", L.year)}
                    <div data-k={"stubR" + i} className={s.piece} style={{ visibility: "hidden" }} aria-hidden>{stubContent(i)}</div>
                    <div data-k={"stubL" + i} className={s.piece}>{stubContent(i)}</div>
                    <div data-k={"hit" + i} className={s.hit} style={{ top: VP, height: TH - VP }} role="button" tabIndex={0}
                      aria-label={`${d.take}: ${shortLink(links[i])}`} />
                    {/* without JavaScript the stub is a plain link */}
                    <noscript>
                      <a className={s.noJsLink} href={links[i]} style={{ top: VP, height: TH - VP }}>{`${d.take}: ${shortLink(links[i])}`}</a>
                    </noscript>
                    {editing && !phone && (
                      <input className={`${s.edit} ${M} ${s.w500} ${d.light ? s.editLight : ""}`} value={links[i]} aria-label={d.label}
                        spellCheck={false} autoFocus={i === 0}
                        style={{ left: CARD_TXT.url[0] - 3, top: CARD_TXT.url[1] - 2, fontSize: CARD_TXT.url[2], letterSpacing: CARD_TXT.url[3] }}
                        onChange={(e) => setLink(i, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(false); }}
                        onPointerDown={(e) => e.stopPropagation()} />
                    )}
                  </div>
                  <div data-k={"taken" + i} className={s.taken} style={{ opacity: 0, visibility: "hidden" }}>
                    {check(85, 399.6, 8.4, TAKEN_C)}
                    {T(CARD_TXT.taken, `${M} ${s.w500}`, TAKEN_C, L.taken)}
                    <button type="button" data-k={"again" + i} tabIndex={-1} className={`${s.again} ${M}`} onClick={() => act.current?.again(i)}
                      style={{ left: AGAIN_BOX.u, top: AGAIN_BOX.v, width: AGAIN_BOX.w, height: AGAIN_BOX.h, fontSize: CARD_TXT.again[2], letterSpacing: CARD_TXT.again[3], color: TAKEN_C }}>
                      {L.again.replace("↻", "").trim()}
                      {L.again.includes("↻") && <span className={s.againIcon}><Glyph name="refresh" size={7.5} color="currentColor" w={2.6} /></span>}
                    </button>
                  </div>
                  {T(CARD_TXT.pct, `${M} ${s.w700}`, "rgb(238,224,198)", "100%", "pctLo" + i, { opacity: 0 })}
                </div>
              ))}
              {/* the % of the ticket being pulled sits above the neighbouring ticket */}
              {C.tickets.map((_, i) => (
                <div key={i} data-k={"ov" + i} className={s.ticket} style={{ transform: pose(i) }} aria-hidden>
                  {T(CARD_TXT.pct, `${M} ${s.w700}`, "rgb(238,224,198)", "0%", "pct" + i, { opacity: 0 })}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* stubs that came off */}
        <div data-k="fx" className={s.fx} aria-hidden>
          {C.tickets.map((_, i) => (
            <div key={i} data-k={"fall" + i} className={s.fall} style={{ visibility: "hidden" }}>{stubContent(i)}</div>
          ))}
        </div>
        {/* hero text, hint, clipboard and toast (desktop: the lower half of the stage) */}
        <div className={s.lower}>
          <div data-k="hero" className={`${s.heroLayer} ${s.openHero}`} style={{ transformOrigin: `${HERO_IN.origin[0]}px ${HERO_IN.origin[1]}px` }}>
            <div className={s.heroBox}>{heroText}</div>
          </div>
          <div data-k="hint" className={`${s.hint} ${s.openHint}`} style={{ ["--x" as string]: `${HINT.cx}px`, ["--y" as string]: `${HINT.y}px` }}>
            <HookArrow color="rgb(255,206,176)" />
            <span data-k="hintText" className={`${M} ${s.w500} ${s.hintText}`}>{L.hintIdle}</span>
            <span className={s.hbox} aria-hidden><Glyph name="down" size={11} color="rgb(255,214,186)" w={1.7} /></span>
          </div>
          <div data-k="dock" className={s.dock}>
            <div className={s.dockInner}>
              <div data-k="panel" className={s.panel} aria-hidden
                style={{ ["--x" as string]: `${PANEL.x}px`, ["--y" as string]: `${PANEL.y}px`, width: PANEL.w, height: PANEL.h, opacity: 0, transform: `rotate(${PANEL.rot}deg)` }}>
                <div className={s.panelHead}>
                  <i style={{ background: "rgb(205,112,104)" }} /><i style={{ background: "rgb(214,180,92)" }} /><i style={{ background: "rgb(152,170,128)" }} />
                </div>
                <div className={s.icon} style={{ left: 121, top: 9.5, width: 14, height: 14 }}><Glyph name="clip" size={14} color="rgb(80,78,64)" w={1.7} /></div>
                <div className={s.icon} style={{ left: 266, top: 10, width: 13, height: 13 }}><Glyph name="trash" size={13} color="rgb(126,120,104)" w={1.6} /></div>
                <div className={s.sep} style={{ top: 85.5 }} />
                <div className={s.sep} style={{ top: 135.5, left: 0, right: 0 }} />
                {rowIcon("1", ROW_ICON.v1, C.tickets[seed[0]].icon)}
                <div className={s.icon} style={{ left: 266, top: 58, width: 13, height: 13 }}><Glyph name="check" size={13} color="rgb(130,146,108)" w={1.7} /></div>
                {T(PANEL_TXT.head, `${I} ${s.w600}`, "rgb(68,66,54)", L.clipboard)}
                {T(PANEL_TXT.r1t, `${I} ${s.w600} ${s.rowText}`, "rgb(41,37,26)", C.tickets[seed[0]].label, "r1t")}
                {T(PANEL_TXT.r1s, `${M} ${s.w500} ${s.rowText}`, "rgb(140,134,120)", copyText(links[seed[0]]), "r1s")}
                {seed.length > 1 && (
                  <>
                    {rowIcon("2", ROW_ICON.v2, C.tickets[seed[1]].icon)}
                    <div className={s.icon} style={{ left: 266, top: 99.5, width: 14, height: 14 }}><Glyph name="clip" size={14} color="rgb(130,150,104)" w={1.6} /></div>
                    {T(PANEL_TXT.r2t, `${I} ${s.w600} ${s.rowText}`, "rgb(41,37,26)", C.tickets[seed[1]].label, "r2t")}
                    {T(PANEL_TXT.r2s, `${M} ${s.w500} ${s.rowText}`, "rgb(140,134,120)", copyText(links[seed[1]]), "r2s")}
                  </>
                )}
                <i className={s.greenDot} />
                {T(PANEL_TXT.foot, `${M} ${s.w500}`, "rgb(140,134,120)", L.clipboardFoot)}
                {T(PANEL_TXT.keys, `${M} ${s.w500}`, "rgb(96,92,80)", L.keys)}
              </div>
              <div data-k="toast" className={s.toast} role="status"
                style={{ ["--x" as string]: `${TOAST.cx}px`, ["--y" as string]: `${TOAST.y}px`, height: TOAST.h, visibility: "hidden" }}>
                {check(20.3, 15.4, 11.4, "rgb(150,226,214)", 1.25)}
                <span data-k="toastText" className={`${I} ${s.w400}`}>{C.tickets[0].toast}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* phone: hero text in the flow, link fields when editing */}
      <div className={s.phoneHero}>
        {heroText}
        {editing && phone && (
          <div className={s.phoneEdit}>
            {C.tickets.map((d, i) => (
              <label key={i} className={`${s.phoneField} ${M}`}>
                <Glyph name={d.icon} size={16} color="rgb(255,214,190)" w={1.6} />
                <input value={links[i]} aria-label={d.label} spellCheck={false} autoFocus={i === 0}
                  onChange={(e) => setLink(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(false); }} />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
