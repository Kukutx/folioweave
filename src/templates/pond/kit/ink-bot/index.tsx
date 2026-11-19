"use client";

// <InkBot />: the ink-drop character, drawn as a 1-bit ordered-dither pixel image (8 × 8 Bayer matrix) on a canvas.
// Every frame (30 fps) the drop, its eyes, the ink it sheds, the sparkles and the dotted floor shadow are computed as
// a grey level on a coarse cell grid and each cell is thresholded, so soft edges and the faint rim light come out as
// dither dots. Everything is analytic (no images), measured from the recording:
//   - the eyes follow the pointer anywhere on the page (they sit on a sphere, narrowing as they turn toward its rim)
//     and the body shifts and leans a little after them; a fast turn flings a drop of ink off its side;
//   - it breathes, blinks every ten seconds or so and sheds ink from its tip and shoulder;
//   - pressing the drop (or a new `react` value) squashes it, shuts its eyes, then shows happy eyes and two sparkles.
//
//   <InkBot />                       fills its container's width (aspect 560 : 540)
//   <InkBot cell={2} />              dither cell size in CSS px of the 441 px design (a change steps through sizes)
//   <InkBot label="…" onPress={…} />  the drop becomes a keyboard-focusable button with that accessible name
//
// Colour: the `ink` prop, else --inkbot-ink, else --ink, else the recorded #2b2b2b. The eyes and light dots are holes,
// so the host background shows through on any theme. The colour is re-read when `ink` or an attribute of <html> /
// <body> changes, when the drop starts running, every 2 s, and on every step while its root's colour transition runs:
// give it the host's theme fade (--inkbot-fade, default 0 s, and --inkbot-ease, default ease) and it turns with the
// page, in step. Cells never get smaller than `minCell` CSS px. The canvas runs only while
// on screen and the page is visible; prefers-reduced-motion holds the body still (the eyes still follow).

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import CONTENT from "./content";
import s from "./ink-bot.module.css";

export type InkBotProps = {
  /** Change this value to make the bot react (squash, shut eyes, happy eyes and sparkles). */
  react?: number;
  /** Ink colour, any CSS colour (var() works). Default: --inkbot-ink, else --ink, else #2b2b2b. */
  ink?: string;
  /** Smallest dither cell in CSS px (default 2). */
  minCell?: number;
  /** @deprecated The light is analytic now; this is ignored. */
  lightMap?: string;
  /** Dither cell size in CSS px of the 441 px wide design (default 4). */
  cell?: number;
  /** Accessible name. When given, the drop is a focusable button (Enter / Space press it). */
  label?: string;
  /** Called when the drop is pressed (pointer, Enter or Space). */
  onPress?: () => void;
  className?: string;
  style?: CSSProperties;
};

const FPS = 30;
const SC = 1.27; // recording px per CSS px of the original
// the drawn region (recording px) around the drop, its ink and its shadow
const RX = 440, RY = 262, RW = 560, RH = 540;
// grid origin (recording px) for each cell size, and the Bayer phase on that grid, measured
const PH: Record<number, [number, number]> = {
  2: [1.17, 0.96],
  3: [2.46, 0.21],
  4: [-0.1, 2.56],
  5: [-1.98, 1.28],
  6: [2.43, 2.53],
  7: [3.09, 10.76],
};
const OFF: Record<number, [number, number]> = { 2: [2, 4], 4: [1, 2], 7: [6, 7] };

// body: breathing (height of the tapered top, frames), and how centre and radius follow it
const BREATH_H = 228.3, BREATH_A = 6.8, BREATH_P = 77;
const cyOf = (h: number) => 463.36 + 0.593 * h;
const rOf = (h: number) => 204.24 - 0.2284 * h;
// the body shifts and leans after the gaze (per degree of yaw)
const CX0 = 718.22, CX_YAW = 0.1414, LEAN0 = -0.001, LEAN_YAW = 0.00209;
// gaze from the pointer (degrees): yaw = A·atan(dx / D); pitch = B0 + AP·atan((dy − OY) / hypot(dx, D))
const G_A = 0.716, G_D = 258.4, G_AP = 0.563, G_B0 = 4.08, G_OY = 106.4;
const YAW: [number, number] = [-45, 45], PITCH: [number, number] = [-30, 20], REST: [number, number] = [1, -4.5];
const FOLLOW = 0.38, RELAX = 0.06; // per frame
// eyes on a sphere of radius RS below the body centre; width foreshortens toward the rim
const E_RS = 139.1, E_PHI = 0.347, E_OX = -1.1, E_OY = 25.05, E_W0 = 42.4, E_KW = 0.251, E_H = 66.2;
const BLINK = [0.86, 0.5, 0.18, 0.12, 0.28, 0.6];
const BLINK_GAP: [number, number] = [9.5 * FPS, 13 * FPS];
// reaction, by frame after the press: body deltas, shut eye heights, happy dome, sparkle opacity
const R_CY = [-13.5, -17.5, -19.7, -17.9, -14.8, -10, -6.5, -3.5, -1.5, -0.5, 0];
const R_R = [6.6, 5, 3.7, 2, 0.5, -0.4, -0.7, -0.9, -0.8, -0.4, -0.2];
const R_H = [-26, -18, -12.3, -7.2, -3, 2.1, 2.6, 3, 2.5, 1.5, 0.8];
const SHUT = [0, 15, 8, 7, 18];
const HAPPY_END = 33, DOME = 38;
const SPARK_A = [0, 0, 0.25, 0.4, 0.55, 0.75, 0.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.85, 0.7, 0.5, 0.35, 0.2, 0.1];
const SPARK_X = 207, SPARK_Y = -96, SPARK_R = 11;
// ink shed every EMIT frames: a fleck off the left shoulder, a small one right of the tip, a blob off the tip.
// Tracks: [dx, dy, w, h] per frame of age, relative to (body centre x, tip y) at birth.
const EMIT = 47;
const LEFT = [-59.9, 56.2, 10.2, 12.7, -60, 54.6, 14.3, 15.2, -60.5, 52.4, 16.5, 17.8, -60.9, 49.9, 17.4, 19.7, -61.4, 47.6, 18.3, 20.9, -62.5, 45.7, 19.4, 22.2, -64.3, 43.5, 19.1, 22.9, -65.7, 40.7, 18.1, 22.2, -66.9, 37.5, 17.8, 20.9, -68.6, 34.6, 18.1, 20.3, -70.7, 32, 19, 20.3, -72.7, 29.2, 20, 21, -74.8, 26, 19.7, 22.2, -76.4, 23.2, 19.1, 22.8, -77.6, 20.3, 19.1, 22.2, -79.2, 17.1, 18.4, 21, -81.2, 14, 17.2, 21, -83.1, 10.5, 15.9, 21.6, -84.7, 6.7, 15.2, 20.3, -85.6, 3.2, 15.8, 18.4, -86.3, 0, 16.9, 17.6, -87, -3.5, 16.9, 17, -87.4, -7.3, 16, 16.1, -88, -11.1, 14.8, 14.9, -88.4, -15.2, 12.7, 13.4, -88, -19.2, 10.6, 12.5, -87.4, -22.1, 9.4, 11.9, -87, -24.3, 8.5, 11, -86, -27.8, 7.9, 10.4, -84.3, -33.4, 7, 10.2, -82.7, -39.1, 5.7, 9.6, -81.5, -44.2, 5.1, 7.7, -80.5, -48.6, 5, 5.8, -79.9, -52.1, 4.4, 4.5, -78.9, -55.6, 2.5, 2.6];
const TIP = [6.1, 3.8, 20.3, 10.2, 4.6, 3.2, 28.6, 19.1, 4.6, 1.5, 32.4, 24.4, 4.9, -0.6, 33, 26.6, 5.2, -2.3, 33, 28.2, 6.1, -3.8, 33, 30.4, 7.1, -3.8, 33, 34.2, 7.6, -2.7, 33.3, 39, 8, -3.2, 34.3, 41.9, 8.5, -5.1, 35.3, 43.2, 8.7, -7, 35.6, 44.5, 8.7, -8.9, 35.6, 45.8, 8.7, -10.8, 35.6, 47, 8.4, -14.5, 35, 46, 7.6, -19.8, 33.5, 42.5, 7, -23.3, 32.2, 40.6, 6.6, -25, 31.3, 40.6, 5.6, -27.9, 30.7, 40, 4.2, -31.8, 30.5, 38.1, 3.3, -34.8, 29.9, 35.9, 2.4, -37.4, 28, 34.3, 1.1, -41.1, 26.7, 33.4, -0.1, -44.8, 26.6, 32.4, -1.4, -47.6, 25.3, 31.7, -2.4, -50.5, 23.4, 31.1, -3, -53.6, 22.2, 28.5, -3.8, -56.7, 20.6, 25.7, -4.6, -59, 19, 24.1, -5.7, -62, 18.1, 22.6, -7.5, -66.3, 17.1, 20.9, -8.4, -70.1, 15.2, 19.7, -8.1, -73.7, 13.2, 17.8, -8.1, -77.5, 12, 15.2, -9.1, -81.2, 10.1, 12.7, -10, -84.8, 8.2, 10.8, -10, -87.9, 7, 9.5, -9.1, -90.4, 5.1, 7, -7.8, -93.3, 3.9, 5.1, -6.4, -98.1, 4.1, 5.7, -4.6, -102.9, 3.8, 5.1, -2.8, -106.7, 2.5, 2.6];
const RIGHT = [24.9, -3, 12.7, 12.7, 27.4, -5.8, 12.7, 13.3, 30.3, -9.3, 12, 13.9, 33.8, -12.8, 11.4, 13.3, 37.6, -16, 11.4, 13.3, 41.1, -19.4, 10.8, 14.3, 44, -22.7, 10.2, 14, 46.4, -26, 9.9, 13, 48.4, -29.7, 8.9, 12.7, 50.1, -33.2, 8.6, 12.7, 51.6, -36.6, 10.2, 12.7, 52.8, -40.1, 11.4, 12.1, 53.8, -43.4, 10.8, 10.8, 54.4, -46.9, 9.5, 10.2, 55.1, -50.6, 8.2, 10.2, 55.1, -54.8, 7, 9.5, 54.1, -59.2, 6.4, 8.2, 52.8, -63.7, 6.4, 6.9, 51.5, -67.8, 6.4, 6.3, 50.3, -71.3, 6.3, 7, 49, -74.4, 5.1, 7, 47.8, -77.6, 3.8, 5.7, 46.4, -80.7, 4.1, 4.7, 44.6, -83.7, 3.8, 3.8, 42.7, -86.8, 2.6, 2.5];
const SHED: [number[], number][] = [[LEFT, 0], [RIGHT, 2], [TIP, 10]];
// rim light from behind, below right (unit vector, image axes), and a faint glow over the lower body,
// fitted to the recording's light dots (cell sizes 2 and 4)
const LX = 0.3452, LY = 0.5945, LZ = -0.7262, LA = 0.1631, LC = -0.7095, LP = 1.5699;
const LOW = 0.0035, LOW_V = 0.1383;
const RIM = Float32Array.from({ length: 1024 }, (_, i) => LA * Math.pow(i / 1023, LP));
const GLOW = Float32Array.from({ length: 256 }, (_, i) => LOW * Math.pow(i / 255, 0.2));
// floor shadow: a soft ellipse of darkness, fixed under the drop's resting place
const SH_D = 0.149, SH_X = 718.66, SH_Y = 786.31, SH_SX = 52.2, SH_SY = 7.42;

// 8 × 8 Bayer thresholds
const TH = (() => {
  let m = [[0, 2], [3, 1]];
  while (m.length < 8) {
    const n = m.length;
    const o: number[][] = [];
    for (let r = 0; r < 2 * n; r++) {
      o.push([]);
      for (let c = 0; c < 2 * n; c++) o[r].push(4 * m[r % n][c % n] + [[0, 2], [3, 1]][r < n ? 0 : 1][c < n ? 0 : 1]);
    }
    m = o;
  }
  const t = new Float32Array(64);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) t[r * 8 + c] = (m[r][c] + 0.5) / 64;
  return t;
})();

// drop outline: half-width / R along the tapered top, by normalised height above the round bottom's centre,
// resampled every 0.01
const PROF = (() => {
  const pd = [0, 0.1, 0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.53];
  const pw = [1, 0.995, 0.978, 0.952, 0.938, 0.92, 0.897, 0.872, 0.846, 0.819, 0.785, 0.753, 0.717, 0.681, 0.641, 0.6, 0.561, 0.517, 0.471, 0.423, 0.378, 0.329, 0.276, 0.224, 0.174, 0.116, 0.067, 0.03, 0];
  const t = new Float32Array(156);
  for (let i = 0; i < t.length; i++) {
    const d = Math.min(i / 100, 1.53);
    let k = 0;
    while (k < pd.length - 2 && pd[k + 1] < d) k++;
    t[i] = pw[k] + ((pw[k + 1] - pw[k]) * (d - pd[k])) / (pd[k + 1] - pd[k]);
  }
  return t;
})();

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const DEG = Math.PI / 180;

type Body = { cx: number; cy: number; r: number; h: number; lean: number; tip: number; hn: number };

// signed distance to the drop (normalised by the outline slope); leaves the raw distance and the outward normal in
// SD_U / NX / NY for the light
let SD_U = 0, NX = 0, NY = 0;
function bodySd(X: number, Y: number, b: Body) {
  const d = (b.cy - Y) / b.r;
  if (d <= 0) {
    const dx = X - b.cx, dy = Y - b.cy, q = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    NX = dx / q;
    NY = dy / q;
    SD_U = q - b.r;
    return SD_U;
  }
  const dn = (d * 1.5) / b.hn;
  const u = d / b.hn < 1 ? d / b.hn : 1;
  const xc = b.cx + b.lean * b.r * u * u;
  if (dn >= 1.53) {
    const dx = X - xc, dy = Y - b.tip, q = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    NX = dx / q;
    NY = dy / q;
    SD_U = q;
    return q;
  }
  const f = dn * 100, i = f | 0, w0 = PROF[i], w1 = PROF[i + 1];
  const hw = w0 + (w1 - w0) * (f - i);
  const g = ((w1 - w0) * 150) / b.hn;
  const ax = X - xc, sx = ax < 0 ? -1 : 1;
  const n = Math.sqrt(1 + g * g);
  SD_U = ax * sx - hw * b.r;
  NX = sx / n;
  NY = g / n;
  return SD_U / n;
}
// faint rim light of the body at the last bodySd point: 0 (ink) … ~0.1
function rimLight(Y: number, b: Body) {
  const r = clamp01(1 + SD_U / b.r);
  const v = (r * (NX * LX + NY * LY) + Math.sqrt(1 - r * r) * LZ - LC) / (1 - LC);
  const low = (Y - b.cy) / b.r - LOW_V;
  return (v <= 0 ? 0 : RIM[(v >= 1 ? 1 : v) * 1023 + 0.5 | 0]) + (low > 0 ? GLOW[(low >= 1 - LOW_V ? 1 : low / (1 - LOW_V)) * 255 + 0.5 | 0] : 0);
}
function rboxSd(X: number, Y: number, x0: number, y0: number, x1: number, y1: number) {
  const w = x1 - x0, h = y1 - y0, r = (w < h ? w : h) / 2;
  const qx = Math.abs(X - (x0 + x1) / 2) - (w / 2 - r);
  const qy = Math.abs(Y - (y0 + y1) / 2) - (h / 2 - r);
  const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0;
  return Math.sqrt(ox * ox + oy * oy) + Math.min(qx > qy ? qx : qy, 0) - r;
}
// happy eye: a dome on a flat base (straight sides for the lowest fifth, then half an ellipse)
function domeSd(X: number, Y: number, x0: number, y0: number, x1: number, y1: number) {
  const a = (x1 - x0) / 2, xc = x0 + a, yc = y1 - (y1 - y0) * 0.2;
  return Math.max(Y > yc ? Math.abs(X - xc) - a : ellSd(X, Y, xc, yc, a, yc - y0), Y - y1);
}
function ellSd(X: number, Y: number, cx: number, cy: number, rx: number, ry: number) {
  const u = (X - cx) / rx, v = (Y - cy) / ry;
  return (Math.sqrt(u * u + v * v) - 1) * (rx < ry ? rx : ry);
}
// sparkle: a four-pointed star with concave sides
function sparkSd(X: number, Y: number, cx: number, cy: number, r: number) {
  const q = Math.pow(Math.abs(X - cx), 0.6) + Math.pow(Math.abs(Y - cy), 0.6);
  return Math.pow(q, 1 / 0.6) - r;
}

// small deterministic random numbers (the same drop behaves the same on every load)
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Shed = { tab: number[]; t0: number; ax: number; ay: number };
type Fling = { x: number; y: number; vx: number; vy: number; t0: number; ax: number; ay: number };
type Spark = { x: number; y: number; vx: number; vy: number };

export function InkBot({ react = 0, ink, minCell = 2, cell = CONTENT.cell, label, onPress, className, style }: InkBotProps) {
  const root = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const opts = useRef({ minCell, cell, onPress });
  useEffect(() => {
    opts.current = { minCell, cell, onPress };
  });
  const kick = useRef<(() => void) | null>(null);
  const tint = useRef<(() => void) | null>(null);
  const seen = useRef(react);

  useEffect(() => {
    if (react === seen.current) return;
    seen.current = react;
    kick.current?.();
  }, [react]);

  useEffect(() => {
    tint.current?.();
  }, [ink]);

  useEffect(() => {
    const el = root.current, c = cv.current;
    const ctx = c?.getContext("2d");
    if (!el || !c || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rand = rng(0x1b0d);

    // ---- state (frames at 30 fps) ----
    let f = 0;
    let yaw = REST[0], pitch = REST[1], yawLast = yaw, yawVel = 0;
    let blinkAt = Math.round(BLINK_GAP[0] + rand() * (BLINK_GAP[1] - BLINK_GAP[0])), blinkF = -100;
    let reactF = -1000, lastFling = -1000;
    let cellNow = opts.current.cell;
    let shed: Shed[] = [], flings: Fling[] = [], sparks: Spark[] = [];
    const B: Body = { cx: CX0, cy: cyOf(BREATH_H), r: rOf(BREATH_H), h: BREATH_H, lean: 0, tip: 0, hn: 1 };
    const eyes = new Float64Array(10); // x0 y0 x1 y1 type, ×2
    let dirty = true;

    // ---- pointer, in recording px (the root's box is cached outside the frame loop) ----
    let rect = el.getBoundingClientRect();
    const remeasure = () => {
      rect = el.getBoundingClientRect();
    };
    let px = 0, py = 0, hasPtr = false, over = false;
    const toX = (cx: number) => RX + ((cx - rect.left) * RW) / (rect.width || 1);
    const toY = (cy: number) => RY + ((cy - rect.top) * RH) / (rect.height || 1);
    const onDrop = (cx: number, cy: number) => bodySd(toX(cx), toY(cy), B) < 2;
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      hasPtr = true;
      const o = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom && onDrop(px, py);
      if (o !== over) {
        over = o;
        el.style.cursor = o ? "pointer" : "";
      }
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) hasPtr = false;
    };

    const press = () => {
      reactF = f;
      sparks = [];
      if (!still.matches)
        for (const side of [-1, 1]) {
          const a = rand() * Math.PI * 2, v = 0.8 + rand() * 0.6;
          sparks.push({ x: B.cx + side * SPARK_X, y: cyOf(BREATH_H) + SPARK_Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
        }
      dirty = true;
    };
    kick.current = press;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      remeasure();
      px = e.clientX;
      py = e.clientY;
      hasPtr = true;
      if (!onDrop(px, py)) return;
      press();
      opts.current.onPress?.();
    };

    // ---- one 30 fps step ----
    const step = () => {
      f++;
      const calm = still.matches;
      // gaze
      let ty = REST[0], tp = REST[1];
      if (hasPtr) {
        const dx = toX(px) - B.cx, dy = toY(py) - B.cy;
        ty = Math.min(YAW[1], Math.max(YAW[0], (G_A * Math.atan2(dx, G_D)) / DEG));
        tp = Math.min(PITCH[1], Math.max(PITCH[0], G_B0 + (G_AP * Math.atan2(dy - G_OY, Math.hypot(dx, G_D))) / DEG));
      }
      const k = calm ? 1 : hasPtr ? FOLLOW : RELAX;
      yaw += (ty - yaw) * k;
      pitch += (tp - pitch) * k;
      yawVel = yawVel * 0.5 + (yaw - yawLast) * 0.5;
      yawLast = yaw;
      // body
      const tau = f - reactF;
      const h0 = calm ? BREATH_H : BREATH_H + BREATH_A * Math.sin((2 * Math.PI * f) / BREATH_P);
      B.h = h0;
      B.cy = cyOf(h0);
      B.r = rOf(h0);
      if (!calm && tau >= 0 && tau < R_CY.length) {
        B.cy += R_CY[tau];
        B.r += R_R[tau];
        B.h += R_H[tau];
      }
      B.cx = CX0 + CX_YAW * yaw;
      B.lean = LEAN0 + LEAN_YAW * yaw;
      B.tip = B.cy - (B.h * 1.53) / 1.5;
      B.hn = B.h / B.r;
      // blink
      if (f >= blinkAt) {
        blinkF = f;
        blinkAt = f + Math.round(BLINK_GAP[0] + rand() * (BLINK_GAP[1] - BLINK_GAP[0]));
      }
      // eyes
      const cp = Math.cos(pitch * DEG), ey = B.cy + E_OY + E_RS * Math.sin(pitch * DEG);
      const bl = calm ? 1 : BLINK[f - blinkF] ?? 1;
      for (let e = 0; e < 2; e++) {
        const th = yaw * DEG + (e ? E_PHI : -E_PHI);
        const ex = B.cx + E_OX + E_RS * Math.sin(th) * cp;
        const w = E_W0 * (E_KW + (1 - E_KW) * Math.cos(th)) * (B.r / 152);
        let h: number, type = 0, x = w / 2;
        if (tau >= 1 && tau < SHUT.length && !calm) h = SHUT[tau];
        else if (tau >= (calm ? 0 : SHUT.length) && tau < HAPPY_END) {
          type = 1;
          h = tau === SHUT.length ? 33 : DOME;
          x = w * 0.47;
        } else h = E_H * Math.pow(cp, 1.6) * bl;
        const o = e * 5;
        eyes[o] = ex - x;
        eyes[o + 1] = ey - h / 2;
        eyes[o + 2] = ex + x;
        eyes[o + 3] = ey + h / 2;
        eyes[o + 4] = type;
      }
      // ink: shed on a cycle, flung on fast turns, sparkles drift
      if (calm) {
        shed = [];
        flings = [];
      } else {
        const ph = f % EMIT;
        for (const [tab, at] of SHED) if (ph === at) shed.push({ tab, t0: f, ax: B.cx + (rand() - 0.5) * 4, ay: B.tip });
        shed = shed.filter((q) => (f - q.t0) * 4 < q.tab.length);
        if (Math.abs(yawVel) > 2.6 && f - lastFling > 40) {
          lastFling = f;
          const side = yawVel > 0 ? 1 : -1, ay = B.cy + 40 + rand() * 30;
          const ax = B.cx + side * (Math.sqrt(Math.max(0, B.r * B.r - (ay - B.cy) ** 2)) - 6);
          flings.push({ x: ax, y: ay, vx: side * (20 + rand() * 8), vy: -1 - rand() * 2, t0: f, ax, ay });
        }
        flings = flings.filter((q) => {
          const age = f - q.t0;
          if (age < 14) {
            q.vx *= 0.7;
            q.vy *= 0.7;
          } else {
            q.vx = q.vx * 0.8 + (q.ax - q.x) * 0.1;
            q.vy = q.vy * 0.8 + (q.ay - q.y) * 0.1;
          }
          q.x += q.vx;
          q.y += q.vy;
          return age < 60 && !(age > 16 && bodySd(q.x, q.y, B) < -4);
        });
      }
      if (tau >= SPARK_A.length) sparks = [];
      // cell size steps toward the requested one
      const want = opts.current.cell;
      if (cellNow !== want) cellNow = Math.abs(want - cellNow) <= 1 ? want : cellNow + Math.sign(want - cellNow);
    };

    // ---- drawing ----
    // the ink colour as one RGBA pixel (read only when the theme may have changed)
    let inkPx = 0, dprNow = 1, kDev = 1;
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const toPixel = (css: string) => {
      if (!probe) return 0xff2b2b2b;
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = "#000";
      probe.fillStyle = css;
      probe.fillRect(0, 0, 1, 1);
      return new Uint32Array(probe.getImageData(0, 0, 1, 1).data.buffer)[0];
    };
    let colour = getComputedStyle(el).color;
    inkPx = toPixel(colour);
    const blobs = new Float64Array(64 * 4);
    // the canvas holds one pixel per dither cell and is scaled up crisply (image-rendering: pixelated) over
    // exactly the cells' area, so a frame is one small putImageData
    let img: ImageData | null = null, px32: Uint32Array | null = null, grid = "";
    const draw = () => {
      const native = cellNow * SC;
      const pMin = (opts.current.minCell * dprNow) / kDev;
      const exact = native >= pMin && !!PH[cellNow];
      const p = native >= pMin ? native : pMin, ip = 1 / p;
      const [bx, by] = exact ? PH[cellNow] : [RX, RY];
      const [da, db] = exact ? OFF[cellNow] ?? [0, 0] : [0, 0];
      const i0 = Math.floor((RX - bx) / p), j0 = Math.floor((RY - by) / p);
      const ni = Math.ceil((RX + RW - bx) / p) - i0 + 1, nj = Math.ceil((RY + RH - by) / p) - j0 + 1;
      const g = `${ni},${nj},${p},${bx},${by}`;
      if (g !== grid || !img || !px32) {
        grid = g;
        c.width = ni;
        c.height = nj;
        const cs = c.style;
        cs.left = `${((bx + i0 * p - RX) / RW) * 100}%`;
        cs.top = `${((by + j0 * p - RY) / RH) * 100}%`;
        cs.width = `${((ni * p) / RW) * 100}%`;
        cs.height = `${((nj * p) / RH) * 100}%`;
        img = ctx.createImageData(ni, nj);
        px32 = new Uint32Array(img.data.buffer);
      }
      const buf = px32;
      buf.fill(0);
      const tau = f - reactF;
      // the loose ink of this frame, as ellipses (never thinner than one cell, so a small bot keeps its dots)
      let nb = 0;
      const blob = (x: number, y: number, w: number, h: number) => {
        if (nb >= 64) return;
        blobs[nb * 4] = x;
        blobs[nb * 4 + 1] = y;
        blobs[nb * 4 + 2] = Math.max(w / 2, p * 0.5);
        blobs[nb * 4 + 3] = Math.max(h / 2, p * 0.5);
        nb++;
      };
      for (const q of shed) {
        const o = (f - q.t0) * 4;
        blob(q.ax + q.tab[o], q.ay + q.tab[o + 1], q.tab[o + 2], q.tab[o + 3]);
      }
      for (const q of flings) {
        const age = f - q.t0, sz = age < 3 ? 8 + age * 3 : age > 40 ? Math.max(4, 17 - (age - 40) * 0.7) : 17;
        blob(q.x, q.y, sz, sz);
      }
      const sa = SPARK_A[tau] ?? 0, sg = Math.max(0, tau - 6), sr = SPARK_R * (0.93 + 0.07 * Math.sin(tau * 1.9));
      for (let jj = 0; jj < nj; jj++) {
        const j = j0 + jj;
        const Y = by + (j + 0.5) * p;
        // which parts reach this row, and where
        let xa = Infinity, xb = -Infinity;
        let ba = 0, bb = -1;
        const d = (B.cy - Y) / B.r;
        if (d <= 0) {
          const dy = Y - B.cy, m = B.r + p;
          if (dy < m) {
            const hw = Math.sqrt(m * m - dy * dy);
            ba = B.cx - hw;
            bb = B.cx + hw;
          }
        } else {
          const dn = (d * 1.5) / B.hn, u = Math.min(d / B.hn, 1), xc = B.cx + B.lean * B.r * u * u;
          if (dn < 1.53) {
            const fi = dn * 100, i = fi | 0, w0 = PROF[i], w1 = PROF[i + 1];
            const g = ((w1 - w0) * 150) / B.hn, m = 0.5 * p * Math.sqrt(1 + g * g) + p;
            const hw = (w0 + (w1 - w0) * (fi - i)) * B.r;
            ba = xc - hw - m;
            bb = xc + hw + m;
          } else if (Y > B.tip - p) {
            ba = xc - p;
            bb = xc + p;
          }
        }
        if (bb >= ba) {
          xa = ba;
          xb = bb;
        }
        const shRow = Math.abs(Y - SH_Y) < 19;
        if (shRow) {
          xa = Math.min(xa, SH_X - 128);
          xb = Math.max(xb, SH_X + 128);
        }
        for (let q = 0; q < nb; q++) {
          const o = q * 4;
          if (Math.abs(Y - blobs[o + 1]) < blobs[o + 3] + p) {
            xa = Math.min(xa, blobs[o] - blobs[o + 2] - p);
            xb = Math.max(xb, blobs[o] + blobs[o + 2] + p);
          }
        }
        let spRow = false;
        if (sa > 0)
          for (const q of sparks) {
            const sy = q.y + q.vy * sg;
            if (Math.abs(Y - sy) < SPARK_R + p) {
              spRow = true;
              const sx = q.x + q.vx * sg;
              xa = Math.min(xa, sx - SPARK_R - p);
              xb = Math.max(xb, sx + SPARK_R + p);
            }
          }
        if (xb < xa) continue;
        const ia = Math.max(0, Math.floor((xa - bx) / p) - i0), ib = Math.min(ni - 1, Math.ceil((xb - bx) / p) - i0);
        const col = (((j + da) % 8) + 8) % 8;
        const rowAt = jj * ni;
        for (let ii = ia; ii <= ib; ii++) {
          {
            const i = i0 + ii;
            const X = bx + (i + 0.5) * p;
            let lum = 1;
            if (shRow) {
              const u = (X - SH_X) / SH_SX, v = (Y - SH_Y) / SH_SY;
              lum = 1 - SH_D * Math.exp(-0.5 * (u * u + v * v));
            }
            if (X >= ba && X <= bb) {
              const cb = clamp01(0.5 - bodySd(X, Y, B) * ip);
              if (cb > 0) {
                lum = lum * (1 - cb) + cb * rimLight(Y, B);
                for (let e = 0; e < 10; e += 5) {
                  const x0 = eyes[e], ey0 = eyes[e + 1], x1 = eyes[e + 2], ey1 = eyes[e + 3];
                  if (X < x0 - p || X > x1 + p || Y < ey0 - p || Y > ey1 + p) continue;
                  const sd = eyes[e + 4] ? domeSd(X, Y, x0, ey0, x1, ey1) : rboxSd(X, Y, x0, ey0, x1, ey1);
                  const ce = clamp01(0.5 - sd * ip) * cb;
                  if (ce > 0) lum = lum * (1 - ce) + ce;
                }
              }
            }
            for (let q = 0; q < nb; q++) {
              const o = q * 4, rx = blobs[o + 2], ry = blobs[o + 3];
              if (Math.abs(X - blobs[o]) > rx + p || Math.abs(Y - blobs[o + 1]) > ry + p) continue;
              lum *= 1 - clamp01(0.5 - ellSd(X, Y, blobs[o], blobs[o + 1], rx, ry) * ip);
            }
            if (spRow)
              for (const q of sparks) {
                const sx = q.x + q.vx * sg, sy = q.y + q.vy * sg;
                if (Math.abs(X - sx) > SPARK_R + p || Math.abs(Y - sy) > SPARK_R + p) continue;
                lum *= 1 - sa * clamp01(0.5 - sparkSd(X, Y, sx, sy, sr) * ip);
              }
            if (lum <= TH[((((db - i) % 8) + 8) % 8) * 8 + col]) buf[rowAt + ii] = inkPx;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    // ---- size, colour, visibility ----
    const size = () => {
      dprNow = Math.min(2, window.devicePixelRatio || 1);
      kDev = Math.max(1, el.clientWidth * dprNow) / RW;
      remeasure();
      dirty = true;
    };
    const ro = new ResizeObserver(size);
    ro.observe(el);
    size();
    const recolour = () => {
      const col = getComputedStyle(el).color;
      if (col === colour) return;
      colour = col;
      inkPx = toPixel(col);
      dirty = true;
    };
    tint.current = recolour;
    // while the root's colour transition runs (a theme change above it), the colour is re-read on every step
    let fades = 0;
    const onFade = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "color") return;
      fades = e.type === "transitionrun" ? fades + 1 : Math.max(0, fades - 1);
      recolour();
    };
    for (const t of ["transitionrun", "transitionend", "transitioncancel"] as const) el.addEventListener(t, onFade);
    const mo = new MutationObserver(recolour);
    for (const n of [document.documentElement, document.body]) mo.observe(n, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", recolour);

    let raf = 0, t0 = 0, f0 = 0, shown = true, sig = "", fresh = true;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // the first frame after a (re)start re-reads the colour: the host may have set its theme just after the drop
      // mounted, or while it was off screen
      if (fresh) {
        fresh = false;
        recolour();
      }
      const want = f0 + Math.floor(((now - t0) * FPS) / 1000);
      let n = 0;
      while (f < want && n < 3) {
        step();
        n++;
      }
      if (f < want) f = want;
      if (n && (fades > 0 || f % 60 === 0)) recolour();
      if (!n && !dirty) return;
      // a still bot only redraws when something changed
      const now2 = still.matches ? `${yaw.toFixed(2)},${pitch.toFixed(2)},${Math.min(f - reactF, HAPPY_END)},${cellNow},${c.width},${colour}` : "";
      if (still.matches && now2 === sig && !dirty) return;
      sig = now2;
      draw();
      dirty = false;
    };
    const run = () => {
      if (raf || !shown || document.hidden) return;
      t0 = performance.now();
      f0 = f;
      fresh = true;
      raf = requestAnimationFrame(loop);
    };
    const halt = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const io = new IntersectionObserver((es) => {
      shown = es[es.length - 1].isIntersecting;
      if (shown) {
        remeasure();
        run();
      } else halt();
    });
    io.observe(el);
    const onVis = () => (document.hidden ? halt() : run());
    document.addEventListener("visibilitychange", onVis);
    const opt = { passive: true } as const;
    window.addEventListener("pointermove", onMove, opt);
    window.addEventListener("pointerdown", onMove, opt);
    document.addEventListener("pointerout", onOut, opt);
    window.addEventListener("scroll", remeasure, { passive: true, capture: true });
    window.addEventListener("resize", remeasure, opt);
    el.addEventListener("pointerdown", onDown, opt);
    step();
    draw();
    run();
    return () => {
      halt();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      dark.removeEventListener("change", recolour);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("scroll", remeasure, { capture: true });
      window.removeEventListener("resize", remeasure);
      el.removeEventListener("pointerdown", onDown);
      for (const t of ["transitionrun", "transitionend", "transitioncancel"] as const) el.removeEventListener(t, onFade);
      kick.current = null;
      tint.current = null;
    };
  }, []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    kick.current?.();
    opts.current.onPress?.();
  };

  return (
    <div
      ref={root}
      className={`${s.root} ${className ?? ""}`}
      style={ink ? ({ ...style, "--inkbot-ink": ink } as CSSProperties) : style}
      {...(label
        ? { role: "button", tabIndex: 0, "aria-label": label, onKeyDown: onKey }
        : { "aria-hidden": true })}
    >
      <canvas ref={cv} className={s.cells} />
    </div>
  );
}

export default InkBot;
