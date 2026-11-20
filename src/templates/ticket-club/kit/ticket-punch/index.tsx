"use client";

// The Polar Express invitation with a hole punch. Over the component the pointer is a hole punch.
// Punching "Register" leaves a hole (its disc falls away), the invitation drops out and a golden ticket
// falls in, tilting toward the punch and bobbing; the first press on the ticket punches GOING hole by
// hole (the punch prints it by itself), every further press punches a new hole, and "Done" appears.
// Done brings the invitation back as "You’re going ✓" (which starts over); now presses on the card
// punch paper holes in it. Every hole is real (the card / ticket is cut), every disc falls.
// Interface, the ticket (gold foil, engraved frame, plaques and lettering), holes, discs and punch are
// code; only the engraved scene in the ticket's oval is a picture (prop `image`).
// Timing and motion were fitted to the recording (seconds).
//
// Self-contained: imports only react and files in this folder. Fluid: the card reflows to its container,
// everything else scales with the card width. Theme: --ink, --paper, --accent, --caption (the line over the
// ticket, which stands on the page; else --ink), --font-sans, and
// --font-ticket (else --font-serif) for the ticket's lettering.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ticketPunchContent, type TicketPunchContent } from "./content";
import { clamp, clamp01 } from "./motion";
import { PLIERS } from "./pliers";
import { paintPliers, pliersBox, PLIERS_MARGIN } from "./pliers-raster";
import { renderFace, TW, TH, NOTCH_R, NOTCH_O } from "./ticket-face";
import s from "./ticket-punch.module.css";

export type Phase = "invite" | "ticket" | "going";
export type TicketPunchProps = Partial<TicketPunchContent> & {
  /** Called when the flow moves on: "ticket" once registered, "going" after Done, "invite" when it starts over. */
  onPhase?: (phase: Phase) => void;
  className?: string;
  style?: CSSProperties;
};

// design units: the card is 856 wide
const CARD_W = 856;
const HOLE_R = 14.5, CARD_HOLE_R = 13, DISC_R = 14.5;
// ticket pose: perspective(P) about (OX, OY) relative to the ticket centre, tilted toward the lagged punch
const P = 3507.1, ODX = -247.65, ODY = 191.95, SC = 1.00667;
const KX = 0.00077, KY = 0.000513, PDX = 134.64, PDY = -12.8, TAU = 0.1565;
// and turned a little in its plane, as recorded (its top edge rising to the right: about 1° at rest, more as
// it tilts toward the punch on the right)
const RZ0 = -0.0165, KZ = -0.5;
const CY_FRAC = 0.4628; // ticket centre, fraction of the card height
const BOB = { a: -7.767, T: 8.9297, ph: -1.342, t0: 2.378 };
const BR = { ky: -0.01556, kx: -0.000743, dy: 19.28, dx: -162.95, tau: 0.1644, lo: 0.7683, hi: 1.1579 };
// the brightest the ticket gets (light × drop flash), for its lit copy
const LIT = 1.1579 * 1.19;
const DROP_BR: [number, number][] = [[0, 0.55], [0.12, 0.6], [0.145, 1.03], [0.23, 1.19], [0.3, 1.16], [0.4, 1.1], [0.55, 1.06], [0.74, 1]];
const SHADOW = { dx: -396.8, dy: 272.56, w: 790, h: 30 };
// timeline (s)
const CARD_OUT_T = 0.4, CARD_OUT_D = 1054;
const DROP_DELAY = 1.062, DROP_T = 1.182, DROP_D = 700;
const YES_T = 0.15;
const GOING_DELAY = 0.067, GOING_HOLD = 0.1, DONE_AT = 2.75, DONE_T = 0.15;
const CARD_IN_DELAY = 0.1023, CARD_IN_TAU = 0.1063, CARD_IN_T = 0.6024, CARD_IN_D = 900;
const SQUEEZE = 0.025;
const G = 1000;

type V = { x: number; y: number };
type Disc = { x: number; y: number; vx: number; vy: number; r: number; vr: number; kind: "ticket" | "dark" | "white"; tx: number; ty: number; el: HTMLElement };

const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;
// the slip's torn edges: teeth 34.3 px apart from 1.65 px left of its edge, as one path each (no tiled image,
// so no seams or bleeding at any scale); each strip reaches 1 px into the white body under it
const TEETH = 64;
const TEETH_TOP = `M-1.65 17V16.533${"l17.15-16.533l17.15 16.533".repeat(TEETH)}V17z`;
const TEETH_BOT = `M-1.65 0V.433${"l17.15 17.567l17.15-17.567".repeat(TEETH)}V0z`;
function lerpKeys(k: [number, number][], u: number) {
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++)
    if (u <= k[i][0]) return k[i - 1][1] + ((k[i][1] - k[i - 1][1]) * (u - k[i - 1][0])) / (k[i][0] - k[i - 1][0]);
  return k[k.length - 1][1];
}
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Ticket px (relative to its centre) → design px homography for a pose (3 × 3, row major). */
function homography(rx: number, ry: number, rz: number, ty: number, CX: number, CY: number) {
  const OX = CX + ODX, OY = CY + ODY;
  const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry), cZ = Math.cos(rz), sZ = Math.sin(rz);
  // the columns of rotateZ · rotateX · rotateY · scale for the ticket's x and y axes
  const x1 = cY * SC, x2 = sY * sX * SC, y1 = 0, y2 = cX * SC;
  const a1 = cZ * x1 - sZ * x2, a2 = sZ * x1 + cZ * x2, a3 = -sY * cX * SC;
  const b1 = cZ * y1 - sZ * y2, b2 = sZ * y1 + cZ * y2, b3 = sX * SC;
  return [
    -OX * a3 + P * a1, -OX * b3 + P * b1, P * CX,
    -OY * a3 + P * a2, -OY * b3 + P * b2, P * (CY + ty),
    -a3, -b3, P,
  ];
}
function apply(h: number[], x: number, y: number): V {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}
function unapply(h: number[], X: number, Y: number): V {
  const [a, b, c, d, e, f, g, i, j] = h;
  return apply([e * j - f * i, c * i - b * j, b * f - c * e, f * g - d * j, a * j - c * g, c * d - a * f, d * i - e * g, b * g - a * i, a * e - b * d], X, Y);
}
function outline(ctx: CanvasRenderingContext2D, k: number, inset = 0) {
  // (the notches: arcs about a centre beyond each end, NOTCH_O out; `inset` grows them and the sides in)
  const w = TW * k, h = TH * k, r = NOTCH_R * k + inset, i = inset, o = NOTCH_O * k;
  const a = Math.atan2(Math.sqrt(r * r - (i + o) ** 2), i + o);
  ctx.beginPath();
  ctx.moveTo(i, i);
  ctx.lineTo(w - i, i);
  ctx.arc(w + o, h / 2, r, a - Math.PI, Math.PI - a, true);
  ctx.lineTo(w - i, h - i);
  ctx.lineTo(i, h - i);
  ctx.arc(-o, h / 2, r, a, -a, true);
  ctx.closePath();
}
const onTicket = (x: number, y: number) =>
  x > HOLE_R && y > HOLE_R && x < TW - HOLE_R && y < TH - HOLE_R &&
  Math.hypot(x + NOTCH_O, y - TH / 2) > NOTCH_R + HOLE_R && Math.hypot(x - TW - NOTCH_O, y - TH / 2) > NOTCH_R + HOLE_R;

export function TicketPunch(props: TicketPunchProps) {
  const c = { ...ticketPunchContent, ...props };
  const { className, style } = props;
  const root = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const onPhaseRef = useRef(props.onPhase);
  // the latest callback, kept outside render (React refs are not written while rendering)
  useEffect(() => {
    onPhaseRef.current = props.onPhase;
  });
  const word = useRef(c.word);
  const text = useRef({ number: c.number, admit: c.admit });
  const [phase, setPhase] = useState<Phase>("invite");
  const [g, setG] = useState(1);
  const [cardHoles, setCardHoles] = useState<V[]>([]);
  const [regHole, setRegHole] = useState<V | null>(null);
  const api = useRef<{
    register: (p: V | null) => void; done: () => void; reset: () => void; key: () => void;
    down: (p: V, target: HTMLElement, touch: boolean) => void;
  } | null>(null);

  useEffect(() => {
    const R = root.current!;
    const ro = new ResizeObserver(() => setG(R.clientWidth / CARD_W));
    ro.observe(R);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const R = root.current!, CARD = cardRef.current!;
    const E: Record<string, HTMLElement> = {};
    R.querySelectorAll<HTMLElement>("[data-tp]").forEach((el) => { E[el.dataset.tp!] = el; });
    const TC = E.face as unknown as HTMLCanvasElement;
    const tctx = TC.getContext("2d")!;
    const dctx = (E.faceDim as unknown as HTMLCanvasElement).getContext("2d")!;
    const lctx = (E.faceLit as unknown as HTMLCanvasElement).getContext("2d")!;
    // holes already cut into the face and into each lighting copy (a copy is only cut while it shows)
    let cut = 0, cutD = 0, cutL = 0, needD = false, needL = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = word.current;
    const S = {
      phase: "invite" as Phase, t: 0, ptr: null as V | null, down: false, lag: null as V | null, blag: null as V | null,
      tReg: -1, tDone: -1, tGoing: -1, going: 0, fly: { x: 0, y: 0 }, squeeze: -1e9, holes: [] as V[], dirty: true,
      discs: [] as Disc[], h: homography(0, 0, RZ0, 0, 428, 423), seed: 1,
    };
    // the ticket face, rendered once (scene + lettering) at 2 px per unit; holes are cut from a copy
    // px per design unit: enough for the ticket's size on this screen (at most 2)
    let FACE = 2;
    let art: HTMLCanvasElement | null = null;
    let alive = true;
    const img = new Image();
    const compose = async (scene: HTMLImageElement | null) => {
      const cs = getComputedStyle(R);
      const font = cs.getPropertyValue("--font-ticket").trim() || cs.getPropertyValue("--font-serif").trim() || "Georgia, \"Times New Roman\", serif";
      try { await Promise.all([document.fonts.load(`700 50px ${font}`), document.fonts.load(`600 32px ${font}`)]); } catch { /* system fallback */ }
      const cv = document.createElement("canvas");
      FACE = Math.min(2, Math.max(1, Math.ceil(size.k * Math.min(2, window.devicePixelRatio || 1) * 1.04 * 4) / 4));
      await renderFace(cv, FACE, scene, { number: text.current.number, admit: text.current.admit, font });
      if (!alive) return;
      for (const el of [TC, E.faceDim, E.faceLit] as unknown as HTMLCanvasElement[]) { el.width = cv.width; el.height = cv.height; }
      art = cv;
      S.dirty = true;
      void prepaint(cv);
      kick();
    };
    // the scene is decoded off the main thread before it is drawn into the face
    img.src = c.image;
    img.decode().then(() => { if (alive) void compose(img); }, () => { if (alive) void compose(img.complete && img.naturalWidth ? img : null); });
    const setP = (p: Phase) => { S.phase = p; setPhase(p); onPhaseRef.current?.(p); };

    // root px ↔ design px; sizes are read when they change, never inside the frame loop
    const size = { k: 1, w: 1, h: 1 };
    const measure = () => {
      size.w = R.clientWidth; size.h = R.clientHeight; size.k = size.w / CARD_W;
      kick();
      clearTimeout(ptimer);
      ptimer = window.setTimeout(paintPunch, pc ? 300 : 0);
    };
    // the punch, painted into its two canvases (open, squeezed) at the size it is shown; again if that changes
    let pc = 0, pgen = 0, ptimer = 0;
    const paintPunch = async () => {
      const c = Math.min(2, window.devicePixelRatio || 1) * clamp(size.k, 0.45, 1);
      if (pc && Math.abs(c / pc - 1) < 0.15) return;
      pc = c;
      const gen = ++pgen;
      for (const key of ["open", "down"] as const) {
        const cv = (key === "open" ? E.pOpen : E.pDown) as unknown as HTMLCanvasElement;
        const pz = PLIERS[key];
        if (!(await paintPliers(cv, pz, c, () => alive && gen === pgen))) return;
        const bx = pliersBox(pz, c);
        Object.assign(cv.style, { width: `${bx.w}px`, height: `${bx.h}px`, left: `${-pz.hot[0] / 2 - PLIERS_MARGIN}px`, top: `${-pz.hot[1] / 2 - PLIERS_MARGIN}px` });
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(R);
    const gNow = () => size.k;
    const centre = () => { const k = gNow(); return { CX: CARD_W / 2, CY: (size.h / k) * CY_FRAC }; };
    // a punched-out disc: a small element of its own (the ticket's: a little canvas with its bit of the face,
    // copied from the face itself, so nothing is decoded while punching), moved only by transforms; ticket
    // discs fall behind the ticket, card discs in front
    const drop = (x: number, y: number, kind: Disc["kind"], seed: number, tx = 0, ty = 0) => {
      if (reduced) return;
      const r = rng(seed * 7919);
      const rad = kind === "white" ? CARD_HOLE_R : DISC_R, k = size.k;
      let el: HTMLElement;
      if (kind === "ticket" && art) {
        const cv = document.createElement("canvas");
        const px = Math.max(8, Math.round(2 * rad * k * Math.min(3, window.devicePixelRatio || 1)));
        cv.width = cv.height = px;
        const x2 = cv.getContext("2d")!;
        x2.beginPath(); x2.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); x2.clip();
        x2.drawImage(art, (tx - rad) * FACE, (ty - rad) * FACE, rad * 2 * FACE, rad * 2 * FACE, 0, 0, px, px);
        x2.fillStyle = "rgba(40, 25, 0, 0.28)";
        x2.fillRect(0, 0, px, px);
        el = cv;
      } else el = document.createElement("i");
      el.className = `${s.disc} ${kind === "dark" ? s.discDark : kind === "white" ? s.discWhite : ""}`;
      Object.assign(el.style, { width: `${2 * rad * k}px`, height: `${2 * rad * k}px`, left: `${-rad * k}px`, top: `${-rad * k}px` });
      (kind === "ticket" ? E.back : E.front).appendChild(el);
      S.discs.push({ x, y, vx: (r() - 0.5) * 50, vy: 40 + r() * 40, r: r() * Math.PI, vr: (r() - 0.5) * 12, kind, tx, ty, el });
    };
    // the face whole (its holes are cut after); its copies are then out of date
    let staleD = true, staleL = true;
    const paintFace = () => {
      if (!art) return;
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, TC.width, TC.height);
      tctx.drawImage(art, 0, 0, TC.width, TC.height); // (already within the die-cut outline)
      tctx.lineWidth = 3;
      tctx.strokeStyle = "rgba(96, 62, 8, 0.6)";
      outline(tctx, FACE, 1.5);
      tctx.stroke();
      tctx.lineWidth = 2;
      tctx.strokeStyle = "rgba(255, 236, 170, 0.35)";
      outline(tctx, FACE, 5);
      tctx.stroke();
      cut = 0;
      staleD = staleL = true;
    };
    // the dimmed copy: the face's silhouette in black (holes and all, as the face is now)
    const paintDim = () => {
      dctx.clearRect(0, 0, TC.width, TC.height);
      dctx.drawImage(TC, 0, 0);
      dctx.globalCompositeOperation = "source-in";
      dctx.fillStyle = "#000";
      dctx.fillRect(0, 0, TC.width, TC.height);
      dctx.globalCompositeOperation = "source-over";
      cutD = cut;
      staleD = false;
    };
    // the lit copy: the face at the brightest it gets (× LIT: the face added onto itself, kept to its shape)
    const paintLit = () => {
      lctx.clearRect(0, 0, TC.width, TC.height);
      lctx.drawImage(TC, 0, 0);
      lctx.globalCompositeOperation = "lighter";
      lctx.globalAlpha = LIT - 1;
      lctx.drawImage(TC, 0, 0);
      lctx.globalAlpha = 1;
      lctx.globalCompositeOperation = "destination-in";
      lctx.drawImage(TC, 0, 0);
      lctx.globalCompositeOperation = "source-over";
      cutL = cut;
      staleL = false;
    };
    // painted ahead, a part per idle moment, so the ticket's first frame has nothing to draw
    const prepaint = async (a: HTMLCanvasElement) => {
      for (const step of [() => { if (S.dirty) { S.dirty = false; paintFace(); } }, () => { if (staleD) paintDim(); }, () => { if (staleL) paintLit(); }]) {
        await new Promise<void>((ok) => (typeof requestIdleCallback === "function" ? requestIdleCallback(() => ok(), { timeout: 1000 }) : setTimeout(ok, 50)));
        if (!alive || art !== a) return;
        step();
      }
    };
    // cut holes [from…] into a face canvas, with the pressed edge (on the paper only) in colour `edge`
    const cutHoles = (ctx: CanvasRenderingContext2D, from: number, edge: string) => {
      for (const h of S.holes.slice(from)) {
        const x = h.x * FACE, y = h.y * FACE, r = HOLE_R * FACE;
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        if (!edge) continue;
        ctx.save();
        outline(ctx, FACE);
        ctx.clip();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = edge;
        ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    };
    const punch = (x: number, y: number, seed: number) => {
      S.holes.push({ x, y });
      const q = apply(S.h, x - TW / 2, y - TH / 2);
      drop(q.x, q.y, "ticket", seed, x, y);
    };
    const freeSpot = () => {
      const r = rng(++S.seed * 31);
      for (let n = 0; n < 200; n++) {
        const x = 30 + r() * (TW - 60), y = 30 + r() * (TH - 60);
        if (onTicket(x, y) && !S.holes.some((h) => Math.hypot(h.x - x, h.y - y) < HOLE_R * 2.2)) return { x, y };
      }
      return null;
    };
    const startGoing = (p: V) => {
      S.tGoing = S.t;
      S.fly = p;
      if (reduced) { W.forEach(([x, y]) => S.holes.push({ x, y })); S.going = W.length; S.dirty = true; }
    };
    const register = (p: V | null) => {
      if (S.tReg >= 0 || S.phase !== "invite") return;
      const k = gNow();
      const b = E.reg.getBoundingClientRect(), rr = R.getBoundingClientRect();
      const q = p ?? { x: (b.left + b.width / 2 - rr.left) / k, y: (b.top + b.height / 2 - rr.top) / k };
      S.tReg = S.t;
      drop(q.x, q.y, "dark", 7);
      const cr = CARD.getBoundingClientRect();
      setRegHole({ x: (q.x * k + rr.left - cr.left) / k, y: (q.y * k + rr.top - cr.top) / k });
      onPhaseRef.current?.("ticket");
    };
    const done = () => { S.tDone = S.t; setP("going"); };
    const reset = () => {
      S.discs.forEach((d) => d.el.remove());
      Object.assign(S, { tReg: -1, tDone: -1, tGoing: -1, going: 0, holes: [], dirty: true, discs: [] });
      setCardHoles([]);
      setRegHole(null);
      setP("invite");
    };
    const down = (p: V, target: HTMLElement, touch: boolean) => {
      if (!touch) S.ptr = p;
      S.down = true;
      if (S.phase === "ticket") {
        const { x, y } = unapply(S.h, p.x, p.y);
        const tx = x + TW / 2, ty = y + TH / 2;
        if (!onTicket(tx, ty)) return;
        if (S.tGoing < 0) startGoing(p);
        else if (S.going >= W.length && !S.holes.some((h) => Math.hypot(h.x - tx, h.y - ty) < HOLE_R * 1.5)) punch(tx, ty, ++S.seed + 100);
      } else if (S.phase === "going" && !target.closest("button")) {
        const k = gNow();
        const cr = CARD.getBoundingClientRect(), rr = R.getBoundingClientRect();
        const x = (p.x * k + rr.left - cr.left) / k, y = (p.y * k + rr.top - cr.top) / k;
        const cw = cr.width / k, chh = cr.height / k;
        if (x > CARD_HOLE_R && y > 16 + CARD_HOLE_R && x < cw - CARD_HOLE_R && y < chh - 17 - CARD_HOLE_R) {
          setCardHoles((hs) => [...hs, { x, y }]);
          drop(p.x, p.y, "white", ++S.seed + 300);
        }
      }
    };
    const key = () => {
      if (S.phase !== "ticket") return;
      if (S.tGoing < 0) { const { CX, CY } = centre(); startGoing({ x: CX, y: CY + 240 }); return; }
      if (S.going < W.length) return;
      const q = freeSpot();
      if (q) { punch(q.x, q.y, ++S.seed + 100); S.squeeze = S.t; }
    };
    const wrap = <A extends unknown[]>(f: (...a: A) => void) => (...a: A) => { f(...a); kick(); };
    api.current = { register: wrap(register), done: wrap(done), reset: wrap(reset), key: wrap(key), down: wrap(down) };

    const toDesign = (e: PointerEvent): V => {
      const r = R.getBoundingClientRect(), k = r.width / CARD_W;
      return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
    };
    const onMove = (e: PointerEvent) => { if (e.pointerType !== "touch") { S.ptr = toDesign(e); kick(); } };
    const onLeave = () => { S.ptr = null; S.down = false; kick(); };
    const onDown = (e: PointerEvent) => { down(toDesign(e), e.target as HTMLElement, e.pointerType === "touch"); kick(); };
    const onUp = () => { if (S.down) { S.down = false; kick(); } };
    const opts = { passive: true } as const;
    R.addEventListener("pointermove", onMove, opts);
    R.addEventListener("pointerleave", onLeave, opts);
    R.addEventListener("pointerdown", onDown, opts);
    window.addEventListener("pointerup", onUp, opts);

    const set = (el: HTMLElement | undefined, css: Partial<Record<keyof CSSStyleDeclaration, string>>) => {
      if (!el) return;
      const st = el.style as unknown as Record<string, string>;
      for (const [k, v] of Object.entries(css)) if (st[k] !== v) st[k] = v as string;
    };
    // the frame loop runs while something moves and sleeps otherwise; its clock stops while it sleeps,
    // while the component is hidden (e.g. a page of a stack that is not shown) or off screen
    let raf = 0, last = -1, poll = 0, onScreen = true;
    const io = new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; if (onScreen) kick(); });
    io.observe(R);
    const shown = () => onScreen && document.visibilityState === "visible" && (R.checkVisibility?.({ visibilityProperty: true }) ?? true);
    const loop = (nowMs: number) => {
      raf = 0;
      if (!shown()) { last = -1; if (onScreen && !poll) poll = window.setTimeout(() => { poll = 0; kick(); }, 250); return; }
      const dt = last >= 0 ? Math.min(0.1, (nowMs - last) / 1000) : 0;
      last = nowMs;
      const t = (S.t += dt);
      const k = gNow();
      const { CX, CY } = centre();
      const Hd = size.h / k;
      // the punch: the pointer, or the page while GOING is printed
      let p: V | null = S.ptr;
      let auto = false;
      if (S.tGoing >= 0 && !reduced) {
        const gt = t - S.tGoing - GOING_DELAY;
        const end = W[W.length - 1][2];
        if (gt < 0) {
          const u = easeOutCubic(clamp01((t - S.tGoing) / GOING_DELAY));
          const q = apply(S.h, W[0][0] - TW / 2, W[0][1] - TH / 2);
          p = { x: S.fly.x + (q.x - S.fly.x) * u, y: S.fly.y + (q.y - S.fly.y) * u };
          auto = true;
        } else if (gt <= end + GOING_HOLD) {
          let i = 0;
          while (i < W.length - 1 && W[i + 1][2] <= gt) i++;
          const [x0, y0, s0] = W[i];
          const [x1, y1, s1] = W[Math.min(i + 1, W.length - 1)];
          const u = s1 > s0 ? clamp01((gt - s0) / (s1 - s0)) : 0;
          p = apply(S.h, x0 + (x1 - x0) * u - TW / 2, y0 + (y1 - y0) * u - TH / 2);
          auto = true;
        }
      }
      const target = p ?? { x: CX + PDX, y: CY + PDY };
      if (!S.lag) S.lag = { ...target };
      if (!S.blag) S.blag = { ...target };
      const a = 1 - Math.exp(-dt / TAU), ab = 1 - Math.exp(-dt / BR.tau);
      S.lag.x += (target.x - S.lag.x) * a; S.lag.y += (target.y - S.lag.y) * a;
      S.blag.x += (target.x - S.blag.x) * ab; S.blag.y += (target.y - S.blag.y) * ab;

      // the invitation: falls out after Register, drops back in after Done
      if (S.phase === "invite") {
        if (S.tReg >= 0) {
          const u = reduced ? 1 : clamp01((t - S.tReg) / CARD_OUT_T);
          set(CARD, { transform: `translateY(${CARD_OUT_D * u * u * k}px)`, visibility: u >= 1 ? "hidden" : "inherit" });
        } else set(CARD, { transform: "none", visibility: "inherit" });
      } else if (S.phase === "going") {
        const tin = reduced ? CARD_IN_T : clamp(t - S.tDone - CARD_IN_DELAY, 0, CARD_IN_T);
        const end = Math.exp(-CARD_IN_T / CARD_IN_TAU);
        const y = (-CARD_IN_D * (Math.exp(-tin / CARD_IN_TAU) - end)) / (1 - end);
        set(CARD, { transform: y < 0 ? `translateY(${y * k}px)` : "none", visibility: "inherit" });
      } else set(CARD, { visibility: "hidden" });

      // the golden ticket
      const since = S.tReg >= 0 ? t - S.tReg - (reduced ? 0 : DROP_DELAY) : -1;
      if ((S.phase === "invite" || S.phase === "ticket") && since >= 0) {
        if (S.phase === "invite") setP("ticket");
        const u = reduced ? 1 : clamp01(since / DROP_T);
        const ty = reduced ? 0 : -DROP_D * (1 - easeOutCubic(u)) + BOB.a * Math.sin((2 * Math.PI * (since + BOB.t0)) / BOB.T + BOB.ph);
        const rx = reduced ? 0 : -KX * (S.lag.y - (CY + PDY));
        const ry = reduced ? 0 : KY * (S.lag.x - (CX + PDX));
        const rz = reduced ? RZ0 : RZ0 + KZ * ry;
        S.h = homography(rx, ry, rz, ty, CX, CY);
        const z = BR.ky * (S.blag.y - CY - BR.dy) + BR.kx * (S.blag.x - CX - BR.dx);
        const br = reduced ? 1 : (BR.lo + (BR.hi - BR.lo) / (1 + Math.exp(-z))) * lerpKeys(DROP_BR, u);
        set(E.scene, { perspective: `${P * k}px`, perspectiveOrigin: `${(CX + ODX) * k}px ${(CY + ODY) * k}px` });
        set(E.ticket, {
          visibility: "inherit", left: `${(CX - TW / 2) * k}px`, top: `${(CY - TH / 2) * k}px`, width: `${TW * k}px`, height: `${TH * k}px`,
          transform: `translateY(${ty * k}px) rotateZ(${rz}rad) rotateX(${rx}rad) rotateY(${ry}rad) scale(${SC})`,
        });
        // its light as it tilts: a black copy fades in to dim it, a brightened copy to brighten it (opacity only)
        const dim = Math.max(0, 1 - br), lit = clamp01((br - 1) / (LIT - 1));
        needD = dim > 0.002; needL = lit > 0.002;
        set(E.faceDim, { opacity: dim.toFixed(3), visibility: needD ? "inherit" : "hidden" });
        set(E.faceLit, { opacity: lit.toFixed(3), visibility: needL ? "inherit" : "hidden" });
        set(E.shadow, {
          left: `${(CX + SHADOW.dx) * k}px`, top: `${(CY + SHADOW.dy) * k}px`, width: `${SHADOW.w * k}px`, height: `${SHADOW.h * k}px`,
          opacity: String(Math.min(1.05, Math.max(0, (S.lag.y - CY - 37.56) / 390)) * clamp01((u - 0.5) / 0.5)),
        });
        set(E.yes, { opacity: String(reduced ? 1 : clamp01(since / YES_T)), visibility: "inherit" });
        if (S.tGoing >= 0) {
          const gt = t - S.tGoing - (reduced ? 0 : GOING_DELAY);
          while (S.going < W.length && W[S.going][2] <= gt) {
            punch(W[S.going][0], W[S.going][1], S.going + 1);
            S.squeeze = t;
            S.going++;
          }
          const d = clamp01((t - S.tGoing - (reduced ? 0 : DONE_AT)) / DONE_T);
          const e = 1 - (1 - d) ** 2;
          set(E.done, { opacity: String(e), transform: `translate(-50%, ${12 * (1 - e) * k}px)`, pointerEvents: d > 0 ? "auto" : "none", visibility: d > 0 ? "inherit" : "hidden" });
        } else set(E.done, { opacity: "0", pointerEvents: "none", visibility: "hidden" });
      } else {
        set(E.ticket, { visibility: "hidden" });
        set(E.shadow, { opacity: "0" });
        set(E.yes, { opacity: "0", visibility: "hidden" });
        set(E.done, { opacity: "0", pointerEvents: "none", visibility: "hidden" });
      }

      // ticket face: the drawn face inside its outline, real holes with a pressed edge, die-cut edge; and
      // its two lighting copies (made when first shown). A new hole is only cut (into a copy once it shows).
      if (art && (S.dirty || S.holes.length < cut)) { S.dirty = false; paintFace(); }
      if (art) {
        const n = S.holes.length;
        if (n > cut) { cutHoles(tctx, cut, "rgba(92, 58, 6, 0.45)"); cut = n; }
        if (needD) { if (staleD) paintDim(); if (n > cutD) { cutHoles(dctx, cutD, ""); cutD = n; } }
        if (needL) { if (staleL) paintLit(); if (n > cutL) { cutHoles(lctx, cutL, "rgba(110, 70, 8, 0.45)"); cutL = n; } }
      }

      // discs fall (and leave once well below)
      S.discs = S.discs.filter((d) => {
        if (d.y < Hd + 300) return true;
        d.el.remove();
        return false;
      });
      for (const d of S.discs) {
        d.vy += G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt;
        d.el.style.transform = `translate(${(d.x * k).toFixed(2)}px, ${(d.y * k).toFixed(2)}px) rotate(${d.r.toFixed(3)}rad)`;
      }

      // the punch
      const closed = auto ? t - S.squeeze < SQUEEZE : S.down || t - S.squeeze < 0.12;
      // squeezed: the closed punch replaces the open one for as long as it is pressed (as recorded)
      set(E.pOpen, { opacity: closed ? "0" : "1" });
      set(E.pDown, { opacity: closed ? "1" : "0" });
      const ps = clamp(k, 0.45, 1);
      set(E.punch, { transform: `translate(${(p?.x ?? 0) * k}px, ${(p?.y ?? 0) * k}px) scale(${ps})`, visibility: p ? "inherit" : "hidden" });
      R.classList.toggle(s.live, !!S.ptr);

      // keep going while anything moves
      const lagging = Math.hypot(target.x - S.lag.x, target.y - S.lag.y) > 0.05 || Math.hypot(target.x - S.blag.x, target.y - S.blag.y) > 0.05;
      const moving = lagging || auto || S.down || t - S.squeeze < 0.2 || S.discs.length > 0 || (S.dirty && !!art)
        || (S.phase === "invite" && S.tReg >= 0) || S.phase === "ticket"
        || (S.phase === "going" && t - S.tDone < CARD_IN_DELAY + CARD_IN_T + 0.05);
      if (moving) kick();
      else last = -1;
    };
    function kick() { if (!raf && raf !== -1) raf = requestAnimationFrame(loop); }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      raf = -1;
      alive = false;
      clearTimeout(poll);
      clearTimeout(ptimer);
      ro.disconnect();
      io.disconnect();
      R.removeEventListener("pointermove", onMove);
      R.removeEventListener("pointerleave", onLeave);
      R.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      api.current = null;
    };
  }, [c.image]);

  // real holes in the card: one transparent circle per hole in its mask
  const holes = [...(regHole && phase !== "going" ? [regHole] : []), ...cardHoles];
  const cardStyle: CSSProperties = holes.length
    ? (() => {
        // the card minus one small disc per hole (each mask layer only as big as its hole)
        const d = 2 * CARD_HOLE_R * g;
        const image = ["linear-gradient(#000, #000)", ...holes.map(() => "radial-gradient(circle closest-side, #000 97%, transparent 100%)")].join(", ");
        const position = ["0 0", ...holes.map((h) => `${(h.x - CARD_HOLE_R) * g}px ${(h.y - CARD_HOLE_R) * g}px`)].join(", ");
        const sz = ["100% 100%", ...holes.map(() => `${d}px ${d}px`)].join(", ");
        const comp = ["subtract", ...holes.map(() => "add")].join(", ");
        const wcomp = ["source-out", ...holes.map(() => "source-over")].join(", ");
        return {
          maskImage: image, WebkitMaskImage: image, maskPosition: position, WebkitMaskPosition: position, maskSize: sz, WebkitMaskSize: sz,
          maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskComposite: comp, WebkitMaskComposite: wcomp,
        } as CSSProperties;
      })()
    : {};
  const onRegister = (e: React.MouseEvent) => {
    const r = root.current!.getBoundingClientRect(), k = r.width / CARD_W;
    api.current?.register(e.detail === 0 ? null : { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k });
  };

  return (
    <div ref={root} className={`${s.root} ${className ?? ""}`} style={style}>
      <article ref={cardRef} className={s.card}>
        <div className={s.slip} style={cardStyle}>
          <svg className={s.teeth} aria-hidden><path d={TEETH_TOP} /></svg>
          <svg className={`${s.teeth} ${s.teethBot}`} aria-hidden><path d={TEETH_BOT} /></svg>
          <p className={s.invited}>{c.invited}</p>
          <h3 className={s.event}>{c.event}</h3>
          <p className={s.sub}>{c.sub}</p>
          <p className={s.host}>{c.host}</p>
          <div className={s.row}>
            <div className={s.cal}><span>{c.month}</span><b>{c.day}</b></div>
            <div><h4>{c.date}</h4><p>{c.time}</p></div>
          </div>
          <div className={s.row}>
            <div className={s.pin}>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2a7.5 7.5 0 00-7.5 7.5c0 5.3 6.4 11.6 6.7 11.9a1.1 1.1 0 001.6 0c.3-.3 6.7-6.6 6.7-11.9A7.5 7.5 0 0012 2zm0 10.2a2.7 2.7 0 110-5.4 2.7 2.7 0 010 5.4z" fill="#6f6f73" />
              </svg>
            </div>
            <div><h4>{c.place} <span className={s.arrow}>{c.placeArrow}</span></h4><p>{c.placeNote}</p></div>
          </div>
          <section className={s.reg}>
            <header>{c.registration}</header>
            <p className={s.welcome}>{c.welcome}</p>
            <div className={s.who}>
              <span className={s.avatar}>{c.initial}</span>
              <b>{c.name}</b>
              <span>{c.email}</span>
            </div>
            {phase === "going" ? (
              <button type="button" className={`${s.btn} ${s.going}`} onClick={() => api.current?.reset()}>{c.going}</button>
            ) : (
              <button data-tp="reg" type="button" className={s.btn} onClick={onRegister}>{c.register}</button>
            )}
          </section>
          <p className={s.foot}>{c.foot}</p>
        </div>
      </article>
      <div data-tp="back" className={s.discs} aria-hidden />
      <div data-tp="shadow" className={s.shadow} />
      <div data-tp="scene" className={s.scene}>
        <div data-tp="ticket" className={s.ticket} role="button" tabIndex={phase === "ticket" ? 0 : -1} aria-label={c.alt}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); api.current?.key(); } }}>
          <canvas data-tp="face" width={TW} height={TH} />
          <canvas data-tp="faceDim" className={s.dim} width={TW} height={TH} />
          <canvas data-tp="faceLit" className={s.lit} width={TW} height={TH} />
        </div>
      </div>
      <p data-tp="yes" className={s.yes}>{c.yes}</p>
      <button data-tp="done" type="button" className={s.done} onClick={() => api.current?.done()}>{c.done}</button>
      <div data-tp="front" className={s.discs} aria-hidden />
      <div data-tp="punch" className={s.punch} aria-hidden>
        {(["open", "down"] as const).map((k) => (
          <canvas key={k} data-tp={k === "open" ? "pOpen" : "pDown"} className={s.pliers} width={0} height={0} style={{ opacity: k === "open" ? 1 : 0 }} />
        ))}
      </div>
    </div>
  );
}

export default TicketPunch;
