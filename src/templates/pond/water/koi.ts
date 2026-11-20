// One koi, seen from above. Shared by the still scene the server renders (SVG) and the live pond (canvas), so a fish
// looks the same in both and the page can hand one over to the other without a visible change.
//
// A koi lives in its own units: the body is LEN long from the tip of the snout to the root of the tail and faces +x.
// Its shape follows a spine of SEGMENTS points; geometry is written to a PathSink, which a canvas context, a Path2D
// and the SVG builder below all are. Its colours are tokens (white, hi, sumi, …) that the page maps to CSS custom
// properties, so the same fish turns with the day/night switch.

export const LEN = 100;
export const SEGMENTS = 10;
export const SEG = LEN / (SEGMENTS - 1);
/** half the widest part of the body */
export const HALF = 0.13 * LEN;
/** the box a koi is drawn in: x, y, width, height (the head sits at +50, the tail fin reaches about -84) */
export const VIEW = [-90, -60, 180, 120] as const;
/** the still's head point, in koi units */
export const HEAD_X = 50;

export type Tone = "white" | "hi" | "sumi" | "gold" | "brown" | "asagi";
export type Patch = { u: number; v: number; ru: number; rv: number; tone: Tone };
export type Variety = "kohaku" | "sanke" | "showa" | "tancho" | "yamabuki" | "platinum" | "chagoi" | "asagi";
export type Markings = {
  variety: Variety;
  base: Tone;
  fin: Tone;
  patches: Patch[];
  /** strength of the light along the back: metallic koi shine */
  sheen: number;
};

export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): void;
  quadraticCurveTo(a: number, b: number, x: number, y: number): void;
  closePath(): void;
}

/** Builds an SVG path string with the canvas path calls. */
export class SvgPath implements PathSink {
  private parts: string[] = [];
  private n = (v: number) => String(Math.round(v * 100) / 100);
  moveTo(x: number, y: number) {
    this.parts.push(`M${this.n(x)} ${this.n(y)}`);
  }
  lineTo(x: number, y: number) {
    this.parts.push(`L${this.n(x)} ${this.n(y)}`);
  }
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number) {
    this.parts.push(`C${this.n(a)} ${this.n(b)} ${this.n(c)} ${this.n(d)} ${this.n(x)} ${this.n(y)}`);
  }
  quadraticCurveTo(a: number, b: number, x: number, y: number) {
    this.parts.push(`Q${this.n(a)} ${this.n(b)} ${this.n(x)} ${this.n(y)}`);
  }
  closePath() {
    this.parts.push("Z");
  }
  toString() {
    return this.parts.join("");
  }
}

/* ---------- seeds ---------- */

/** A stable number for any string (a project id, a scene slot). */
export function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator, so a seed always grows the same fish */
export function random(seed: number) {
  let a = seed >>> 0;
  return (lo = 0, hi = 1) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return lo + r * (hi - lo);
  };
}

/* ---------- markings ---------- */

/** The red back of a kohaku: two to four patches, each a cluster of ellipses so its edge is not a perfect curve. */
function hiBack(rnd: ReturnType<typeof random>, patches: Patch[], tone: Tone, from: number, to: number) {
  let u = from;
  while (u < to) {
    const ru = rnd(0.06, 0.11);
    const v = rnd(-0.32, 0.32);
    patches.push({ u, v, ru, rv: rnd(0.55, 0.95), tone });
    const lobes = Math.round(rnd(2, 4));
    for (let i = 0; i < lobes; i++)
      patches.push({ u: u + rnd(-ru, ru) * 0.9, v: v + rnd(-0.55, 0.55), ru: ru * rnd(0.4, 0.75), rv: rnd(0.3, 0.65), tone });
    u += ru + rnd(0.08, 0.17);
  }
}

/** The order varieties are given out in, so a pond is never all one kind: the n-th koi of a scene, and the n-th
 *  project, is ORDER[n % 8]; its seed only decides the markings. */
export const ORDER: Variety[] = ["kohaku", "yamabuki", "sanke", "asagi", "showa", "tancho", "chagoi", "platinum"];

export function markings(seed: number, variety: Variety = ORDER[seed % ORDER.length]): Markings {
  const rnd = random(seed);
  const patches: Patch[] = [];
  switch (variety) {
    case "kohaku":
      hiBack(rnd, patches, "hi", rnd(0.02, 0.14), 0.86);
      return { variety, base: "white", fin: "white", patches, sheen: 0.16 };
    case "sanke": {
      hiBack(rnd, patches, "hi", rnd(0.05, 0.16), 0.8);
      const spots = Math.round(rnd(3, 6));
      for (let i = 0; i < spots; i++)
        patches.push({ u: rnd(0.3, 0.85), v: rnd(-0.75, 0.75), ru: rnd(0.02, 0.05), rv: rnd(0.16, 0.36), tone: "sumi" });
      return { variety, base: "white", fin: "white", patches, sheen: 0.16 };
    }
    case "showa": {
      // a broad white ground broken by black, red over the head and back
      for (let u = 0.12; u < 0.9; u += rnd(0.1, 0.16))
        patches.push({ u, v: rnd(-0.7, 0.7), ru: rnd(0.07, 0.12), rv: rnd(0.45, 0.75), tone: "white" });
      hiBack(rnd, patches, "hi", rnd(0.02, 0.08), 0.62);
      for (let i = 0; i < 3; i++)
        patches.push({ u: rnd(0.25, 0.8), v: rnd(-0.6, 0.6), ru: rnd(0.04, 0.08), rv: rnd(0.3, 0.6), tone: "sumi" });
      return { variety, base: "sumi", fin: "sumi", patches, sheen: 0.12 };
    }
    case "tancho":
      patches.push({ u: 0.09, v: rnd(-0.08, 0.08), ru: 0.052, rv: 0.52, tone: "hi" });
      return { variety, base: "white", fin: "white", patches, sheen: 0.2 };
    case "yamabuki":
      return { variety, base: "gold", fin: "gold", patches, sheen: 0.34 };
    case "platinum":
      return { variety, base: "white", fin: "white", patches, sheen: 0.38 };
    case "chagoi":
      return { variety, base: "brown", fin: "brown", patches, sheen: 0.14 };
    case "asagi": {
      patches.push({ u: 0.06, v: 0, ru: 0.1, rv: 1.4, tone: "white" });
      for (const side of [-1, 1]) {
        let u = rnd(0.22, 0.3);
        while (u < 0.9) {
          patches.push({ u, v: side * rnd(0.85, 1.05), ru: rnd(0.07, 0.11), rv: rnd(0.35, 0.55), tone: "hi" });
          u += rnd(0.1, 0.16);
        }
      }
      return { variety, base: "asagi", fin: "asagi", patches, sheen: 0.12 };
    }
  }
}

/* ---------- shape ---------- */

/** body half-width along the spine, u = 0 snout … 1 root of the tail: a round head, broad shoulders, a long taper */
export function profile(u: number) {
  if (u < 0.25) return 0.62 + 0.38 * Math.sin((u / 0.25) * (Math.PI / 2));
  if (u < 0.42) return 1;
  const t = (u - 0.42) / 0.58;
  return 0.16 + 0.84 * (1 - Math.pow(t, 1.7));
}

/** The spine of a koi at rest, its head at (HEAD_X, 0) facing +x, bent by `bend` radians per segment. */
export function restSpine(bend: number, out = new Float64Array(SEGMENTS * 2)) {
  let x = HEAD_X, y = 0, a = 0;
  for (let i = 0; i < SEGMENTS; i++) {
    out[i * 2] = x;
    out[i * 2 + 1] = y;
    x -= Math.cos(a) * SEG;
    y -= Math.sin(a) * SEG;
    a += bend;
  }
  return out;
}

/** The spine as drawn: the swimming wave added to the spine the fish steers by. The head barely moves; the wave
 *  grows toward the tail. `amp` is in units of the body's half-width. */
export function swimSpine(spine: ArrayLike<number>, phase: number, amp: number, scale: number, out: Float64Array) {
  const n = SEGMENTS;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let tx = spine[a * 2] - spine[b * 2], ty = spine[a * 2 + 1] - spine[b * 2 + 1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const k = Math.pow(i / (n - 1), 1.4);
    const off = Math.sin(phase - i * 0.72) * amp * HALF * scale * k;
    out[i * 2] = spine[i * 2] - ty * off;
    out[i * 2 + 1] = spine[i * 2 + 1] + tx * off;
  }
  return out;
}

/** Everything about a drawn fish that its parts need: points along the body, unit tangents (toward the head), normals
 *  and half-widths. Filled from a drawn spine by `frame`. */
export type Frame = { p: Float64Array; t: Float64Array; h: Float64Array; scale: number };

export function newFrame(): Frame {
  return { p: new Float64Array(SEGMENTS * 2), t: new Float64Array(SEGMENTS * 2), h: new Float64Array(SEGMENTS), scale: 1 };
}

export function frame(spine: ArrayLike<number>, scale: number, out: Frame) {
  const n = SEGMENTS;
  out.scale = scale;
  for (let i = 0; i < n; i++) {
    out.p[i * 2] = spine[i * 2];
    out.p[i * 2 + 1] = spine[i * 2 + 1];
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let tx = spine[a * 2] - spine[b * 2], ty = spine[a * 2 + 1] - spine[b * 2 + 1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    out.t[i * 2] = tx;
    out.t[i * 2 + 1] = ty;
    out.h[i] = HALF * scale * profile(i / (n - 1));
  }
  return out;
}

/** a point on the body: u along it (0 snout … 1 tail root), v across it (-1 … 1 of the half-width) */
export function at(f: Frame, u: number, v: number): [number, number, number] {
  const n = SEGMENTS - 1;
  const x = Math.min(n - 1e-6, Math.max(0, u * n));
  const i = Math.floor(x), k = x - i;
  const px = f.p[i * 2] + (f.p[i * 2 + 2] - f.p[i * 2]) * k;
  const py = f.p[i * 2 + 1] + (f.p[i * 2 + 3] - f.p[i * 2 + 1]) * k;
  const tx = f.t[i * 2] + (f.t[i * 2 + 2] - f.t[i * 2]) * k;
  const ty = f.t[i * 2 + 1] + (f.t[i * 2 + 3] - f.t[i * 2 + 1]) * k;
  const hw = HALF * f.scale * profile(u);
  // the normal (-ty, tx) points to the fish's left
  return [px - ty * v * hw, py + tx * v * hw, Math.atan2(ty, tx)];
}

/** closed Catmull-Rom curve through the points, as cubic Béziers */
function smoothClosed(xs: number[], ys: number[], sink: PathSink) {
  const n = xs.length;
  sink.moveTo(xs[0], ys[0]);
  for (let i = 0; i < n; i++) {
    const i0 = (i - 1 + n) % n, i2 = (i + 1) % n, i3 = (i + 2) % n;
    sink.bezierCurveTo(
      xs[i] + (xs[i2] - xs[i0]) / 6,
      ys[i] + (ys[i2] - ys[i0]) / 6,
      xs[i2] - (xs[i3] - xs[i]) / 6,
      ys[i2] - (ys[i3] - ys[i]) / 6,
      xs[i2],
      ys[i2],
    );
  }
  sink.closePath();
}

const bx: number[] = [];
const by: number[] = [];

/** the body outline: snout, the left flank to the tail root, back up the right flank */
export function body(f: Frame, sink: PathSink) {
  const n = SEGMENTS;
  bx.length = by.length = 0;
  const nose = HALF * f.scale * 0.5;
  bx.push(f.p[0] + f.t[0] * nose);
  by.push(f.p[1] + f.t[1] * nose);
  for (let i = 0; i < n; i++) {
    bx.push(f.p[i * 2] - f.t[i * 2 + 1] * f.h[i]);
    by.push(f.p[i * 2 + 1] + f.t[i * 2] * f.h[i]);
  }
  for (let i = n - 1; i >= 0; i--) {
    bx.push(f.p[i * 2] + f.t[i * 2 + 1] * f.h[i]);
    by.push(f.p[i * 2 + 1] - f.t[i * 2] * f.h[i]);
  }
  smoothClosed(bx, by, sink);
}

/** A paddle-shaped fin on one side (-1 right, 1 left) at u, swept back by `sweep` radians from straight out. */
function fin(f: Frame, u: number, side: number, length: number, width: number, sweep: number, sink: PathSink) {
  const [ax, ay, ang] = at(f, u, side * 0.8);
  // straight back is ang + π; straight out to the left is ang + π/2
  const dir = ang + side * (Math.PI / 2 + sweep);
  const dx = Math.cos(dir), dy = Math.sin(dir);
  const px = -dy, py = dx;
  const L = length * f.scale, W = width * f.scale;
  const tx = ax + dx * L, ty = ay + dy * L;
  const r1x = ax + Math.cos(ang) * W * 0.22, r1y = ay + Math.sin(ang) * W * 0.22;
  const r2x = ax - Math.cos(ang) * W * 0.22, r2y = ay - Math.sin(ang) * W * 0.22;
  const s = side;
  // a fan: narrow at the root, its rounded edge widest near the tip, the trailing edge a little concave
  sink.moveTo(r1x, r1y);
  sink.bezierCurveTo(
    ax + dx * L * 0.45 + px * W * 0.5 * s,
    ay + dy * L * 0.45 + py * W * 0.5 * s,
    tx + px * W * 0.62 * s,
    ty + py * W * 0.62 * s,
    tx + px * W * 0.1 * s,
    ty + py * W * 0.1 * s,
  );
  sink.bezierCurveTo(
    tx - px * W * 0.42 * s + dx * L * 0.02,
    ty - py * W * 0.42 * s + dy * L * 0.02,
    ax + dx * L * 0.62 - px * W * 0.5 * s,
    ay + dy * L * 0.62 - py * W * 0.5 * s,
    r2x,
    r2y,
  );
  sink.closePath();
}

/** pectoral fins (the large pair behind the head) and the small pelvic pair; `paddle` 0 … 1 opens them */
export function fins(f: Frame, paddle: number, sink: PathSink) {
  const sweep = 1.05 - paddle * 0.5;
  fin(f, 0.22, 1, 30, 21, sweep, sink);
  fin(f, 0.22, -1, 30, 21, sweep + (paddle - 0.5) * 0.12, sink);
  fin(f, 0.6, 1, 13, 9, 1.05, sink);
  fin(f, 0.6, -1, 13, 9, 1.05, sink);
}

/** the fan tail: two lobes and a soft notch, swinging by `sway` radians after the body */
export function tail(f: Frame, sway: number, sink: PathSink) {
  const n = SEGMENTS - 1;
  const x = f.p[n * 2], y = f.p[n * 2 + 1];
  const base = Math.atan2(-f.t[n * 2 + 1], -f.t[n * 2]) + sway;
  const dx = Math.cos(base), dy = Math.sin(base);
  const px = -dy, py = dx;
  const T = 34 * f.scale, S = 19 * f.scale, R = HALF * 0.16 * f.scale;
  // the tips trail a little further than the middle as the tail swings
  const lag = sway * 0.35;
  const tlx = x + Math.cos(base + lag) * T + px * S, tly = y + Math.sin(base + lag) * T + py * S;
  const trx = x + Math.cos(base + lag) * T - px * S, try_ = y + Math.sin(base + lag) * T - py * S;
  const nx = x + dx * T * 0.66, ny = y + dy * T * 0.66;
  sink.moveTo(x + px * R, y + py * R);
  sink.bezierCurveTo(x + dx * T * 0.3 + px * S * 0.35, y + dy * T * 0.3 + py * S * 0.35, tlx - dx * T * 0.25, tly - dy * T * 0.25, tlx, tly);
  sink.quadraticCurveTo(x + dx * T * 0.86 + px * S * 0.25, y + dy * T * 0.86 + py * S * 0.25, nx, ny);
  sink.quadraticCurveTo(x + dx * T * 0.86 - px * S * 0.25, y + dy * T * 0.86 - py * S * 0.25, trx, try_);
  sink.bezierCurveTo(trx - dx * T * 0.25, try_ - dy * T * 0.25, x + dx * T * 0.3 - px * S * 0.35, y + dy * T * 0.3 - py * S * 0.35, x - px * R, y - py * R);
  sink.closePath();
}

/** the dorsal fin, seen from above as a thin ridge along the back */
export function ridge(f: Frame, sink: PathSink) {
  const [x0, y0] = at(f, 0.3, 0);
  const [x1, y1] = at(f, 0.48, 0);
  const [x2, y2] = at(f, 0.68, 0);
  sink.moveTo(x0, y0);
  sink.quadraticCurveTo(x1, y1, x2, y2);
}

/** the light along the back, from behind the head to past the middle */
export function back(f: Frame, sink: PathSink) {
  const [x0, y0] = at(f, 0.06, 0);
  const [x1, y1] = at(f, 0.35, 0);
  const [x2, y2] = at(f, 0.72, 0);
  sink.moveTo(x0, y0);
  sink.quadraticCurveTo(x1, y1, x2, y2);
}

/** the two barbels at the corners of the mouth */
export function barbels(f: Frame, sink: PathSink) {
  for (const side of [-1, 1]) {
    const [x, y, a] = at(f, 0.02, side * 0.45);
    const out = a + side * 0.9;
    const L = 6 * f.scale;
    sink.moveTo(x, y);
    sink.quadraticCurveTo(x + Math.cos(a) * L * 0.6, y + Math.sin(a) * L * 0.6, x + Math.cos(out) * L, y + Math.sin(out) * L);
  }
}

/** eyes: [x, y, radius] for each side */
export function eyes(f: Frame): [number, number, number][] {
  return [-1, 1].map((side) => {
    const [x, y] = at(f, 0.075, side * 0.74);
    return [x, y, 1.9 * f.scale];
  });
}

/** a patch as an ellipse on the body: centre, radii and rotation */
export function patchEllipse(f: Frame, patch: Patch): [number, number, number, number, number] {
  const [x, y, a] = at(f, patch.u, patch.v);
  return [x, y, patch.ru * LEN * f.scale, patch.rv * HALF * f.scale * profile(Math.min(1, patch.u)), a];
}

/** Where the shadow of a fish at this depth falls on the floor of the pond, in koi units: further from a fish near the
 *  surface. The light comes from the upper left. */
export function shadowOffset(depth: number): [number, number] {
  const d = 6 + 9 * (1 - depth);
  return [d * 0.55, d * 0.83];
}

/** the size of the swimming wave while cruising, in half-widths of the body */
export const WAVE = 0.55;

/** how far the tail swings after the body at this point of the stroke */
export const tailSway = (phase: number, amp: number) => Math.sin(phase - SEGMENTS * 0.72 + 0.3) * 0.5 * (amp / WAVE);

/** how far open the pectoral fins are (0 … 1) */
export const paddle = (finPhase: number) => 0.5 + 0.5 * Math.sin(finPhase);

/** how much of its colour a fish keeps at this depth; the rest is the water's */
export const depthKeep = (depth: number) => 1 - 0.66 * depth;

/* ---------- lily pads ---------- */

/** a lily pad of radius r at the origin, its notch facing `notch` radians */
export function pad(r: number, notch: number, sink: PathSink) {
  const gap = 0.2;
  const steps = 4;
  const from = notch + gap, to = notch + Math.PI * 2 - gap;
  const step = (to - from) / steps;
  sink.moveTo(Math.cos(notch) * r * 0.08, Math.sin(notch) * r * 0.08);
  sink.lineTo(Math.cos(from) * r, Math.sin(from) * r);
  for (let i = 0; i < steps; i++) {
    const a0 = from + step * i, a1 = a0 + step;
    const h = (4 / 3) * Math.tan(step / 4) * r;
    sink.bezierCurveTo(
      Math.cos(a0) * r - Math.sin(a0) * h,
      Math.sin(a0) * r + Math.cos(a0) * h,
      Math.cos(a1) * r + Math.sin(a1) * h,
      Math.sin(a1) * r - Math.cos(a1) * h,
      Math.cos(a1) * r,
      Math.sin(a1) * r,
    );
  }
  sink.closePath();
}

/** the veins of a pad, from its centre to near the rim */
export function veins(r: number, notch: number, sink: PathSink) {
  const count = 12;
  for (let i = 1; i < count; i++) {
    const a = notch + (i / count) * Math.PI * 2;
    sink.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12);
    sink.quadraticCurveTo(Math.cos(a - 0.05) * r * 0.45, Math.sin(a - 0.05) * r * 0.45, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
  }
}
