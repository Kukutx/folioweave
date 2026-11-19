// Koi pond simulation drawn on a character grid. Framework free: <KoiPond /> owns one Pond per canvas.
//
// Each frame works out what every cell holds; only the cells whose contents changed since the last frame are repainted
// (about one in ten), from a small cached image per kind of cell.
//
// Every frame the pond is rasterised cell by cell (cells are taller than wide, like a monospace character):
//   shadows  ":"  cast by surface koi, down and to the right
//   deep koi       larger, dim, no glyphs (depth is carried along the body, so a koi surfaces head first)
//   ripples        octagonal rings of / - \ | strokes with a ring of dots inside: from every pellet that lands,
//                  every gulp, and every flick of a tail when a koi turns at the surface
//   surface koi    filled cells with scale glyphs, black eye cells, grey rim, fins and a fan tail, barbels
//   food           "o" pellets, "*" where one was just eaten
import { koiPondContent, type KoiPalette } from "./content";

type RGB = [number, number, number];
const PAL_KEYS = [
  "white", "orange", "red", "navy", "eye", "eyeGlyph", "rim", "fin", "finGlyph", "line", "whisker", "shadow", "food",
] as const;
type PalKey = (typeof PAL_KEYS)[number];
const COLOR_KEYS = ["paper", "ink", ...PAL_KEYS] as const;
type Colors = Record<(typeof COLOR_KEYS)[number], RGB>;

export type PondStats = { fish: number; food: number };
export type PondRect = { x: number; y: number; w: number; h: number };
export type PondOptions = {
  /** a character cell in CSS px: one number for square cells, or [width, height] */
  cell: number | [number, number];
  fishCount: number;
  glyphs: string;
  pellets: [number, number];
  palette?: Partial<KoiPalette>;
  onStats?: (s: PondStats) => void;
  /** areas (CSS px, relative to the pond) the koi steer around, e.g. a block of text */
  getAvoid?: () => PondRect[];
  /** areas the pond is drawn only faintly under, e.g. the line boxes of text laid over it */
  getDim?: () => PondRect[];
};

/* ---------- glyph table ---------- */
const SPECIALS = [" ", ".", "o", ":", "-", "|", "/", "\\", "*"];
const G_NONE = 0, G_DOT = 1, G_O = 2, G_COLON = 3, G_DASH = 4, G_PIPE = 5, G_SLASH = 6, G_BSLASH = 7, G_STAR = 8;

/* ---------- cell fills and bare glyph tones ---------- */
const S_WHITE = 0, S_ORANGE = 1, S_RED = 2, S_NAVY = 3, S_EYE = 4, S_RIM = 5, S_FIN = 6;
const SLOT_KEY: PalKey[] = ["white", "orange", "red", "navy", "eye", "rim", "fin"];
const T_LINE = 0, T_WHISKER = 1, T_SHADOW = 2, T_FOOD = 3;
const TONE_KEY: PalKey[] = ["line", "whisker", "shadow", "food"];
const JITTER = [0.92, 1, 1.07];
const TEXT_KEY = 100_000;

const ALPHA_STEPS = 64;
const SEG = 16; // physics spine points
const CHUNK = 5; // render spine segments per bounding box when finding a cell's nearest point
const RN = SEG * 2 - 1; // render spine points (the physics spine, smoothed and subdivided)
const TAU = Math.PI * 2;
const THEME_SECONDS = 0.3; // matches the page's background-color transition

type Spot = { u: number; v: number; ru: number; rv: number; c: number };
type Pellet = { x: number; y: number; land: number; landed: boolean; age: number; dead: boolean };
type Ripple = { x: number; y: number; t: number; dur: number; r0: number; R: number; tau: number; k: number; seed: number };
type Splash = { x: number; y: number; t: number; seed: number };
type Flash = { col: number; row: number; t: number };
type Fish = {
  seed: number;
  x: number; y: number; a: number; av: number; sp: number; goal: number;
  cruise: number; chase: number; len: number; hw: number; seg: number; tail: number;
  spine: Float32Array; rs: Float32Array; rd: Float32Array; dep: Float32Array;
  phase: number; fin: number;
  depth: number; depthGoal: number; depthT: number;
  wander: number; wanderT: number; react: number; target: Pellet | null;
  flick: number; gulp: number;
  homeX: number; homeY: number;
  base: number; spots: Spot[]; sumi: number;
};

/** drops the items that fail the test, in place */
function keep<T>(a: T[], ok: (x: T) => boolean) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (ok(a[i])) a[n++] = a[i];
  a.length = n;
}
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const angDiff = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
function hash3(a: number, b: number, c: number) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (a: RGB, k: number): RGB => [Math.min(255, a[0] * k), Math.min(255, a[1] * k), Math.min(255, a[2] * k)];
const css = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const lum = (c: RGB) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const same = (a: Colors, b: Colors) =>
  COLOR_KEYS.every((k) => Math.abs(a[k][0] - b[k][0]) + Math.abs(a[k][1] - b[k][1]) + Math.abs(a[k][2] - b[k][2]) < 1.5);

/** CSS `ease`, cubic-bezier(.25, .1, .25, 1) */
function ease(x: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const it = 1 - t;
    const fx = 3 * 0.25 * t * it * it + 3 * 0.25 * t * t * it + t * t * t - x;
    const dx = 3 * 0.25 * it * it + 3 * 0.75 * t * t;
    if (Math.abs(fx) < 1e-5 || dx < 1e-6) break;
    t = clamp(t - fx / dx, 0, 1);
  }
  const it = 1 - t;
  return 3 * 0.1 * t * it * it + 3 * 1 * t * t * it + t * t * t;
}

/** body half-width along the spine, u = 0 snout … 1 tail root: a blunt round head, broad shoulders, a long taper */
function profile(u: number) {
  if (u < 0.15) return 0.66 + 0.34 * Math.sin((u / 0.15) * (Math.PI / 2));
  if (u < 0.4) return 1;
  const t = (u - 0.4) / 0.6;
  return 0.15 + 0.85 * (1 - Math.pow(t, 1.5));
}

/** stroke character that draws a line in direction (dx, dy), screen y down */
function strokeFor(dx: number, dy: number) {
  let a = Math.atan2(dy, dx);
  if (a < 0) a += Math.PI;
  const deg = (a * 180) / Math.PI;
  if (deg < 22.5 || deg >= 157.5) return G_DASH;
  if (deg < 67.5) return G_BSLASH;
  if (deg < 112.5) return G_PIPE;
  return G_SLASH;
}

function makePattern(): { base: number; spots: Spot[]; sumi: number } {
  const r = Math.random();
  const spots: Spot[] = [];
  if (r < 0.56) {
    // kohaku: white body, orange patches along the back, some with a red core
    let u = rand(0.0, 0.1);
    const n = 2 + Math.floor(rand(0, 2.4));
    for (let i = 0; i < n && u < 0.82; i++) {
      const red = Math.random() < 0.2;
      spots.push({ u, v: rand(-0.35, 0.35), ru: rand(0.07, 0.13), rv: rand(0.5, 0.85), c: red ? S_RED : S_ORANGE });
      if (!red && Math.random() < 0.45) spots.push({ u: u + rand(-0.03, 0.03), v: rand(-0.25, 0.25), ru: rand(0.03, 0.06), rv: rand(0.25, 0.45), c: S_RED });
      u += rand(0.17, 0.28);
    }
    return { base: S_WHITE, spots, sumi: Math.random() < 0.35 ? 0.035 : 0.008 };
  }
  if (r < 0.66) {
    // mostly orange, white snout and tail end
    spots.push({ u: rand(0.38, 0.5), v: rand(-0.1, 0.1), ru: rand(0.2, 0.27), rv: 1.4, c: S_ORANGE });
    if (Math.random() < 0.6) spots.push({ u: rand(0.3, 0.6), v: rand(-0.35, 0.35), ru: rand(0.05, 0.08), rv: 0.5, c: S_RED });
    return { base: S_WHITE, spots, sumi: 0.01 };
  }
  if (r < 0.88) {
    // sanke: white with orange patches and scattered sumi
    let u = rand(0.05, 0.15);
    while (u < 0.75) {
      spots.push({ u, v: rand(-0.35, 0.35), ru: rand(0.07, 0.12), rv: rand(0.5, 0.9), c: Math.random() < 0.3 ? S_RED : S_ORANGE });
      u += rand(0.2, 0.3);
    }
    return { base: S_WHITE, spots, sumi: 0.09 };
  }
  // white with deep red patches
  let u = rand(0.04, 0.12);
  while (u < 0.75) {
    spots.push({ u, v: rand(-0.35, 0.35), ru: rand(0.07, 0.12), rv: rand(0.5, 0.9), c: S_RED });
    u += rand(0.2, 0.32);
  }
  return { base: S_WHITE, spots, sumi: 0.01 };
}

export class Pond {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private root: HTMLElement;
  /** device px of each cell edge, relative to the page */
  private edgeX = new Int32Array(0);
  private edgeY = new Int32Array(0);
  private opts: PondOptions;
  private w = 0;
  private h = 0;
  private dpr = 1;
  /** size unit for distances (the cell height) */
  private C = 14;
  private CW = 12;
  private CH = 14;
  private SW = 24;
  private SH = 28;
  private cols = 0;
  private rows = 0;
  /** where the cell grid starts on the page (CSS px, -cell..0): the grid is centred, as recorded */
  private gx = 0;
  private gy = 0;
  private stamp = 1;
  private frameNo = 1;
  private ema = 1 / 60;
  /** of the last 8 paints, which were followed by a long commit (bit flags), how many, and paints since the layout */
  private heavyBits = 0;
  private heavy = 0;
  private paints = 0;
  private timer: MessageChannel | null = null;
  private lowFor = 0;
  private lowTimes = 0;
  private slowFor = 0;
  private carry = 0;
  /** a prepared frame not painted yet, and the cells it repaints */
  private pending = false;
  private frameT = 0; // when this frame's work began
  private pendF = 0;
  private repaint: number[] = [];
  private repaintAll = false;
  // a full repaint on a slow step is painted in two halves, top then bottom, over two frames (half = 1 between them);
  // pass 1 draws only the cells in [lo, hi)
  private half = 0;
  private lo = 0;
  private hi = 0;
  // per-cell layers (stamped with the frame number)
  private occAny = new Int32Array(0);
  private occTop = new Int32Array(0);
  private bgS = new Int32Array(0);
  private bgG = new Uint8Array(0);
  private bgA = new Float32Array(0);
  private shS = new Int32Array(0);
  private shA = new Float32Array(0);
  private own = new Int32Array(0);
  private quiet = new Uint8Array(0);
  private bgList: number[] = [];
  private shList: number[] = [];
  // fish draw ops
  private opI = new Int32Array(4096);
  private opK = new Int32Array(4096);
  private opA = new Float32Array(4096);
  private opN = 0;
  // what each cell holds on the canvas: a hash of its ordered draw ops, so only cells that changed are redrawn
  private sigF = new Int32Array(0);
  private sig = new Int32Array(0);
  private drawn = new Int32Array(0);
  private dirtyF = new Int32Array(0);
  private touched: number[] = [];
  private touchedPrev: number[] = [];
  private full = true;
  private pass = 0;
  private groups: { from: number; to: number; deep: boolean }[] = [];
  private order: { f: Fish | null; d: number }[] = [];
  private avoid: PondRect[] = [];
  private dim: PondRect[] = [];
  private fish: Fish[] = [];
  private pellets: Pellet[] = [];
  private live: Pellet[] = [];
  private ripples: Ripple[] = [];
  private splashes: Splash[] = [];
  private flashes: Flash[] = [];
  private table: string[] = SPECIALS.slice();
  private bodyGlyphs: number[] = [];
  // every cell image used so far, one small canvas each (key → image); an image older than spriteGen is redrawn in
  // place on its next use (copying from separate small canvases is about twice as fast as from slots of one atlas)
  private sprites = new Map<number, { cv: HTMLCanvasElement; x: CanvasRenderingContext2D; gen: number }>();
  private spriteGen = 0;
  private colors: Colors | null = null;
  private target: Colors | null = null;
  private from: Colors | null = null;
  private themeT = 0;
  private font = "monospace";
  private time = 0;
  private last = 0;
  private raf = 0;
  private visible = true;
  private inView = true;
  private motion = 1;
  private lastFood = -1;
  private pointer: { x: number; y: number } | null = null;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private mq: MediaQueryList | null = null;
  private probe: CanvasRenderingContext2D | null = null;
  // per-fish scratch
  private seg = new Float32Array((RN - 1) * 5);
  private chunk = new Float64Array(Math.ceil((RN - 1) / CHUNK) * 4);
  private lb = new Float64Array(Math.ceil((RN - 1) / CHUNK));
  private tmp = new Float32Array(SEG * 2);
  private fins: number[][] = Array.from({ length: 6 }, () => [0, 0, 0, 0, 0, 0, 0, 0]);

  constructor(canvas: HTMLCanvasElement, root: HTMLElement, opts: PondOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.root = root;
    this.opts = opts;
    this.setGlyphs(opts.glyphs);
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    this.probe = probe.getContext("2d");

    const ch = new MessageChannel();
    ch.port1.onmessage = (e: MessageEvent<number>) => {
      const long = performance.now() - e.data > 22 ? 1 : 0;
      this.heavy += long - ((this.heavyBits >>> 7) & 1);
      this.heavyBits = ((this.heavyBits << 1) | long) & 0xff;
      this.paints++;
    };
    this.timer = ch;
    this.mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.motion = this.mq.matches ? 0.4 : 1;
    this.mq.addEventListener("change", this.onMotion);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.visible = !document.hidden;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.io = new IntersectionObserver((e) => {
      this.inView = e[e.length - 1].isIntersecting;
      this.kick();
    });
    this.io.observe(root);
    document.fonts?.ready.then(() => this.dropSprites()).catch(() => {});
    document.fonts?.addEventListener?.("loadingdone", this.onFonts);
    this.readColors();
    this.resize();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro?.disconnect();
    this.io?.disconnect();
    this.mq?.removeEventListener("change", this.onMotion);
    document.removeEventListener("visibilitychange", this.onVisibility);
    document.fonts?.removeEventListener?.("loadingdone", this.onFonts);
    this.sprites.clear();
    this.timer?.port1.close();
    this.timer?.port2.close();
    this.timer = null;
  }

  /* ---------- public controls ---------- */

  setGlyphs(glyphs: string) {
    const chars = Array.from(glyphs || koiPondContent.glyphs);
    this.table = SPECIALS.slice();
    this.bodyGlyphs = chars.map((ch) => {
      let i = this.table.indexOf(ch);
      if (i < 0 && this.table.length < 64) {
        this.table.push(ch);
        i = this.table.length - 1;
      }
      return Math.max(0, i);
    });
    this.dropSprites();
  }

  setFishCount(n: number) {
    this.opts.fishCount = Math.max(0, Math.round(n));
    this.populate();
    this.emit(true);
  }

  setPalette(p: Partial<KoiPalette> | undefined) {
    this.opts.palette = p;
    this.readColors();
  }

  setPellets(p: [number, number]) {
    this.opts.pellets = p;
  }

  setOnStats(fn: PondOptions["onStats"]) {
    this.opts.onStats = fn;
    this.emit(true);
  }

  /** re-read the theme colours from CSS (also done every few frames); a change eases over 0.3 s */
  refreshColors() {
    this.readColors();
    this.kick();
  }

  /** drop a handful of pellets at (x, y) in CSS px relative to the pond */
  drop(px: number, py: number) {
    const C = this.C;
    const x = px - this.gx, y = py - this.gy; // page → grid space
    this.splashes.push({ x, y, t: 0, seed: (Math.random() * 1e9) | 0 });
    const [lo, hi] = this.opts.pellets;
    const n = Math.round(rand(lo - 0.499, hi + 0.499));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const r = Math.sqrt(Math.random()) * C * 3.3;
      this.pellets.push({
        x: clamp(x + Math.cos(a) * r, this.CW * 0.5, this.w - this.CW * 0.5),
        y: clamp(y + Math.sin(a) * r, this.CH * 0.5, this.h - this.CH * 0.5),
        land: this.time + 0.12 + i * 0.055 + rand(0, 0.04),
        landed: false,
        age: 0,
        dead: false,
      });
    }
    this.emit();
    this.kick();
  }

  /** a drop somewhere sensible, for keyboard users */
  dropSomewhere() {
    const p = this.pointer;
    if (p) return this.drop(p.x + this.gx, p.y + this.gy);
    for (let i = 0; i < 12; i++) {
      const x = rand(this.w * 0.2, this.w * 0.8), y = rand(this.h * 0.15, this.h * 0.6);
      if (this.escape(x, y, this.C * 2) === null || i === 11) return this.drop(x + this.gx, y + this.gy);
    }
  }

  /** remembers where the pointer is (keyboard drops land there); the pond itself does not react to hovering */
  move(x: number, y: number) {
    this.pointer = { x: x - this.gx, y: y - this.gy };
  }

  leave() {
    this.pointer = null;
  }

  /* ---------- lifecycle ---------- */

  private onMotion = () => {
    this.motion = this.mq?.matches ? 0.4 : 1;
  };
  private onVisibility = () => {
    this.visible = !document.hidden;
    this.kick();
  };
  private onFonts = () => this.dropSprites();

  /** forget the cached cell images (font, glyphs, size or colours changed): the next frame repaints every cell */
  private dropSprites() {
    this.spriteGen++;
    this.full = true;
  }

  private kick() {
    const run = this.visible && this.inView && this.w > 0 && this.h > 0;
    if (run && !this.raf) {
      this.last = performance.now();
      this.carry = 0;
      this.raf = requestAnimationFrame(this.frame);
    } else if (!run && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private resize() {
    const rect = this.root.getBoundingClientRect();
    const w = Math.round(rect.width), h = Math.round(rect.height);
    const dpr = this.lowFor > 0 ? 1 : Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr && this.cols) return;
    const pw = this.w, ph = this.h;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    const cell = this.opts.cell;
    const [bw, bh] = Array.isArray(cell) ? cell : [cell, cell];
    const s = clamp(w / 1000, 0.8, 1);
    this.CW = Math.max(7, Math.round(bw * s));
    this.CH = Math.max(8, Math.round(bh * s));
    this.C = this.CH;
    this.SW = Math.max(1, Math.round(this.CW * dpr));
    this.SH = Math.max(1, Math.round(this.CH * dpr));
    // the 1 px seams between cells fall at x ≡ w/2 - 2 and y ≡ h/2 - 2 (the grid is centred on the page)
    const md = (a: number, b: number) => ((a % b) + b) % b;
    this.gx = md(Math.round(w / 2) - 1, this.CW) - this.CW;
    this.gy = md(Math.round(h / 2) - 1, this.CH) - this.CH;
    this.cols = Math.ceil((w - this.gx) / this.CW);
    this.rows = Math.ceil((h - this.gy) / this.CH);
    const n = this.cols * this.rows;
    this.occAny = new Int32Array(n);
    this.occTop = new Int32Array(n);
    this.bgS = new Int32Array(n);
    this.bgG = new Uint8Array(n);
    this.bgA = new Float32Array(n);
    this.shS = new Int32Array(n);
    this.shA = new Float32Array(n);
    this.own = new Int32Array(n);
    this.quiet = new Uint8Array(n);
    this.readAreas(true);
    this.font = getComputedStyle(this.root).fontFamily || "monospace";
    this.sigF = new Int32Array(n);
    this.sig = new Int32Array(n);
    this.drawn = new Int32Array(n);
    this.dirtyF = new Int32Array(n);
    this.touched.length = this.touchedPrev.length = 0;
    this.pending = false;
    this.half = 0;
    this.paints = this.heavy = this.heavyBits = 0;
    this.layoutCanvas();
    this.dropSprites();
    const fresh = this.fish.length === 0;
    this.populate();
    // let a new pond swim for a moment before the first paint, so the koi start mid-stroke, not ruler-straight,
    // and the water already carries a few rings from their turns
    if (fresh && this.fish.length) for (let i = 0; i < 90; i++) this.update(1 / 30);
    if (pw && ph) {
      for (const f of this.fish) {
        if (f.x > w + f.len || f.y > h + f.len) this.place(f, rand(0.15, 0.85) * w, rand(0.15, 0.7) * h);
      }
    }
    if (w && h) this.render();
    this.emit(true);
    this.kick();
  }

  private layoutCanvas() {
    const cols = this.cols, rows = this.rows, CW = this.CW, CH = this.CH, dpr = this.dpr;
    this.canvas.width = Math.max(1, Math.round(this.w * dpr));
    this.canvas.height = Math.max(1, Math.round(this.h * dpr));
    const ex = (this.edgeX = new Int32Array(cols + 1)), ey = (this.edgeY = new Int32Array(rows + 1));
    for (let c = 0; c <= cols; c++) ex[c] = Math.round((c * CW + this.gx) * dpr);
    for (let r = 0; r <= rows; r++) ey[r] = Math.round((r * CH + this.gy) * dpr);
  }

  private place(f: Fish, x: number, y: number) {
    f.x = x;
    f.y = y;
    for (let j = 0; j < SEG; j++) {
      f.spine[j * 2] = x - Math.cos(f.a) * f.seg * j;
      f.spine[j * 2 + 1] = y - Math.sin(f.a) * f.seg * j;
    }
  }

  private populate() {
    if (!this.w || !this.h) return;
    const want = this.opts.fishCount;
    if (this.fish.length > want) this.fish.length = want;
    // koi keep their size on any desktop window (about 230 px nose to tail root, 95 px across) and shrink on phones
    const k = clamp(Math.min(this.w, this.h * 1.6) / 1300, 0.6, 1);
    const C = this.C;
    // spread new fish over the cells of a jittered grid, in random order, filling cells clear of the text first
    const W = this.w, H = this.h;
    const cols = Math.ceil(Math.sqrt((want * W) / H)) || 1;
    const rows = Math.ceil(want / cols) || 1;
    const slots: [number, number, number][] = [];
    for (let gy = 0; gy < rows; gy++)
      for (let gx = 0; gx < cols; gx++) {
        const sx = W * (0.04 + 0.92 * ((gx + 0.5) / cols)), sy = H * (0.05 + 0.85 * ((gy + 0.5) / rows));
        slots.push([gx, gy, (this.escape(sx, sy, C * 2) === null ? 0 : 1) + Math.random()]);
      }
    slots.sort((a, b) => a[2] - b[2]);
    for (let i = this.fish.length, n = 0; i < want; i++, n++) {
      const slot = slots[n % slots.length];
      const gx = slot[0] + rand(0.15, 0.85), gy = slot[1] + rand(0.15, 0.85);
      const len = rand(15, 18) * C * k;
      const hw = len * rand(0.165, 0.18);
      const a = rand(0, TAU);
      const x = W * (0.04 + 0.92 * (gx / cols));
      let y = H * (0.05 + 0.85 * (gy / rows));
      if (this.escape(x, y, C) !== null) y = Math.max(H * 0.08, (this.avoid[0]?.y ?? y) - len * 0.4);
      const seg = len / (SEG - 1);
      const cruise = rand(22, 34) * Math.sqrt(k / 0.9);
      const deep = Math.random() < 0.3;
      const depth = deep ? rand(0.55, 0.85) : rand(0, 0.12);
      const f: Fish = {
        seed: (Math.random() * 1e9) | 0,
        x, y, a, av: 0, sp: cruise, goal: cruise, cruise, chase: cruise * rand(4.2, 5),
        len, hw, seg, tail: rand(0.36, 0.44),
        spine: new Float32Array(SEG * 2), rs: new Float32Array(RN * 2), rd: new Float32Array(RN), dep: new Float32Array(SEG).fill(depth),
        phase: rand(0, TAU), fin: rand(0, TAU),
        depth, depthGoal: depth, depthT: rand(4, 14),
        wander: rand(-0.6, 0.6), wanderT: rand(1, 5), react: rand(0.1, 0.6), target: null,
        flick: rand(0.5, 4), gulp: rand(2, 12),
        homeX: rand(-0.3, 0.3), homeY: rand(-0.25, 0.3),
        ...makePattern(),
      };
      this.place(f, x, y);
      this.fish.push(f);
    }
  }

  /* ---------- colours ---------- */

  private parse(v: string): RGB | null {
    const p = this.probe;
    if (!v || !p) return null;
    p.fillStyle = "#000";
    p.fillStyle = v;
    const s = String(p.fillStyle);
    if (s[0] === "#") return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const m = s.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : null;
  }

  private readColors() {
    const cs = getComputedStyle(this.root);
    const get = (n: string) => cs.getPropertyValue(n).trim();
    const ink = this.parse(get("--ink")) || this.parse(cs.color) || [240, 239, 235];
    const paper = this.parse(get("--paper")) || (lum(ink) > 0.5 ? ([24, 24, 22] as RGB) : ([246, 244, 242] as RGB));
    const base = koiPondContent.palettes[lum(paper) > 0.5 ? "light" : "dark"];
    const pal = this.opts.palette || {};
    const next = { paper, ink } as Colors;
    for (const k of PAL_KEYS) next[k] = this.parse(pal[k] || "") || this.parse(get(`--koi-${k}`)) || this.parse(base[k]) || [128, 128, 128];
    const fam = cs.fontFamily || "monospace";
    if (fam !== this.font) {
      this.font = fam;
      this.dropSprites();
    }
    if (!this.colors) {
      this.colors = this.target = next;
      return;
    }
    if (this.target && same(this.target, next)) return;
    // the new theme: every colour of the pond eases to it in step with the page's CSS transition. Each step repaints
    // every cell, so for its duration the work of a step is split over two frames (worked out in one, painted in the
    // next, as when the machine is slow, and every cell is repainted in two halves): colour steps at 20 a second, and no
    // frame much heavier than usual. Where frames already run well late, the pond takes the new colours in one step.
    this.target = next;
    if (this.ema > 0.024 || this.lowFor > 0) {
      this.colors = next;
      this.from = null;
      this.dropSprites();
      return;
    }
    this.from = this.colors;
    this.themeT = 0;
  }

  private stepColors(dt: number) {
    const a = this.from, b = this.target;
    if (!a || !b) return;
    this.themeT += dt;
    const p = ease(this.themeT / THEME_SECONDS);
    if (p >= 1) {
      this.colors = b;
      this.from = null;
    } else {
      const n = {} as Colors;
      for (const k of COLOR_KEYS) n[k] = mix(a[k], b[k], p);
      this.colors = n;
    }
    this.dropSprites();
  }

  private get dark() {
    return this.colors ? lum(this.colors.paper) < 0.5 : true;
  }

  /** the image of a cell (a filled koi cell with its glyph, or a bare glyph), drawn on first use */
  private sprite(key: number) {
    let sp = this.sprites.get(key);
    if (sp && sp.gen === this.spriteGen) return sp.cv;
    const SW = this.SW, SH = this.SH;
    if (!sp) {
      const cv = document.createElement("canvas");
      cv.width = SW;
      cv.height = SH;
      sp = { cv, x: cv.getContext("2d")!, gen: 0 };
      this.sprites.set(key, sp);
    } else if (sp.cv.width !== SW || sp.cv.height !== SH) {
      sp.cv.width = SW;
      sp.cv.height = SH;
    } else sp.x.clearRect(0, 0, SW, SH);
    sp.gen = this.spriteGen;
    const x = sp.x;
    const c = this.colors!;
    x.textAlign = "center";
    x.textBaseline = "middle";
    if (key >= TEXT_KEY) {
      const tone = Math.floor((key - TEXT_KEY) / 64), g = (key - TEXT_KEY) % 64;
      x.fillStyle = css(c[TONE_KEY[tone]]);
      const star = g === G_STAR, o = g === G_O;
      x.font = `${star || o ? 700 : 500} ${Math.round(SH * (star ? 0.8 : o ? 0.7 : 0.66))}px ${this.font}`;
      const gp = Math.max(1, Math.round(this.dpr));
      x.fillText(this.table[g], (SW - gp) / 2, (SH - gp) / 2 + SH * (star ? 0.12 : 0.03));
    } else {
      const gl = key % 64, sj = Math.floor(key / 64), slot = Math.floor(sj / 4), jit = sj % 4;
      const base = c[SLOT_KEY[slot]];
      const fill = slot <= S_NAVY ? scale(base, JITTER[jit]) : slot === S_EYE ? base : mix(base, c.paper, jit === 0 ? 0 : -0.12);
      const g = Math.max(1, Math.round(this.dpr)); // one CSS px seam on the right and at the bottom
      x.fillStyle = css(fill);
      x.fillRect(0, 0, SW - g, SH - g);
      if (gl !== G_NONE) {
        const gc = slot === S_EYE ? c.eyeGlyph : slot >= S_RIM ? c.finGlyph : mix(fill, [0, 0, 0], this.dark ? 0.22 : 0.28);
        x.fillStyle = css(gc);
        x.font = `${slot === S_EYE ? 700 : 500} ${Math.round(Math.min(SH * (slot === S_EYE ? 0.7 : 0.64), SW * 1.05))}px ${this.font}`;
        const cx = (SW - g) / 2, cy = (SH - g) / 2;
        x.fillText(this.table[gl], cx, cy + SH * 0.03);
      }
    }
    return sp.cv;
  }

  /* ---------- simulation ---------- */

  private frame = (now: number) => {
    this.raf = 0;
    this.frameT = performance.now();
    const raw = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    // When frames keep running late (over 18 ms on average), the pond steps on every other frame: it works out a step
    // in one frame and paints it in the next. When a painting frame's work (the pond's and the browser's, up to the
    // canvas reaching the screen) takes over 22 ms in six of the last eight paints, the canvas also drops to one pixel
    // per CSS px for a while (each later drop lasts twice as long).
    this.ema += (Math.min(raw, 0.05) - this.ema) * 0.1;
    if (this.ema > 0.0185) this.slowFor = 300;
    else if (this.slowFor > 0) this.slowFor--;
    if (this.lowFor > 0) {
      if (--this.lowFor === 0 && this.ema > 0.019) this.lowFor = 120;
      if (this.lowFor === 0) this.resize();
    } else if (this.heavy >= 6 && this.paints >= 8) {
      this.lowFor = 1200 * 2 ** Math.min(4, this.lowTimes++);
      this.resize();
    }
    this.carry = Math.min(0.1, this.carry + raw);
    const slow = this.slowFor > 0 || this.from !== null; // a colour ease repaints every cell: always split
    if (slow && this.pending) {
      // the second half of a slow step: paint what the last frame worked out (a repaint of every cell takes two frames)
      this.paint(true);
    } else {
      if (this.pending) this.paint();
      const dt = Math.min(0.07, this.carry);
      this.carry = 0;
      this.time += dt;
      this.frameNo++;
      if (this.frameNo % 8 === 0) this.readColors();
      if (this.frameNo % 30 === 0) this.readAreas(false);
      this.stepColors(dt);
      this.update(dt);
      this.prepare();
      if (!slow) this.paint();
    }
    if (!this.raf && this.visible && this.inView && this.w > 0) this.raf = requestAnimationFrame(this.frame);
  };

  private readAreas(force: boolean) {
    const a = this.opts.getAvoid?.() || [];
    const d = this.opts.getDim?.() || [];
    const eq = (x: PondRect[], y: PondRect[]) =>
      x.length === y.length && x.every((r, i) => Math.abs(r.x - y[i].x) + Math.abs(r.y - y[i].y) + Math.abs(r.w - y[i].w) + Math.abs(r.h - y[i].h) < 1);
    if (!force && eq(a, this.avoid) && eq(d, this.dim)) return;
    this.avoid = a.map((r) => ({ ...r, x: r.x - this.gx, y: r.y - this.gy }));
    this.dim = d.map((r) => ({ ...r, x: r.x - this.gx, y: r.y - this.gy }));
    // the pond is drawn faintly under the dim areas only (the text itself), so it shows between the lines
    const q = this.quiet, CW = this.CW, CH = this.CH, cols = this.cols, rows = this.rows;
    q.fill(0);
    for (const r of this.dim) {
      const c0 = Math.max(0, Math.floor((r.x - 2) / CW)), c1 = Math.min(cols - 1, Math.floor((r.x + r.w + 2) / CW));
      const r0 = Math.max(0, Math.floor((r.y + 1) / CH)), r1 = Math.min(rows - 1, Math.floor((r.y + r.h - 1) / CH));
      for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) q[y * cols + x] = 1;
    }
  }

  /** angle pointing out of an avoided area if (x, y) is inside it (padded), else null */
  private escape(x: number, y: number, pad: number) {
    for (const r of this.avoid) {
      if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) {
        const dl = x - (r.x - pad), dr = r.x + r.w + pad - x, dt = y - (r.y - pad), db = r.y + r.h + pad - y;
        const m = Math.min(dl, dr, dt, db);
        return m === dl ? Math.PI : m === dr ? 0 : m === dt ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    return null;
  }

  private emit(force = false) {
    let n = 0;
    for (const p of this.pellets) if (!p.dead) n++;
    if (n !== this.lastFood || force) {
      this.lastFood = n;
      this.opts.onStats?.({ fish: this.fish.length, food: n });
    }
  }

  private ripple(x: number, y: number, r0: number, R: number, tau: number, dur: number, k: number) {
    const m = this.motion;
    this.ripples.push({ x, y, t: 0, dur: dur * (0.6 + 0.4 * m), r0, R: r0 + (R - r0) * (0.45 + 0.55 * m), tau, k, seed: (Math.random() * 1e9) | 0 });
    if (this.ripples.length > 120) this.ripples.splice(0, this.ripples.length - 120);
  }

  private update(dt: number) {
    const C = this.C, W = this.w, H = this.h, m = this.motion;
    // pellets land (each one rings the water), float, and fade after a minute if nobody eats them
    for (const p of this.pellets) {
      if (!p.landed && this.time >= p.land) {
        p.landed = true;
        this.ripple(p.x, p.y, C * 0.4, C * 7.2, 1.2, 4.2, 0.95);
      }
      if (p.landed) {
        p.age += dt;
        if (p.age > 60) p.dead = true;
      }
    }
    const live = this.live;
    live.length = 0;
    for (const p of this.pellets) if (p.landed && !p.dead) live.push(p);
    const reach = Math.max(C * 22, Math.max(W, H) * 0.28);

    for (const f of this.fish) {
      if (f.target && f.target.dead) {
        f.target = null;
        f.react = rand(0.05, 0.3);
      }
      if (live.length) {
        if (!f.target) {
          f.react -= dt;
          if (f.react <= 0) {
            f.target = this.nearest(live, f, reach);
            if (!f.target) f.react = rand(0.3, 0.8);
          }
        }
      } else {
        f.react = rand(0.05, 0.35);
      }

      let desired: number | null = null;
      let goal = f.goal;
      let maxTurn = 0.7;
      if (f.target) {
        const dx = f.target.x - f.x, dy = f.target.y - f.y;
        desired = Math.atan2(dy, dx);
        const d = angDiff(desired, f.a);
        goal = f.chase * (0.35 + 0.65 * Math.max(0, Math.cos(d))) * clamp(Math.hypot(dx, dy) / (C * 4) + 0.35, 0, 1);
        maxTurn = 2.6;
        f.depthGoal = 0;
      } else {
        f.wanderT -= dt;
        if (f.wanderT <= 0) {
          f.wander = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.3 ? rand(0, 0.12) : rand(0.3, 0.85));
          f.wanderT = Math.random() < 0.25 ? rand(1, 2.5) : rand(2.5, 6);
          f.goal = f.cruise * rand(0.75, 1.25);
        }
        f.depthT -= dt;
        if (f.depthT <= 0) {
          f.depthT = rand(6, 16);
          f.depthGoal = Math.random() < 0.3 ? rand(0.55, 0.85) : rand(0, 0.12);
        }
        const mx = Math.min(W, H) * 0.05;
        if (f.x < mx || f.x > W - mx || f.y < mx || f.y > H - mx) {
          desired = Math.atan2(H * (0.45 + f.homeY) - f.y, W * (0.5 + f.homeX) - f.x);
          maxTurn = 0.8;
        }
        if (this.avoid.length) {
          const look = f.hw + C * 2;
          const out = this.escape(f.x + Math.cos(f.a) * look, f.y + Math.sin(f.a) * look, C * 0.5) ?? this.escape(f.x, f.y, C * 0.5);
          if (out !== null) {
            desired = out;
            maxTurn = 1.3;
          }
        }
      }
      const targetAv = desired === null ? f.wander : clamp(angDiff(desired, f.a) * 2.4, -maxTurn, maxTurn);
      f.av += (targetAv - f.av) * (1 - Math.exp(-dt * (f.target ? 6 : 1.8)));
      f.a += f.av * dt * (0.5 + 0.5 * m);
      f.sp += (goal - f.sp) * (1 - Math.exp(-dt * (f.target ? 3.2 : 0.9)));
      const v = f.sp * m;
      f.x += Math.cos(f.a) * v * dt;
      f.y += Math.sin(f.a) * v * dt;
      f.phase += dt * (2 + (f.sp / f.len) * 12) * (0.6 + 0.4 * m);
      f.fin += dt * (1.4 + (f.sp / f.len) * 5);
      f.depth += (f.depthGoal - f.depth) * (1 - Math.exp(-dt * (f.target ? 1.2 : 0.4)));

      // depth travels down the body: the head leads, the tail follows the path it swam
      const D = f.dep;
      const carry = clamp((v * dt) / f.seg, 0, 1);
      for (let i = SEG - 1; i > 0; i--) D[i] += (D[i - 1] - D[i]) * carry;
      D[0] = f.depth;

      // spine follows the head like a chain with limited bend; deeper parts look larger
      const s = f.spine;
      s[0] = f.x;
      s[1] = f.y;
      let pa = f.a;
      for (let i = 1; i < SEG; i++) {
        let ang = Math.atan2(s[i * 2 - 1] - s[i * 2 + 1], s[i * 2 - 2] - s[i * 2]);
        const d = angDiff(ang, pa);
        if (d > 0.3) ang = pa + 0.3;
        else if (d < -0.3) ang = pa - 0.3;
        const segLen = f.seg * (1 + 0.3 * D[i]);
        s[i * 2] = s[i * 2 - 2] - Math.cos(ang) * segLen;
        s[i * 2 + 1] = s[i * 2 - 1] - Math.sin(ang) * segLen;
        pa = ang;
      }

      // a koi at the surface rings the water: its tail flicks on a hard turn, now and then it gulps at the surface
      f.flick -= dt;
      f.gulp -= dt;
      const tx = s[(SEG - 1) * 2], ty = s[(SEG - 1) * 2 + 1];
      if (f.flick <= 0 && D[SEG - 1] < 0.3 && (Math.abs(f.av) > 0.8 || Math.random() < dt / 3.5)) {
        this.ripple(tx, ty, C * 0.5, C * 8, 1.6, 4.6, 0.5);
        f.flick = rand(1.8, 3.6);
      }
      if (f.gulp <= 0) {
        if (f.depth < 0.25) this.ripple(f.x + Math.cos(f.a) * f.hw * 0.6, f.y + Math.sin(f.a) * f.hw * 0.6, C * 0.4, C * 6.5, 1.4, 4, 0.45);
        f.gulp = rand(4, 9);
      }

      // eat: a surfaced koi gulps every pellet that passes its mouth, not only the one it aimed for
      if (live.length && f.depth < 0.35) {
        const mxp = f.x + Math.cos(f.a) * f.hw * 0.4, myp = f.y + Math.sin(f.a) * f.hw * 0.4;
        const gulp = C * 0.9 + f.hw * 0.3;
        for (const p of live) {
          if (p.dead || Math.abs(p.x - mxp) > gulp || Math.abs(p.y - myp) > gulp || Math.hypot(p.x - mxp, p.y - myp) > gulp) continue;
          p.dead = true;
          this.flashes.push({ col: Math.floor(p.x / this.CW), row: Math.floor(p.y / this.CH), t: 0 });
          this.ripple(p.x, p.y, C * 0.6, C * 6, 1.1, 2.8, 0.6);
          if (f.target === p) {
            f.target = null;
            f.react = rand(0.05, 0.25);
          }
        }
      }
    }
    keep(this.pellets, (p) => !p.dead);
    this.emit();

    for (const r of this.ripples) r.t += dt;
    keep(this.ripples, (r) => r.t < r.dur);
    for (const s of this.splashes) s.t += dt;
    keep(this.splashes, (s) => s.t < 0.3);
    for (const fl of this.flashes) fl.t += dt;
    keep(this.flashes, (fl) => fl.t < 0.32);
  }

  private nearest(list: Pellet[], f: Fish, reach: number) {
    let best: Pellet | null = null, bd = Infinity;
    for (const p of list) {
      const d = Math.hypot(p.x - f.x, p.y - f.y) * (1 + Math.random() * 0.25);
      if (d < bd && d < reach) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /* ---------- drawing ---------- */

  private render() {
    this.prepare();
    this.paint();
  }

  /** works out what every cell holds this frame and which cells changed; paint() then draws them */
  private prepare() {
    if (!this.ctx || !this.colors) return;
    if (this.pending) this.paint();
    const F = this.frameNo;
    this.opN = 0;
    this.shList.length = 0;
    this.bgList.length = 0;

    // 1. rasterise the koi, deepest first
    const fish = this.fish, order = this.order;
    while (order.length < fish.length) order.push({ f: null, d: 0 });
    order.length = fish.length;
    for (let n = 0; n < fish.length; n++) {
      const f = fish[n];
      let s = 0;
      for (let i = 0; i < SEG; i++) s += f.dep[i];
      order[n].f = f;
      order[n].d = s / SEG;
    }
    order.sort((a, b) => b.d - a.d);
    const groups = this.groups;
    while (groups.length < order.length) groups.push({ from: 0, to: 0, deep: false });
    groups.length = order.length;
    for (let n = 0; n < order.length; n++) {
      const from = this.opN;
      this.rasterFish(order[n].f!, F);
      groups[n].from = from;
      groups[n].to = this.opN;
      groups[n].deep = order[n].d >= 0.45;
    }

    // 2. ripples and splashes into the background layer
    this.rasterWater(F);

    // 3. hash what every touched cell will hold, then repaint only the cells whose contents changed
    //    (a frame changes about one cell in ten; a theme fade or a resize repaints them all)
    const full = this.full;
    this.full = false;
    const touched = this.touched;
    touched.length = 0;
    this.pass = 0;
    this.walk(F);
    const sig = this.sig, drawn = this.drawn, sigF = this.sigF, dirtyF = this.dirtyF;
    const prev = this.touchedPrev, repaint = this.repaint;
    repaint.length = 0;
    for (let n = 0; n < prev.length; n++) {
      const i = prev[n];
      if (sigF[i] !== F && drawn[i] !== 0) {
        dirtyF[i] = F;
        repaint.push(i);
        drawn[i] = 0;
      }
    }
    for (let n = 0; n < touched.length; n++) {
      const i = touched[n];
      if (full || sig[i] !== drawn[i]) {
        dirtyF[i] = F;
        repaint.push(i);
        drawn[i] = sig[i];
      }
    }
    this.touched = prev;
    this.touchedPrev = touched;
    this.repaintAll = full;
    this.pending = true;
    this.pendF = F;
  }

  /** clears the changed cells and draws their contents (with `part`, only the top half of a full repaint not yet
   *  begun; a later call paints the rest) */
  private paint(part = false) {
    const ctx = this.ctx;
    if (!this.pending || !ctx) return;
    const F = this.pendF, cols = this.cols, rows = this.rows, ex = this.edgeX, ey = this.edgeY;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let lo = 0, hi = rows;
    if (this.repaintAll) {
      const mid = rows >> 1;
      if (this.half) lo = mid;
      else if (part) hi = mid;
      const y0 = lo ? ey[lo] : 0, y1 = hi < rows ? ey[hi] : this.canvas.height;
      ctx.clearRect(0, y0, this.canvas.width, y1 - y0);
    } else
      for (const i of this.repaint) {
        const col = i % cols, row = (i / cols) | 0;
        ctx.clearRect(ex[col], ey[row], ex[col + 1] - ex[col], ey[row + 1] - ey[row]);
      }
    this.half = hi < rows ? 1 : 0;
    this.pending = this.half === 1;
    this.lo = lo * cols;
    this.hi = hi * cols;
    this.pass = 1;
    this.walk(F);
    ctx.globalAlpha = 1;
    // a message posted now arrives once the browser has committed this frame: it times the whole frame's work
    // (only ordinary frames are timed)
    if (!this.repaintAll) this.timer?.port2.postMessage(this.frameT);
  }

  /** every cell draw of the frame in paint order: pass 0 hashes them per cell, pass 1 paints those in changed cells */
  private walk(F: number) {
    const cols = this.cols, q = this.quiet, groups = this.groups;
    const shadow = TEXT_KEY + T_SHADOW * 64 + G_COLON;
    for (const i of this.shList) {
      if (this.occAny[i] === F || this.bgS[i] === F) continue;
      this.cell(i, shadow, this.shA[i] * (q[i] ? 0.25 : 1), F);
    }
    for (const g of groups) if (g.deep) for (let n = g.from; n < g.to; n++) this.cell(this.opI[n], this.opK[n], this.opA[n], F);
    for (const i of this.bgList) {
      if (this.occTop[i] === F) continue;
      this.cell(i, TEXT_KEY + T_LINE * 64 + this.bgG[i], Math.min(1, this.bgA[i]) * (q[i] ? 0.3 : 1), F);
    }
    for (const g of groups) if (!g.deep) for (let n = g.from; n < g.to; n++) this.cell(this.opI[n], this.opK[n], this.opA[n], F);

    // 4. food on top
    const pellet = TEXT_KEY + T_FOOD * 64 + G_O;
    for (const p of this.pellets) {
      if (!p.landed) continue;
      const c = Math.floor(p.x / this.CW), r = Math.floor(p.y / this.CH);
      if (c < 0 || r < 0 || c >= cols || r >= this.rows) continue;
      this.cell(r * cols + c, pellet, Math.min(1, p.age / 0.1) * (p.age > 55 ? Math.max(0, (60 - p.age) / 5) : 1) * (q[r * cols + c] ? 0.45 : 1), F);
    }
    const star = TEXT_KEY + T_FOOD * 64 + G_STAR;
    for (const fl of this.flashes) {
      if (fl.col < 0 || fl.row < 0 || fl.col >= cols || fl.row >= this.rows) continue;
      this.cell(fl.row * cols + fl.col, star, 1 - Math.pow(fl.t / 0.32, 2), F);
    }
  }

  private cell(i: number, key: number, alpha: number, F: number) {
    // opacity in steps of 1/64 (finer than the eye can tell on a glyph): a slowly fading ring or koi repaints a cell
    // every few frames instead of every frame
    const a = alpha >= 1 ? ALPHA_STEPS : Math.round(alpha * ALPHA_STEPS);
    if (a <= 0) return;
    if (this.pass === 0) {
      let h = this.sigF[i] === F ? this.sig[i] : 0x2545f491;
      if (this.sigF[i] !== F) {
        this.sigF[i] = F;
        this.touched.push(i);
      }
      h = Math.imul(h ^ (key * 256 + a), 0x9e3779b1);
      h ^= h >>> 15;
      this.sig[i] = h | 1;
      // draw any new cell image now, before the canvas starts copying from it
      this.sprite(key);
      return;
    }
    if (this.dirtyF[i] !== F || i < this.lo || i >= this.hi) return;
    const ctx = this.ctx!, cols = this.cols;
    ctx.globalAlpha = a / ALPHA_STEPS;
    ctx.drawImage(this.sprite(key), this.edgeX[i % cols], this.edgeY[(i / cols) | 0]);
  }

  private pushOp(idx: number, key: number, alpha: number) {
    if (this.opN >= this.opI.length) {
      const grow = <T extends Int32Array | Float32Array>(a: T, make: (n: number) => T) => {
        const b = make(a.length * 2);
        b.set(a);
        return b;
      };
      this.opI = grow(this.opI, (n) => new Int32Array(n));
      this.opK = grow(this.opK, (n) => new Int32Array(n));
      this.opA = grow(this.opA, (n) => new Float32Array(n));
    }
    this.opI[this.opN] = idx;
    this.opK[this.opN] = key;
    this.opA[this.opN] = alpha;
    this.opN++;
  }

  private bg(idx: number, g: number, a: number, F: number) {
    if (this.bgS[idx] !== F) {
      this.bgS[idx] = F;
      this.bgA[idx] = a;
      this.bgG[idx] = g;
      this.bgList.push(idx);
    } else if (a > this.bgA[idx]) {
      this.bgA[idx] = a;
      this.bgG[idx] = g;
    }
  }

  private rasterWater(F: number) {
    const C = this.C, CW = this.CW, CH = this.CH, cols = this.cols, rows = this.rows;
    for (const rp of this.ripples) {
      const p = rp.t / rp.dur;
      // the ring grows in steps of 3 px (a quarter cell): finer steps would change no glyph, only repaint cells
      const r = Math.round((rp.r0 + (rp.R - rp.r0) * (1 - Math.exp(-rp.t / rp.tau))) / 3) * 3;
      const alpha = rp.k * (1 - p * p) * Math.min(1, rp.t / 0.06);
      if (alpha < 0.02) continue;
      // the stroke band widens a little as the ring spreads, so a wide ring reads as a double line
      const band = C * (0.55 + 0.3 * Math.min(1, r / (C * 8)));
      const inner = r - C * 1.75, ib = C * 0.42;
      const reach = r + band;
      const c0 = Math.max(0, Math.floor((rp.x - reach) / CW)), c1 = Math.min(cols - 1, Math.floor((rp.x + reach) / CW));
      const r0 = Math.max(0, Math.floor((rp.y - reach) / CH)), r1 = Math.min(rows - 1, Math.floor((rp.y + reach) / CH));
      // only the cells whose centres fall in the annulus that holds the ring and its dots are looked at
      const dots = inner > C * 0.9;
      const lo = Math.max(0, Math.min(r - band, dots ? inner - ib : Infinity) - 1), hi = Math.max(reach, dots ? inner + ib : 0) + 1;
      for (let row = r0; row <= r1; row++) {
        const dy = (row + 0.5) * CH - rp.y;
        const xo2 = hi * hi - dy * dy;
        if (xo2 < 0) continue;
        const xo = Math.sqrt(xo2), xi = lo > Math.abs(dy) ? Math.sqrt(lo * lo - dy * dy) : -1;
        for (let side = 0; side < 2; side++) {
          // left part [x - xo, x - xi], right part [x + xi, x + xo]; one span when the row passes the hole
          if (side === 1 && xi < 0) break;
          const a = side === 0 ? rp.x - xo : rp.x + xi;
          const z = side === 0 ? (xi < 0 ? rp.x + xo : rp.x - xi) : rp.x + xo;
          const ca = Math.max(c0, Math.floor(a / CW - 0.5)), cb = Math.min(c1, Math.ceil(z / CW - 0.5));
          for (let col = ca; col <= cb; col++) {
            const dx = (col + 0.5) * CW - rp.x;
            const d = Math.hypot(dx, dy);
            const off = Math.abs(d - r);
            const idx = row * cols + col;
            if (off <= band) {
              this.bg(idx, d < 1 ? G_DOT : strokeFor(-dy, dx), alpha * (1 - (off / band) * 0.45), F);
            } else if (dots && Math.abs(d - inner) <= ib && hash3(col, row, rp.seed) < 0.62) {
              this.bg(idx, G_DOT, alpha * 0.8, F);
            }
          }
        }
      }
    }
    for (const s of this.splashes) {
      const a = 0.8 * (1 - s.t / 0.3);
      const tick = Math.floor(s.t / 0.05);
      for (let j = 0; j < 7; j++) {
        const ang = hash3(s.seed, j, tick) * TAU;
        const rr = (0.6 + hash3(s.seed, j + 11, tick) * 2.9) * C;
        const col = Math.floor((s.x + Math.cos(ang) * rr) / CW), row = Math.floor((s.y + Math.sin(ang) * rr) / CH);
        if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
        this.bg(row * cols + col, hash3(s.seed, j + 23, tick) < 0.55 ? G_DOT : G_COLON, a, F);
      }
    }
  }

  /** the render spine: the physics spine plus a travelling body wave, smoothed into one curve and subdivided */
  private bodyCurve(f: Fish) {
    const Sp = f.spine, T = this.tmp, P = f.rs, RD = f.rd, D = f.dep;
    const m = this.motion;
    const amp = f.hw * 0.26 * (0.5 + 0.5 * m) * (0.5 + 0.6 * Math.min(1, f.sp / f.chase));
    for (let i = 0; i < SEG; i++) {
      const j = i === 0 ? 1 : i;
      const dx = Sp[j * 2 - 2] - Sp[j * 2], dy = Sp[j * 2 - 1] - Sp[j * 2 + 1];
      const l = Math.hypot(dx, dy) || 1;
      const t = i / (SEG - 1);
      const off = amp * Math.pow(t, 1.6) * Math.sin(f.phase - t * 4.2);
      T[i * 2] = Sp[i * 2] + (-dy / l) * off;
      T[i * 2 + 1] = Sp[i * 2 + 1] + (dx / l) * off;
    }
    // two passes of [1 2 1] smoothing: a bend reads as one continuous arc, never as joints
    for (let pass = 0; pass < 2; pass++) {
      let px = T[0], py = T[1];
      for (let i = 1; i < SEG - 1; i++) {
        const cx = T[i * 2], cy = T[i * 2 + 1];
        T[i * 2] = (px + 2 * cx + T[i * 2 + 2]) * 0.25;
        T[i * 2 + 1] = (py + 2 * cy + T[i * 2 + 3]) * 0.25;
        px = cx;
        py = cy;
      }
    }
    // subdivide with the four-point scheme so the outline follows a curve, not a polyline
    for (let i = 0; i < SEG; i++) {
      P[i * 4] = T[i * 2];
      P[i * 4 + 1] = T[i * 2 + 1];
      RD[i * 2] = D[i];
      if (i === SEG - 1) break;
      const a = Math.max(0, i - 1), d = Math.min(SEG - 1, i + 2);
      P[i * 4 + 2] = (-T[a * 2] + 9 * T[i * 2] + 9 * T[i * 2 + 2] - T[d * 2]) / 16;
      P[i * 4 + 3] = (-T[a * 2 + 1] + 9 * T[i * 2 + 1] + 9 * T[i * 2 + 3] - T[d * 2 + 1]) / 16;
      RD[i * 2 + 1] = (D[i] + D[i + 1]) * 0.5;
    }
  }

  private rasterFish(f: Fish, F: number) {
    const CW = this.CW, CH = this.CH, C = this.C, cols = this.cols, rows = this.rows, N = RN;
    this.bodyCurve(f);
    const P = f.rs, D = f.rd, sg = this.seg;
    const stamp = ++this.stamp;
    const HW = f.hw, LEN = f.len;
    const m = this.motion;
    const q = this.quiet;

    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (let i = 0; i < N - 1; i++) {
      const ax = P[i * 2], ay = P[i * 2 + 1];
      const ex = P[i * 2 + 2] - ax, ey = P[i * 2 + 3] - ay;
      sg[i * 5] = ax;
      sg[i * 5 + 1] = ay;
      sg[i * 5 + 2] = ex;
      sg[i * 5 + 3] = ey;
      sg[i * 5 + 4] = 1 / (ex * ex + ey * ey || 1);
    }
    for (let i = 0; i < N; i++) {
      minx = Math.min(minx, P[i * 2]);
      maxx = Math.max(maxx, P[i * 2]);
      miny = Math.min(miny, P[i * 2 + 1]);
      maxy = Math.max(maxy, P[i * 2 + 1]);
    }
    const sc = (i: number) => 1 + 0.3 * D[i];

    // fins: pectoral, pelvic and the two lobes of the fan tail  [rx, ry, dx, dy, L, W, kind, depth]
    const fins = this.fins;
    let nf = 0;
    const finAt = (u: number, side: number, ang: number, L: number, Wd: number, out: number, kind: number) => {
      const k = Math.max(1, Math.round(u * (N - 1)));
      const bx0 = P[k * 2] - P[k * 2 - 2], by0 = P[k * 2 + 1] - P[k * 2 - 1];
      const bl = Math.hypot(bx0, by0) || 1;
      const bx = bx0 / bl, by = by0 / bl; // toward the tail
      const nx = -by, ny = bx;
      const hwu = HW * profile(k / (N - 1)) * sc(k);
      const rx = P[k * 2] + nx * side * hwu * out, ry = P[k * 2 + 1] + ny * side * hwu * out;
      const a = side * ang;
      const dx = bx * Math.cos(a) + nx * Math.sin(a), dy = by * Math.cos(a) + ny * Math.sin(a);
      const fn = fins[nf++];
      fn[0] = rx;
      fn[1] = ry;
      fn[2] = dx;
      fn[3] = dy;
      fn[4] = L * sc(k);
      fn[5] = Wd * sc(k);
      fn[6] = kind;
      fn[7] = D[k];
    };
    const flap = 0.25 * Math.sin(f.fin) * (0.5 + 0.5 * m);
    finAt(0.22, 1, 1.0 + flap, HW * 0.85, HW * 0.32, 0.78, 0);
    finAt(0.22, -1, 1.0 + flap, HW * 0.85, HW * 0.32, 0.78, 0);
    finAt(0.56, 1, 0.8 - flap * 0.5, HW * 0.5, HW * 0.22, 0.8, 0);
    finAt(0.56, -1, 0.8 - flap * 0.5, HW * 0.5, HW * 0.22, 0.8, 0);
    const wag = 0.22 * Math.sin(f.phase - 4.6) * (0.5 + 0.5 * m);
    finAt(1, 1, 0.36 + wag, LEN * f.tail, HW * 0.34, 0, 1);
    finAt(1, -1, 0.36 - wag, LEN * f.tail * 0.92, HW * 0.34, 0, 1);
    for (const fn of fins) {
      const tx = fn[0] + fn[2] * fn[4], ty = fn[1] + fn[3] * fn[4];
      minx = Math.min(minx, tx, fn[0]);
      maxx = Math.max(maxx, tx, fn[0]);
      miny = Math.min(miny, ty, fn[1]);
      maxy = Math.max(maxy, ty, fn[1]);
    }
    const pad = HW * 1.4 + C * 2;
    const c0 = Math.max(0, Math.floor((minx - pad) / CW)), c1 = Math.min(cols - 1, Math.floor((maxx + pad) / CW));
    const r0 = Math.max(0, Math.floor((miny - pad) / CH)), r1 = Math.min(rows - 1, Math.floor((maxy + pad) / CH));
    if (c0 > c1 || r0 > r1) return;

    // the spine in chunks of CHUNK segments, each with its bounding box: a cell skips every chunk that cannot hold
    // a nearer point than the best so far, and a cell beyond the reach of the body and its rim skips the spine
    const ck = this.chunk, nch = Math.ceil((N - 1) / CHUNK);
    for (let c = 0; c < nch; c++) {
      let ax = Infinity, ay = Infinity, bx = -Infinity, by = -Infinity;
      for (let i = c * CHUNK, e = Math.min(N - 1, i + CHUNK); i <= e; i++) {
        const x = P[i * 2], y = P[i * 2 + 1];
        if (x < ax) ax = x;
        if (x > bx) bx = x;
        if (y < ay) ay = y;
        if (y > by) by = y;
      }
      ck[c * 4] = ax;
      ck[c * 4 + 1] = ay;
      ck[c * 4 + 2] = bx;
      ck[c * 4 + 3] = by;
    }
    const reach = HW * 1.3 + C * 0.9 + 1;
    const reach2 = reach * reach;
    const lb = this.lb;

    // forward direction and eyes (at the front corners of the head)
    const fx0 = P[0] - P[4], fy0 = P[1] - P[5];
    const fl = Math.hypot(fx0, fy0) || 1;
    const fx = fx0 / fl, fy = fy0 / fl;
    const ke = 2;
    const hwe = HW * profile(ke / (N - 1)) * sc(ke);
    const eye = (side: number) => {
      const ex = P[ke * 2] - fy * side * hwe * 0.66 + fx * HW * 0.08, ey = P[ke * 2 + 1] + fx * side * hwe * 0.66 + fy * HW * 0.08;
      const c = Math.floor(ex / CW), r = Math.floor(ey / CH);
      return c >= 0 && r >= 0 && c < cols && r < rows ? r * cols + c : -1;
    };
    const eyeA = eye(1), eyeB = eye(-1);

    const dark = this.dark;
    const fade = (d: number) => 1 - (dark ? 0.74 : 0.78) * Math.min(1, d);
    const bg = this.bodyGlyphs, bgl = bg.length;
    const seed = f.seed;
    const sx = 3, sy = 2; // shadow offset in cells

    for (let row = r0; row <= r1; row++) {
      const cy = (row + 0.5) * CH;
      // only the cells of this row within reach of a chunk of the body or of a fin can hold anything
      let xa = Infinity, xb = -Infinity;
      for (let c = 0; c < nch; c++) {
        const o = c * 4;
        if (cy < ck[o + 1] - reach || cy > ck[o + 3] + reach) continue;
        if (ck[o] - reach < xa) xa = ck[o] - reach;
        if (ck[o + 2] + reach > xb) xb = ck[o + 2] + reach;
      }
      for (let k = 0; k < 6; k++) {
        const fn = fins[k], fw = fn[5] * 1.25 + 1;
        const tx = fn[0] + fn[2] * fn[4], ty = fn[1] + fn[3] * fn[4];
        if (cy < Math.min(fn[1], ty) - fw || cy > Math.max(fn[1], ty) + fw) continue;
        if (Math.min(fn[0], tx) - fw < xa) xa = Math.min(fn[0], tx) - fw;
        if (Math.max(fn[0], tx) + fw > xb) xb = Math.max(fn[0], tx) + fw;
      }
      if (xa > xb) continue;
      const ca = Math.max(c0, Math.floor(xa / CW)), cb = Math.min(c1, Math.floor(xb / CW));
      for (let col = ca; col <= cb; col++) {
        const cx = (col + 0.5) * CW;
        let lbMin = Infinity, cm = 0;
        for (let c = 0; c < nch; c++) {
          const o = c * 4;
          const ex = ck[o] - cx > 0 ? ck[o] - cx : cx - ck[o + 2] > 0 ? cx - ck[o + 2] : 0;
          const ey = ck[o + 1] - cy > 0 ? ck[o + 1] - cy : cy - ck[o + 3] > 0 ? cy - ck[o + 3] : 0;
          const v = ex * ex + ey * ey;
          lb[c] = v;
          if (v < lbMin) {
            lbMin = v;
            cm = c;
          }
        }
        const near = lbMin <= reach2;
        // nearest point on the spine (the first segment of the nearest, as a plain scan would find)
        let best = Infinity, bi = 0, bt = 0, bdx = 0, bdy = 0;
        if (near) {
          for (let k = -1; k < nch; k++) {
            const c = k < 0 ? cm : k;
            if ((k >= 0 && c === cm) || lb[c] > best) continue;
            for (let i = c * CHUNK, e = Math.min(N - 1, i + CHUNK); i < e; i++) {
              const o = i * 5;
              const px = cx - sg[o], py = cy - sg[o + 1];
              let t = (px * sg[o + 2] + py * sg[o + 3]) * sg[o + 4];
              t = t < 0 ? 0 : t > 1 ? 1 : t;
              const dx = px - sg[o + 2] * t, dy = py - sg[o + 3] * t;
              const d2 = dx * dx + dy * dy;
              if (d2 < best || (d2 === best && i < bi)) {
                best = d2;
                bi = i;
                bt = t;
                bdx = dx;
                bdy = dy;
              }
            }
          }
        }
        const dist = Math.sqrt(best);
        const u = (bi + bt) / (N - 1);
        let d = near ? D[bi] + (D[bi + 1] - D[bi]) * bt : 0;
        const scu = 1 + 0.3 * d;
        const hwu = HW * profile(u) * scu;
        const idx = row * cols + col;
        const glyphs = d < 0.42;
        let key = -1;
        let alpha = 1;
        let body = false;

        if (near && (idx === eyeA || idx === eyeB) && d < 0.9) {
          key = ((S_EYE * 4 + 1) * 64) + G_O;
          d = D[ke];
        } else if (dist <= hwu) {
          const o = bi * 5;
          const side = sg[o + 2] * bdy - sg[o + 3] * bdx > 0 ? 1 : -1;
          const v = (side * dist) / hwu;
          const lu = Math.round((u * LEN) / C), lv = Math.round((side * dist) / (C * scu));
          const h1 = hash3(seed, lu, lv), h2 = hash3(seed + 1, lu, lv), h3 = hash3(seed + 2, lv, lu);
          let slot = f.base;
          for (const s of f.spots) {
            const e = ((u - s.u) / s.ru) ** 2 + ((v - s.v) / s.rv) ** 2;
            if (e < 1 + (h2 - 0.5) * 0.8) slot = s.c;
          }
          if (slot === S_ORANGE && h3 < 0.06) slot = S_RED;
          else if (h3 > 1 - f.sumi) slot = S_NAVY;
          const edge = Math.abs(v) > 0.86 || u > 0.94;
          const jit = edge ? 0 : h1 < 0.3 ? 0 : h1 < 0.78 ? 1 : 2;
          const g = !glyphs ? G_NONE : edge && h2 < 0.3 ? G_DOT : bg[Math.floor(h1 * 7919) % bgl];
          key = (slot * 4 + jit) * 64 + g;
          body = true;
        } else {
          // fins and tail
          let hit = -1;
          for (let k = 0; k < fins.length; k++) {
            const fn = fins[k];
            const qx = cx - fn[0], qy = cy - fn[1];
            const a = qx * fn[2] + qy * fn[3];
            const L = fn[4];
            if (a < 0 || a > L) continue;
            const b = Math.abs(-qx * fn[3] + qy * fn[2]);
            const s = a / L;
            // tail lobes fan out from a narrow root to a broad, slightly ragged edge; side fins are paddles
            const half = fn[6] === 1 ? fn[5] * (0.45 + 0.75 * Math.sin(Math.PI * 0.5 * Math.min(1, s * 1.3)) - 0.2 * s) : fn[5] * Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.9 + 0.1)), 0.6);
            if (b <= half) {
              hit = k;
              break;
            }
          }
          if (hit >= 0) {
            d = fins[hit][7];
            const h = hash3(seed + 3, col, row);
            key = (S_FIN * 4 + (h < 0.5 ? 0 : 1)) * 64 + (d < 0.42 && h < 0.4 ? G_DOT : G_NONE);
            alpha = 0.95;
          } else if (dist <= hwu + C * 0.9 && u < 0.95) {
            const h = hash3(seed + 4, col, row);
            const hr = hash3(seed + 5, col, row);
            if (hr < 0.93) key = (S_RIM * 4 + (h < 0.5 ? 0 : 1)) * 64 + (glyphs && hr < 0.2 ? G_DOT : G_NONE);
          }
        }
        if (key < 0) continue;
        alpha *= fade(d);
        if (q[idx]) alpha *= 0.1;
        this.pushOp(idx, key, alpha);
        this.own[idx] = stamp;
        this.occAny[idx] = F;
        if (d < 0.45) this.occTop[idx] = F;
        if (body && d < 0.4) {
          const sr = row + sy, scl = col + sx;
          if (sr < rows && scl < cols) {
            const si = sr * cols + scl;
            const sa = 0.9 * (1 - d / 0.4);
            if (this.shS[si] !== F) {
              this.shS[si] = F;
              this.shA[si] = sa;
              this.shList.push(si);
            } else if (sa > this.shA[si]) this.shA[si] = sa;
          }
        }
      }
    }

    // barbels: two short strokes on each side of the snout, angled outward
    const dHead = D[0];
    if (dHead < 0.6) {
      const cap = HW * profile(0) * sc(0);
      for (const side of [-1, 1]) {
        const ang = 0.55 * side;
        const wx = fx * Math.cos(ang) - fy * Math.sin(ang), wy = fx * Math.sin(ang) + fy * Math.cos(ang);
        const st = strokeFor(wx, wy);
        const ox = P[0] + fx * cap * 0.7 - fy * side * HW * 0.3, oy = P[1] + fy * cap * 0.7 + fx * side * HW * 0.3;
        for (let j = 0; j < 2; j++) {
          const dd = C * (0.9 + j);
          const c = Math.floor((ox + wx * dd) / CW), r = Math.floor((oy + wy * dd) / CH);
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          const idx = r * cols + c;
          if (this.own[idx] === stamp || this.occAny[idx] === F) continue;
          this.own[idx] = stamp;
          this.pushOp(idx, TEXT_KEY + T_WHISKER * 64 + st, fade(dHead) * (j === 0 ? 1 : 0.8) * (q[idx] ? 0.1 : 1));
        }
      }
    }
  }
}
