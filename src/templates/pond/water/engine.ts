// The live pond: the koi, the lily pads, the food and the rings on the water, drawn on a canvas laid over the still
// scene the server rendered. It starts from the still (every fish and pad where the page put it, in the same pose),
// draws its first frame, hides the still and carries on from there.
//
// The koi wander the open water, keep clear of the text laid over the pond (they sink under it when they must cross),
// come up under a pointer that rests on the water, and race for food. A pad can be dragged with a mouse or nudged
// with a tap; a pad pushed fast over a koi startles it. Colours are the page's custom properties, read through a
// probe and eased over the theme's fade. The loop runs only while the pond is on screen and the page is visible;
// with reduced motion everything moves at a third of the pace and the rings stay small.

import {
  HALF,
  LEN,
  SEGMENTS,
  WAVE,
  back,
  barbels,
  body,
  depthKeep,
  eyes,
  fins,
  frame,
  markings,
  newFrame,
  pad,
  paddle,
  patchEllipse,
  restSpine,
  ridge,
  shadowOffset,
  swimSpine,
  tail,
  tailSway,
  veins,
  type Frame,
  type Markings,
  type Variety,
} from "./koi";

type RGBA = [number, number, number, number];
const TOKENS = [
  "water",
  "koi-white",
  "koi-hi",
  "koi-sumi",
  "koi-gold",
  "koi-brown",
  "koi-asagi",
  "koi-eye",
  "koi-shadow",
  "koi-sheen",
  "koi-edge",
  "pad",
  "pad-vein",
  "pad-rim",
  "pad-shadow",
  "ripple",
  "food",
  "moon",
] as const;
type Token = (typeof TOKENS)[number];
type Palette = Record<Token, RGBA>;

type Fish = {
  look: Markings;
  /** px per koi unit */
  scale: number;
  spine: Float64Array;
  drawn: Float64Array;
  f: Frame;
  heading: number;
  turn: number;
  speed: number;
  phase: number;
  finPhase: number;
  depth: number;
  depthGoal: number;
  depthTimer: number;
  tx: number;
  ty: number;
  wanderTimer: number;
  pellet: Pellet | null;
  react: number;
  startled: number;
  lured: boolean;
  path: Path2D | null;
};
type Pad = {
  x: number;
  y: number;
  r: number;
  notch: number;
  vx: number;
  vy: number;
  spin: number;
  drag: { id: number; ox: number; oy: number; t: number } | null;
};
type Pellet = { x: number; y: number; vx: number; vy: number; age: number; land: number; gone: boolean };
type Ripple = { x: number; y: number; t: number; life: number; r0: number; r1: number; a: number };
type Rect = { x: number; y: number; w: number; h: number };

export type PondOptions = {
  /** elements laid over the pond whose boxes the koi keep clear of */
  avoid: () => Element[];
  /** called once, the first time food is dropped */
  onFeed?: () => void;
};

const TAU = Math.PI * 2;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const angDiff = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const THEME_SECONDS = 0.6;

function parseColor(text: string): RGBA {
  const m = text.match(/rgba?\(([^)]+)\)/);
  if (!m) return [0, 0, 0, 0];
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts.length > 3 ? parts[3] : 1];
}
const css = (c: RGBA, alpha = 1) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.round(c[3] * alpha * 1000) / 1000})`;
/** colours mixed with premultiplied alpha, so a colour fading to transparent keeps its hue instead of greying */
const lerp = (a: RGBA, b: RGBA, t: number): RGBA => {
  const alpha = a[3] + (b[3] - a[3]) * t;
  if (alpha <= 0) return [0, 0, 0, 0];
  const mix = (i: number) => (a[i] * a[3] * (1 - t) + b[i] * b[3] * t) / alpha;
  return [mix(0), mix(1), mix(2), alpha];
};

export class Pond {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private probe: HTMLElement;
  private opts: PondOptions;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private dprCap = 2;
  /** px per koi unit for a fish of size 1 */
  private unit = 1;
  private fish: Fish[] = [];
  private pads: Pad[] = [];
  private pellets: Pellet[] = [];
  private ripples: Ripple[] = [];
  private moon: { x: number; y: number; r: number } | null = null;
  private avoid: Rect[] = [];
  private avoidTimer = 0;
  private palette: Palette | null = null;
  private from: Palette | null = null;
  private to: Palette | null = null;
  private fade = 1;
  private tones = new Map<string, string>();
  private time = 0;
  private last = 0;
  private raf = 0;
  private visible = true;
  private inView = true;
  private started = false;
  private motion = 1;
  private fed = false;
  private pointer: { x: number; y: number; still: number; mouse: boolean } | null = null;
  private press: { id: number; x: number; y: number; t: number; touch: boolean } | null = null;
  private slow = 0;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private mo: MutationObserver;
  private motionQuery: MediaQueryList;
  private schemeQuery: MediaQueryList;

  constructor(root: HTMLElement, canvas: HTMLCanvasElement, probe: HTMLElement, opts: PondOptions) {
    this.root = root;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.probe = probe;
    this.opts = opts;
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.motion = this.motionQuery.matches ? 0.33 : 1;
    this.motionQuery.addEventListener("change", this.onMotion);
    this.schemeQuery.addEventListener("change", this.onScheme);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.visible = !document.hidden;
    // the day/night switch sets data-theme on the site element
    this.mo = new MutationObserver(this.onScheme);
    const site = root.closest("[data-pond-site]");
    if (site) this.mo.observe(site, { attributes: true, attributeFilter: ["data-theme"] });
    this.ro = new ResizeObserver(() => this.resize());
    this.io = new IntersectionObserver((entries) => {
      this.inView = entries[entries.length - 1].isIntersecting;
      this.kick();
    });
    this.palette = this.readColors();
    this.measure();
    this.adopt();
    this.started = true;
    this.render();
    this.root.dataset.live = "";
    this.ro.observe(root);
    this.io.observe(root);
    this.kick();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro.disconnect();
    this.io.disconnect();
    this.mo.disconnect();
    this.motionQuery.removeEventListener("change", this.onMotion);
    this.schemeQuery.removeEventListener("change", this.onScheme);
    document.removeEventListener("visibilitychange", this.onVisibility);
    delete this.root.dataset.live;
  }

  /* ---------- reading the page ---------- */

  private onMotion = () => {
    this.motion = this.motionQuery.matches ? 0.33 : 1;
  };
  private onVisibility = () => {
    this.visible = !document.hidden;
    this.kick();
  };
  private onScheme = () => {
    const next = this.readColors();
    this.from = this.current();
    this.to = next;
    this.fade = 0;
    this.kick();
  };

  private readColors(): Palette {
    const out = {} as Palette;
    for (const token of TOKENS) {
      this.probe.style.color = `var(--${token})`;
      out[token] = parseColor(getComputedStyle(this.probe).color);
    }
    return out;
  }

  private current(): Palette {
    return this.palette ?? this.readColors();
  }

  private measure() {
    const box = this.root.getBoundingClientRect();
    this.w = Math.round(box.width);
    this.h = Math.round(box.height);
    const unit = this.root.querySelector<HTMLElement>("[data-unit]");
    this.unit = unit ? unit.getBoundingClientRect().width / 180 : 1;
    // at most about 5.5 million canvas pixels (a 1440 × 900 pond at 2×), never fewer than one per CSS pixel
    const fit = Math.sqrt(5.5e6 / Math.max(1, this.w * this.h));
    this.dpr = Math.max(1, Math.min(this.dprCap, window.devicePixelRatio || 1, fit));
    this.canvas.width = Math.max(1, Math.round(this.w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.h * this.dpr));
    this.readAvoid();
  }

  private readAvoid() {
    const box = this.root.getBoundingClientRect();
    this.avoid = this.opts.avoid().flatMap((el) => {
      const r = el.getBoundingClientRect();
      return r.width && r.height ? [{ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }] : [];
    });
  }

  /** every fish and pad of the still, where CSS has laid them out for this size of pond */
  private adopt() {
    const box = this.root.getBoundingClientRect();
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, w: r.width };
    };
    const shown = (el: Element) => el.getClientRects().length > 0;
    for (const el of this.root.querySelectorAll<HTMLElement>("[data-koi]")) {
      if (!shown(el)) continue;
      const d = el.dataset;
      const { x, y, w } = centre(el);
      const scale = w / 180;
      const angle = (Number(d.angle) * Math.PI) / 180;
      const local = restSpine(Number(d.bend));
      const spine = new Float64Array(SEGMENTS * 2);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      for (let i = 0; i < SEGMENTS; i++) {
        const lx = local[i * 2] * scale, ly = local[i * 2 + 1] * scale;
        spine[i * 2] = x + lx * cos - ly * sin;
        spine[i * 2 + 1] = y + lx * sin + ly * cos;
      }
      const phase = Number(d.phase);
      const depth = Number(d.depth);
      const fish: Fish = {
        look: markings(Number(d.seed), d.variety as Variety),
        scale,
        spine,
        drawn: new Float64Array(SEGMENTS * 2),
        f: newFrame(),
        heading: angle,
        turn: 0,
        speed: this.cruise(scale),
        phase,
        finPhase: phase,
        depth,
        depthGoal: depth,
        depthTimer: rand(5, 12),
        tx: x,
        ty: y,
        wanderTimer: 0,
        pellet: null,
        react: 0,
        startled: 0,
        lured: false,
        path: null,
      };
      this.wander(fish, true);
      this.fish.push(fish);
    }
    this.fish.sort((a, b) => b.depth - a.depth);
    for (const el of this.root.querySelectorAll<HTMLElement>("[data-pad]")) {
      if (!shown(el)) continue;
      const { x, y, w } = centre(el);
      this.pads.push({ x, y, r: (w * 50) / 120, notch: (Number(el.dataset.notch) * Math.PI) / 180, vx: 0, vy: 0, spin: 0, drag: null });
    }
    const moon = this.root.querySelector<HTMLElement>("[data-moon]");
    if (moon && shown(moon)) {
      const { x, y, w } = centre(moon);
      this.moon = { x, y, r: w / 2 };
    }
  }

  private resize() {
    if (!this.started) return;
    const pw = this.w, ph = this.h, pu = this.unit;
    this.measure();
    if (!pw || !ph) return this.kick();
    const sx = this.w / pw, sy = this.h / ph, su = this.unit / pu;
    for (const f of this.fish) {
      const hx = f.spine[0], hy = f.spine[1];
      const nx = hx * sx, ny = hy * sy;
      for (let i = 0; i < SEGMENTS; i++) {
        f.spine[i * 2] = nx + (f.spine[i * 2] - hx) * su;
        f.spine[i * 2 + 1] = ny + (f.spine[i * 2 + 1] - hy) * su;
      }
      f.scale *= su;
      f.tx *= sx;
      f.ty *= sy;
    }
    for (const p of this.pads) {
      p.x *= sx;
      p.y *= sy;
      p.r *= su;
    }
    const moon = this.root.querySelector<HTMLElement>("[data-moon]");
    if (this.moon && moon) {
      const box = this.root.getBoundingClientRect(), r = moon.getBoundingClientRect();
      this.moon = { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, r: r.width / 2 };
    }
    this.pellets.length = 0;
    this.render();
    this.kick();
  }

  /* ---------- the visitor ---------- */

  private padAt(x: number, y: number) {
    for (let i = this.pads.length - 1; i >= 0; i--) {
      const p = this.pads[i];
      if (Math.hypot(x - p.x, y - p.y) < p.r) return p;
    }
    return null;
  }

  /** the cursor for a mouse at (x, y): a pad can be picked up */
  cursorAt(x: number, y: number) {
    return this.pads.some((p) => p.drag) ? "grabbing" : this.padAt(x, y) ? "grab" : "";
  }

  pointerDown(id: number, x: number, y: number, touch: boolean) {
    this.press = { id, x, y, t: performance.now(), touch };
    if (touch) return;
    const p = this.padAt(x, y);
    if (p) {
      p.drag = { id, ox: x - p.x, oy: y - p.y, t: performance.now() };
      p.vx = p.vy = 0;
      return true;
    }
    this.drop(x, y);
    return false;
  }

  pointerMove(id: number, x: number, y: number, mouse: boolean) {
    const prev = this.pointer;
    const moved = !prev || Math.hypot(prev.x - x, prev.y - y) > 6;
    this.pointer = { x, y, still: moved ? 0 : (prev?.still ?? 0), mouse };
    for (const p of this.pads) {
      if (p.drag?.id !== id) continue;
      const now = performance.now();
      const dt = Math.max(0.008, (now - p.drag.t) / 1000);
      const nx = x - p.drag.ox, ny = y - p.drag.oy;
      p.vx = p.vx * 0.5 + ((nx - p.x) / dt) * 0.5;
      p.vy = p.vy * 0.5 + ((ny - p.y) / dt) * 0.5;
      p.x = nx;
      p.y = ny;
      p.drag.t = now;
      this.kick();
    }
  }

  pointerUp(id: number, x: number, y: number) {
    for (const p of this.pads) if (p.drag?.id === id) p.drag = null;
    const press = this.press;
    this.press = null;
    if (!press || press.id !== id || !press.touch) return;
    // a tap, not the start of a scroll
    if (Math.hypot(x - press.x, y - press.y) > 10 || performance.now() - press.t > 600) return;
    const p = this.padAt(x, y);
    if (p) {
      const a = Math.atan2(p.y - y, p.x - x);
      const push = p.r * 2.2;
      p.vx += Math.cos(a) * push;
      p.vy += Math.sin(a) * push;
      p.spin += rand(-0.8, 0.8);
      this.ring(x, y, p.r * 1.1, 1.4, 0.5);
    } else this.drop(x, y);
    this.kick();
  }

  pointerCancel(id: number) {
    for (const p of this.pads) if (p.drag?.id === id) p.drag = null;
    if (this.press?.id === id) this.press = null;
  }

  pointerLeave() {
    this.pointer = null;
  }

  /** a handful of food where the visitor touched the water */
  drop(x: number, y: number) {
    const L = LEN * this.unit;
    this.ring(x, y, L * 0.85, 2.6, 0.75);
    const n = Math.round(rand(5, 8));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * L * 0.24;
      this.pellets.push({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        vx: rand(-3, 3),
        vy: rand(-3, 3),
        age: 0,
        land: 0.08 + i * 0.05,
        gone: false,
      });
    }
    if (this.pellets.length > 90) this.pellets.splice(0, this.pellets.length - 90);
    for (const f of this.fish) f.react = rand(0.15, 0.9);
    if (!this.fed) {
      this.fed = true;
      this.opts.onFeed?.();
    }
    this.kick();
  }

  /** for the keyboard: food on open water, away from the text */
  dropSomewhere() {
    const p = this.pointer;
    if (p && !this.inAvoid(p.x, p.y, 0)) return this.drop(p.x, p.y);
    for (let i = 0; i < 20; i++) {
      const x = rand(this.w * 0.2, this.w * 0.8), y = rand(this.h * 0.15, this.h * 0.75);
      if (!this.inAvoid(x, y, LEN * this.unit * 0.3) || i === 19) return this.drop(x, y);
    }
  }

  private ring(x: number, y: number, r1: number, life: number, a: number) {
    this.ripples.push({ x, y, t: 0, life, r0: r1 * 0.08, r1, a });
    if (this.ripples.length > 40) this.ripples.shift();
  }

  /* ---------- the loop ---------- */

  private kick() {
    const run = this.visible && this.inView && this.w > 0 && this.h > 0;
    if (run && !this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    } else if (!run && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private tick = (now: number) => {
    this.raf = 0;
    const gap = (now - this.last) / 1000;
    const dt = Math.min(0.05, Math.max(0, gap));
    this.last = now;
    const work = performance.now();
    this.update(dt);
    this.render();
    // a pond this screen cannot draw in time gives up some sharpness, a step at a time: judged by its own work and by
    // the frames actually shown, since the canvas is painted after this returns
    const late = performance.now() - work > 11 || gap > 1 / 38;
    this.slow = late ? this.slow + 1 : Math.max(0, this.slow - 0.5);
    if (this.slow > 45 && this.dprCap > 1) {
      this.dprCap = this.dprCap > 1.5 ? 1.5 : 1;
      this.slow = 0;
      this.measure();
    }
    this.kick();
  };

  private cruise(scale: number) {
    return LEN * scale * 0.27;
  }

  private inAvoid(x: number, y: number, pad: number) {
    for (const r of this.avoid) if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return r;
    return null;
  }

  /** a new place to swim to: open water, ahead rather than behind */
  private wander(f: Fish, first = false) {
    const L = LEN * f.scale;
    const m = L * 0.45;
    let best: [number, number] | null = null, bestScore = -Infinity;
    for (let i = 0; i < 10; i++) {
      const x = rand(m, Math.max(m + 1, this.w - m)), y = rand(m, Math.max(m + 1, this.h - m));
      const hx = f.spine[0], hy = f.spine[1];
      const ahead = Math.cos(angDiff(Math.atan2(y - hy, x - hx), f.heading));
      const dist = Math.hypot(x - hx, y - hy) / Math.max(this.w, this.h);
      // somewhere no other koi is heading, so the pond does not gather into one shoal
      const crowded = this.fish.some((o) => o !== f && Math.hypot(o.tx - x, o.ty - y) < Math.max(this.w, this.h) * 0.2);
      const score = ahead * 1.2 + Math.min(dist, 0.5) - (this.inAvoid(x, y, L * 0.4) ? 3 : 0) - (crowded ? 1.5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
    if (best) [f.tx, f.ty] = best;
    f.wanderTimer = first ? rand(2, 6) : rand(5, 11);
  }

  private update(dtReal: number) {
    const dt = dtReal * this.motion;
    this.time += dtReal;
    if (this.fade < 1 && this.from && this.to) {
      this.fade = Math.min(1, this.fade + dtReal / THEME_SECONDS);
      const t = this.fade < 0.5 ? 2 * this.fade * this.fade : 1 - Math.pow(-2 * this.fade + 2, 2) / 2;
      const p = {} as Palette;
      for (const k of TOKENS) p[k] = lerp(this.from[k], this.to[k], t);
      this.palette = p;
      this.tones.clear();
    }
    this.avoidTimer -= dtReal;
    if (this.avoidTimer <= 0) {
      this.readAvoid();
      this.avoidTimer = 1;
    }

    // the pointer resting on open water draws the nearest koi up to it
    let lure: { x: number; y: number } | null = null;
    if (this.pointer?.mouse) {
      this.pointer.still += dtReal;
      if (this.pointer.still > 0.7 && !this.inAvoid(this.pointer.x, this.pointer.y, 0)) lure = this.pointer;
    }
    const lured = new Set<Fish>();
    if (lure && this.motion === 1) {
      const near = [...this.fish].sort(
        (a, b) => Math.hypot(a.spine[0] - lure.x, a.spine[1] - lure.y) - Math.hypot(b.spine[0] - lure.x, b.spine[1] - lure.y),
      );
      for (const f of near.slice(0, 2)) lured.add(f);
    }

    // food floats, drifts and, after a while, sinks
    for (const p of this.pellets) {
      p.age += dt;
      if (p.age < p.land) continue;
      if (!p.gone && p.age - dt < p.land) this.ring(p.x, p.y, LEN * this.unit * 0.18, 1.1, 0.45);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 0.4 * dt;
      p.vy *= 1 - 0.4 * dt;
      if (p.age > 50) p.gone = true;
    }

    for (const f of this.fish) this.steer(f, dt, lured.has(f) ? lure : null);
    this.pellets = this.pellets.filter((p) => !p.gone);

    for (const r of this.ripples) r.t += dtReal * (this.motion === 1 ? 1 : 1.6);
    this.ripples = this.ripples.filter((r) => r.t < r.life);

    this.movePads(dt);
  }

  private steer(f: Fish, dt: number, lure: { x: number; y: number } | null) {
    const L = LEN * f.scale;
    const hx = f.spine[0], hy = f.spine[1];
    const cruise = this.cruise(f.scale);
    let want = cruise;
    let depthGoal = f.depthGoal, depthRate = 0.3;

    // food: the nearest pellet that has landed, once this fish has noticed; when the food it was after is gone and
    // there is no more, it swims off somewhere new rather than to where the food was
    if (f.pellet?.gone) {
      f.pellet = null;
      if (!this.pellets.some((p) => !p.gone)) this.wander(f);
    }
    if (this.pellets.length) {
      f.react -= dt;
      if (f.react <= 0 && !f.pellet) {
        let best: Pellet | null = null, bd = Infinity;
        for (const p of this.pellets) {
          if (p.gone || p.age < p.land) continue;
          const d = Math.hypot(p.x - hx, p.y - hy);
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        f.pellet = best;
      }
    }
    let near = Infinity;
    if (f.pellet) {
      f.tx = f.pellet.x;
      f.ty = f.pellet.y;
      near = Math.hypot(f.tx - hx, f.ty - hy);
      // a dash across the pond, slowing to a nose-up drift for the last length so it does not circle the food
      want = cruise * clamp(0.6 + near / (L * 0.4), 0.7, 2.9);
      depthGoal = 0;
      depthRate = 0.9;
      const [mx, my] = [hx + Math.cos(f.heading) * HALF * f.scale * 0.4, hy + Math.sin(f.heading) * HALF * f.scale * 0.4];
      if (Math.hypot(f.pellet.x - mx, f.pellet.y - my) < L * 0.15 && f.depth < 0.35) {
        f.pellet.gone = true;
        this.ring(f.pellet.x, f.pellet.y, L * 0.32, 1.2, 0.55);
        f.pellet = null;
        f.react = rand(0.05, 0.35);
        f.speed *= 0.6;
        if (!this.pellets.some((p) => !p.gone)) this.wander(f);
      }
    } else if (lure) {
      // hover below the pointer, a little to one side, mouth up
      const side = f.look.patches.length % 2 ? 1 : -1;
      f.tx = lure.x + Math.cos(f.heading + Math.PI / 2) * L * 0.25 * side;
      f.ty = lure.y + Math.sin(f.heading + Math.PI / 2) * L * 0.25 * side;
      const d = Math.hypot(f.tx - hx, f.ty - hy);
      want = cruise * clamp(d / (L * 1.2), 0.25, 1.2);
      depthGoal = 0.05;
      depthRate = 0.6;
      f.lured = true;
    } else {
      if (f.lured) {
        f.lured = false;
        this.wander(f);
      }
      f.wanderTimer -= dt;
      if (f.wanderTimer <= 0 || Math.hypot(f.tx - hx, f.ty - hy) < L * 0.6) this.wander(f);
      f.depthTimer -= dt;
      if (f.depthTimer <= 0) {
        f.depthGoal = Math.random() < 0.55 ? rand(0, 0.3) : rand(0.35, 0.8);
        f.depthTimer = rand(8, 16);
      }
    }

    let desired = Math.atan2(f.ty - hy, f.tx - hx);
    let urgency = 1;
    // keep to the pond: steer back in before the head leaves it
    const ax = hx + Math.cos(f.heading) * L * 0.9, ay = hy + Math.sin(f.heading) * L * 0.9;
    const m = L * 0.3;
    if (ax < m || ax > this.w - m || ay < m || ay > this.h - m) {
      const cx = clamp(ax, m, this.w - m), cy = clamp(ay, m, this.h - m);
      desired = Math.atan2(cy - hy + (cy - ay), cx - hx + (cx - ax));
      urgency = 2;
    }
    // keep clear of the text: turn away from its box, and pass deep beneath it when already there
    const over = this.inAvoid(hx, hy, L * 0.15);
    const ahead = this.inAvoid(ax, ay, L * 0.2);
    if (over || ahead) {
      const r = (over ?? ahead)!;
      if (!f.pellet && !lure) {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        const out = Math.atan2(hy - cy, (hx - cx) * (r.h / Math.max(1, r.w)));
        desired = out;
        urgency = Math.max(urgency, 1.6);
        if (this.inAvoid(f.tx, f.ty, L * 0.4)) this.wander(f);
      }
      if (over) {
        depthGoal = 1;
        depthRate = 0.9;
      }
    }
    // give each other room, unless one passes well below the other; at the food they may crowd in
    for (const o of this.fish) {
      if (o === f || Math.abs(o.depth - f.depth) > 0.5) continue;
      const ox = (o.spine[0] + o.spine[8]) / 2, oy = (o.spine[1] + o.spine[9]) / 2;
      const dx = hx - ox, dy = hy - oy;
      const d = Math.hypot(dx, dy);
      const room = LEN * (f.scale + o.scale) * 0.42;
      const k = f.pellet ? 0.25 : 0.9;
      if (d > 0 && d < room) {
        desired += angDiff(Math.atan2(dy, dx), desired) * k * (1 - d / room);
        if (!f.pellet && d < room * 0.6) f.wanderTimer = Math.min(f.wanderTimer, 0.5);
      }
    }
    // a pad shoved fast over a koi sends it down and away
    for (const p of this.pads) {
      const v = Math.hypot(p.vx, p.vy);
      if (v < 140 || Math.hypot(p.x - hx, p.y - hy) > p.r + L * 0.35) continue;
      if (f.startled <= 0) {
        f.startled = 1.4;
        f.heading += angDiff(Math.atan2(hy - p.y, hx - p.x), f.heading) * 0.5;
        this.ring(hx, hy, L * 0.4, 1, 0.5);
      }
    }
    if (f.startled > 0) {
      f.startled -= dt;
      want = cruise * 3.2;
      depthGoal = 0.8;
      depthRate = 1.2;
    }

    const diff = angDiff(desired, f.heading);
    const maxTurn = (f.startled > 0 ? 2.6 : f.pellet ? (near < L ? 3.6 : 2.4) : 1.1) * urgency;
    const turn = clamp(diff * 2, -maxTurn, maxTurn);
    f.turn += (turn - f.turn) * Math.min(1, dt * (f.pellet ? 7 : 4));
    f.heading += f.turn * dt;
    f.speed += (want - f.speed) * Math.min(1, dt * (want > f.speed ? 1.8 : 1));
    f.depth += (depthGoal - f.depth) * Math.min(1, dt * depthRate);

    // the head swims on; the body follows it, segment by segment
    const step = f.speed * dt;
    f.spine[0] += Math.cos(f.heading) * step;
    f.spine[1] += Math.sin(f.heading) * step;
    const seg = (LEN / (SEGMENTS - 1)) * f.scale;
    for (let i = 1; i < SEGMENTS; i++) {
      const px = f.spine[(i - 1) * 2], py = f.spine[(i - 1) * 2 + 1];
      let dx = f.spine[i * 2] - px, dy = f.spine[i * 2 + 1] - py;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      f.spine[i * 2] = px + dx * seg;
      f.spine[i * 2 + 1] = py + dy * seg;
    }
    const pace = f.speed / L;
    f.phase += dt * (2.4 + pace * 12);
    f.finPhase += dt * (1.3 + pace * 2);
  }

  private movePads(dt: number) {
    for (const p of this.pads) {
      if (p.drag) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = Math.exp(-dt * 1.6);
      p.vx *= k;
      p.vy *= k;
      p.notch += p.spin * dt;
      p.spin *= Math.exp(-dt * 1.2);
      // a pad stays at least half on the water
      const lo = -p.r * 0.5, hiX = this.w + p.r * 0.5, hiY = this.h + p.r * 0.5;
      if (p.x < lo || p.x > hiX) {
        p.vx = (p.x < lo ? 1 : -1) * Math.abs(p.vx) * 0.4;
        p.x = clamp(p.x, lo, hiX);
      }
      if (p.y < lo || p.y > hiY) {
        p.vy = (p.y < lo ? 1 : -1) * Math.abs(p.vy) * 0.4;
        p.y = clamp(p.y, lo, hiY);
      }
    }
    // a pad let go over the text drifts out from under it
    for (const p of this.pads) {
      if (p.drag) continue;
      for (const r of this.avoid) {
        const nx = clamp(p.x, r.x, r.x + r.w), ny = clamp(p.y, r.y, r.y + r.h);
        const dx = p.x - nx, dy = p.y - ny, d = Math.hypot(dx, dy);
        const reach = p.r + 12;
        if (d >= reach) continue;
        // inside the box: out through the nearer side
        const [ux, uy] =
          d > 0.5
            ? [dx / d, dy / d]
            : Math.min(p.x - r.x, r.x + r.w - p.x) < Math.min(p.y - r.y, r.y + r.h - p.y)
              ? [p.x - r.x < r.x + r.w - p.x ? -1 : 1, 0]
              : [0, p.y - r.y < r.y + r.h - p.y ? -1 : 1];
        const push = (reach - d) * 2.4;
        p.vx += ux * push * dt;
        p.vy += uy * push * dt;
      }
    }
    // pads that meet push apart a little
    for (let i = 0; i < this.pads.length; i++) {
      for (let j = i + 1; j < this.pads.length; j++) {
        const a = this.pads[i], b = this.pads[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const overlap = (a.r + b.r) * 0.92 - d;
        if (overlap <= 0) continue;
        const nx = dx / d, ny = dy / d;
        const share = a.drag ? 0 : b.drag ? 1 : 0.5;
        a.x -= nx * overlap * share;
        a.y -= ny * overlap * share;
        b.x += nx * overlap * (1 - share);
        b.y += ny * overlap * (1 - share);
      }
    }
  }

  /* ---------- drawing ---------- */

  private tone(token: Token, keep: number, alpha = 1) {
    const q = Math.round(keep * 40) / 40;
    const key = `${token}|${q}|${alpha}`;
    let v = this.tones.get(key);
    if (!v) {
      const p = this.palette!;
      v = css(q >= 0.999 ? p[token] : lerp(p.water, p[token], q), alpha);
      this.tones.set(key, v);
    }
    return v;
  }

  private render() {
    const ctx = this.ctx, p = this.palette!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // pose every fish for this frame, the deepest first so the ones nearer the surface pass over them
    this.fish.sort((a, b) => b.depth - a.depth);
    for (const f of this.fish) {
      const amp = WAVE * clamp(0.75 + (0.25 * f.speed) / this.cruise(f.scale), 0.6, 1.5) * (1 + Math.min(0.6, Math.abs(f.turn) * 0.4));
      swimSpine(f.spine, f.phase, amp, f.scale, f.drawn);
      frame(f.drawn, f.scale, f.f);
      const path = new Path2D();
      body(f.f, path);
      f.path = path;
    }

    // shadows on the floor of the pond
    ctx.fillStyle = css(p["koi-shadow"]);
    for (const f of this.fish) {
      const [ox, oy] = shadowOffset(f.depth);
      ctx.save();
      ctx.translate(ox * this.unit, oy * this.unit);
      ctx.fill(f.path!);
      ctx.beginPath();
      tail(f.f, this.sway(f), ctx);
      ctx.fill();
      ctx.restore();
    }

    for (const f of this.fish) this.drawFish(f);

    if (this.moon && p.moon[3] > 0.01) this.drawMoon();

    // food on the surface
    const pr = 2.4 * this.unit;
    for (const pel of this.pellets) {
      if (pel.age < pel.land) continue;
      const sink = pel.age > 44 ? 1 - (pel.age - 44) / 6 : 1;
      ctx.fillStyle = css(p.food, sink);
      ctx.beginPath();
      ctx.arc(pel.x, pel.y, pr, 0, TAU);
      ctx.fill();
    }

    // rings on the water
    for (const r of this.ripples) {
      const k = r.t / r.life;
      const grow = this.motion === 1 ? easeOut(k) : easeOut(k) * 0.4;
      const radius = r.r0 + (r.r1 - r.r0) * grow;
      const a = r.a * Math.pow(1 - k, 1.6);
      ctx.strokeStyle = css(p.ripple, a);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, TAU);
      ctx.stroke();
      if (radius > 8) {
        ctx.strokeStyle = css(p.ripple, a * 0.55);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius * 0.7, 0, TAU);
        ctx.stroke();
      }
    }

    for (const pd of this.pads) this.drawPad(pd);
  }

  private sway(f: Fish) {
    const amp = WAVE * clamp(0.75 + (0.25 * f.speed) / this.cruise(f.scale), 0.6, 1.5);
    return tailSway(f.phase, amp) - f.turn * 0.12;
  }

  private drawFish(f: Fish) {
    const ctx = this.ctx, look = f.look, keep = depthKeep(f.depth);
    const fast = clamp((f.speed / this.cruise(f.scale) - 1) / 1.6, 0, 1);
    ctx.fillStyle = this.tone(`koi-${look.fin}`, keep, 0.5);
    ctx.beginPath();
    fins(f.f, paddle(f.finPhase) * (1 - fast * 0.75), ctx);
    ctx.fill();
    ctx.beginPath();
    tail(f.f, this.sway(f), ctx);
    ctx.fill();

    const path = f.path!;
    ctx.fillStyle = this.tone(`koi-${look.base}`, keep);
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    for (const patch of look.patches) {
      const [cx, cy, rx, ry, rot] = patchEllipse(f.f, patch);
      ctx.fillStyle = this.tone(`koi-${patch.tone}`, keep);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = this.tone("koi-sheen", 1, look.sheen * keep);
    ctx.lineWidth = HALF * 0.9 * f.scale;
    ctx.beginPath();
    back(f.f, ctx);
    ctx.stroke();
    ctx.strokeStyle = this.tone("koi-edge", 1, 0.2 * keep);
    ctx.lineWidth = HALF * 0.34 * f.scale;
    ctx.stroke(path);
    ctx.restore();

    ctx.strokeStyle = this.tone("koi-edge", 1, 0.22 * keep);
    ctx.lineWidth = 2.2 * f.scale;
    ctx.beginPath();
    ridge(f.f, ctx);
    ctx.stroke();
    ctx.strokeStyle = this.tone(`koi-${look.base}`, keep);
    ctx.lineWidth = 0.9 * f.scale;
    ctx.beginPath();
    barbels(f.f, ctx);
    ctx.stroke();
    ctx.fillStyle = this.tone("koi-eye", keep);
    for (const [x, y, r] of eyes(f.f)) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }

  private drawMoon() {
    const ctx = this.ctx, m = this.moon!, c = this.palette!.moon;
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    g.addColorStop(0, css(c));
    g.addColorStop(0.6, css(c));
    g.addColorStop(0.68, css(c, 0.16));
    g.addColorStop(1, css(c, 0));
    ctx.fillStyle = g;
    // the reflection trembles a little, wider and narrower in turn
    const ramp = Math.min(1, this.time / 2) * (this.motion === 1 ? 1 : 0.3);
    const k = Math.sin(this.time * 1.1) * 0.035 * ramp;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(1 + k, 1 - k * 0.6);
    ctx.translate(-m.x, -m.y);
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawPad(pd: Pad) {
    const ctx = this.ctx, p = this.palette!;
    const k = pd.r / 50;
    ctx.save();
    ctx.translate(pd.x, pd.y);
    const [ox, oy] = shadowOffset(0);
    ctx.fillStyle = css(p["pad-shadow"]);
    ctx.save();
    ctx.translate(ox * this.unit, oy * this.unit);
    ctx.beginPath();
    pad(pd.r, pd.notch, ctx);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = css(p.pad);
    ctx.beginPath();
    pad(pd.r, pd.notch, ctx);
    ctx.fill();
    ctx.strokeStyle = css(p["pad-vein"]);
    ctx.lineWidth = 0.9 * k;
    ctx.beginPath();
    veins(pd.r, pd.notch, ctx);
    ctx.stroke();
    ctx.strokeStyle = css(p["pad-rim"]);
    ctx.lineWidth = 2 * k;
    const r = pd.r - 1.5 * k;
    ctx.beginPath();
    ctx.arc(0, 0, r, (196 * Math.PI) / 180, (290 * Math.PI) / 180);
    ctx.stroke();
    ctx.restore();
  }
}
