// Draws the carrier scene on stacked 2D canvases: an orthographic view of the ship model (model.ts)
// that the drag turns about a deck point.
//   sea:  the water, its faint marks, the wake and the shadows on the water, every frame. It covers the
//         page, so it has one canvas px per page px (the marks and shadows are soft-edged anyway);
//   ship: the hull, its shadow, the bow wave, the deck, the island and the parked jets, at full
//         resolution. They do not change from frame to frame, so this canvas (sized to the ship) is
//         only redrawn when the view turns, resizes or the colours change. While the ship spins fast it
//         is drawn on the sea canvas instead, with what moves on its deck, and this one is hidden;
//   fx:   a box of small canvases, one for each thing that moves on or over the ship (the far lift,
//         the blast deflector, the wire, each jet, shadows on the deck, the smoke, the helicopter).
//         Each is only as big as what it shows, is moved with a transform, and is redrawn only when
//         what it shows changes.
// A few hundred paths a frame, no filters.

import {
  BAND, CAMERA, CYCLE, DECK, DEFLECTORS, FAR_LIFT, HD, HULL, ISLAND, JET_BODY, JET_CANOPY, JET_FIN,
  JET_STAB, JET_W, JET_WING, LIFE, WL, BOW_FROM, LIFT_JET, LIGHTS, MARK_DASHES, MARK_LINES, MAST, NEAR_LIFT,
  NUMBER, PANEL, PARKED, RADOMES, SPONSONS, SUN, WHIPS, WIRE, heliAt, jbdAt, jetAt, liftAt, puffs,
  type Box, type JetPose, type V2, type V3,
} from "./model";

export type CarrierColors = {
  sea: string; // the water (the page background)
  seaMark: string; // the little wave marks on the sea
  wake: string;
  shadow: string; // the ship's shadow on the water
  hull: string;
  hullLit: string; // the strip under the knuckle
  flare: string; // the flared bow, in its own shade
  band: string; // deck-edge band
  deck: string;
  island: string; // island faces toward the viewer
  islandSide: string;
  islandTop: string;
  jet: string;
  line: string; // outlines
  mark: string; // deck markings
  smoke: string;
  flame: string;
  flameCore: string;
};

// the recorded (dark) look
export const CARRIER_DARK: CarrierColors = {
  sea: "#212121",
  seaMark: "#2b2b2b",
  wake: "#2f2f2f",
  shadow: "#181818",
  hull: "#1c1c1c",
  hullLit: "#2a2a2a",
  flare: "#101010",
  band: "#161616",
  deck: "#1a1a1a",
  island: "#181818",
  islandSide: "#121212",
  islandTop: "#1e1e1e",
  jet: "#1a1a1a",
  line: "#7a7a7a",
  mark: "#454545",
  smoke: "#5a5a5a",
  flame: "#e0742a",
  flameCore: "#ffc27a",
};
export const CARRIER_KEYS = Object.keys(CARRIER_DARK) as (keyof CarrierColors)[];

type RGBA = [number, number, number, number];
type Pal = Record<keyof CarrierColors, RGBA>;
function parse(c: string): RGBA {
  const s = c.trim();
  if (s[0] === "#") {
    const h = s.length === 4 ? s.slice(1).split("").map((d) => d + d).join("") : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = s.match(/[\d.]+/g);
  if (!m) return [0, 0, 0, 1];
  return [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1];
}
const css = (c: RGBA) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;

// sea: page-sized canvas; ship: a canvas the scene sizes and places over the ship (z-index above the
// sea); still (optional): one more like it, which shows a copy of the ship while it does not change
// (an image canvas costs nothing a frame, a 2D canvas is copied to the compositor every frame);
// fx: a box over the page for the small canvases
export type CarrierLayers = { sea: HTMLCanvasElement; ship: HTMLCanvasElement; still?: HTMLCanvasElement; fx: HTMLElement };

// a small canvas in the fx box, sized to what it shows and placed with a transform
class Layer {
  readonly cv: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  key = "";
  private bw = 0;
  private bh = 0;
  private ox = NaN;
  private oy = NaN;
  private shown = true;
  constructor(parent: HTMLElement, z: number) {
    const cv = document.createElement("canvas");
    const st = cv.style;
    st.position = "absolute";
    st.left = "0";
    st.top = "0";
    st.display = "block";
    st.pointerEvents = "none";
    st.transformOrigin = "0 0";
    st.zIndex = String(z);
    cv.setAttribute("aria-hidden", "true");
    parent.appendChild(cv);
    this.cv = cv;
    this.ctx = cv.getContext("2d")!;
  }
  // clear and place the canvas over the device-px box; the context then draws in page device px
  open(x0: number, y0: number, x1: number, y1: number, dpr: number) {
    x0 = Math.floor(x0);
    y0 = Math.floor(y0);
    const w = Math.max(1, Math.ceil(x1) - x0), h = Math.max(1, Math.ceil(y1) - y0);
    const st = this.cv.style;
    if (w > this.bw || h > this.bh || w < this.bw * 0.4 || h < this.bh * 0.4) {
      // room to grow before the canvas has to be reallocated (boxes change shape as the ship turns)
      this.bw = Math.ceil(w * 1.25) + 24;
      this.bh = Math.ceil(h * 1.25) + 24;
      this.cv.width = this.bw;
      this.cv.height = this.bh;
      st.width = `${this.bw / dpr}px`;
      st.height = `${this.bh / dpr}px`;
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.bw, this.bh);
    }
    if (x0 !== this.ox || y0 !== this.oy) {
      this.ox = x0;
      this.oy = y0;
      st.transform = `translate(${x0 / dpr}px,${y0 / dpr}px)`;
    }
    this.show(true);
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, -x0, -y0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.lineJoin = "round";
    c.lineCap = "round";
    return c;
  }
  show(on: boolean) {
    if (on !== this.shown) {
      this.shown = on;
      this.cv.style.display = on ? "block" : "none";
    }
    if (!on) this.key = "";
  }
  get box(): [number, number] {
    return [this.ox, this.oy];
  }
  setZ(z: number) {
    const v = String(z);
    if (this.cv.style.zIndex !== v) this.cv.style.zIndex = v;
  }
  remove() {
    this.cv.remove();
  }
}

// stage → page placement: page px = (x0 + k·stage x, y0 + k·stage y)
export type Placement = { x0: number; y0: number; k: number };

const TAU = Math.PI * 2;
// the sea marks drift aft this fast (ship units a frame)
const SEA_DRIFT = 0.043;
const SEA_MARKS = 260;
// the sea canvas has one canvas px per page px, and at most SEA_PX
const SEA_PX = 4e6;
// the drag's turn is applied in steps of at least TURN_STEP rad (and exactly once it stops). While it
// turns (and for a few frames after) the ship is drawn on the sea, at page resolution
const TURN_STEP = 0.0015;
// the wake: from the stern to well off the page, between a far and a near edge
const WAKE_X0 = -48.6, WAKE_X1 = -200;
const wakeFar = (x: number) => 0.75 + 0.09 * (x - WAKE_X0);
const wakeNear = (x: number) => 9.4 - 0.065 * (x - WAKE_X0);
// the bow wave: starts at the stem (x, y) on the waterline, runs aft at an angle (rad) for a length
const BOW_WAVE = [45.6, 3.9, (19.8 * Math.PI) / 180, 66] as const;

// deterministic noise for the sea marks
function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// helicopter pod outline (top view, u forward)
const POD: number[][] = [
  [1.45, 0], [1.25, 0.42], [0.6, 0.62], [-0.6, 0.6], [-1.25, 0.35], [-1.35, 0], [-1.25, -0.35], [-0.6, -0.6],
  [0.6, -0.62], [1.25, -0.42],
];
const POD_TOP: number[][] = [[0.7, 0], [0.45, 0.3], [-0.6, 0.3], [-0.85, 0], [-0.6, -0.3], [0.45, -0.3]];

export class CarrierScene {
  private seaCv: HTMLCanvasElement;
  private sea2d: CanvasRenderingContext2D;
  private seaQ = 1; // sea canvas px per device px (one per page px)
  private seaX = 1; // its actual scale on each axis
  private seaY = 1;
  private shipCv: HTMLCanvasElement;
  private L: Record<
    "lift" | "jbd" | "wire" | "jetA" | "jetB" | "shA" | "shB" | "smoke" | "heliSh" | "heli",
    Layer
  >;
  private ver = 0; // counts redraws of the ship, so the fx layers know to redraw too
  private shipDpr = 0;
  private still: HTMLCanvasElement | null = null;
  private stillCtx: ImageBitmapRenderingContext | null = null;
  private shipMode = 1; // 0 hidden (spinning: drawn on the sea), 1 the 2D canvas, 2 its still copy
  private age = 0; // frames since the ship canvas was redrawn
  private xfade = false; // a colour change shown by fading the still copy (old colours) off the canvas (new ones)
  private xnew = false; // the canvas still has to be drawn in the new colours
  private calm = 99; // frames since the ship last turned fast
  private pend = 0; // the turn asked for
  private lastPend = 0;
  private ema = 1 / 60; // smoothed frame time (s)
  private slowFor = 0; // frames left to draw the sea and the ship every other frame
  private tick = 0;
  private dpr = 1;
  private w = 0; // page size in device px
  private h = 0;
  private place: Placement = { x0: 0, y0: 0, k: 1 };
  private turn = 0; // drag turn (rad)
  private colors: Pal;
  private from: Pal | null = null;
  private to: Pal | null = null;
  private fadeT = 1;
  private fadeDur = 0.4;
  private c: Record<keyof CarrierColors, string>;
  // projection
  private K = 1;
  private OX = 0;
  private OY = 0;
  private cs = 1;
  private sn = 0;
  private SA = Math.sin(CAMERA.pitch);
  private CA = Math.cos(CAMERA.pitch);
  private sun: V2 = SUN;
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private dirty = true;
  private puffBuf: number[][] = [];
  private markBuf = new Float64Array(SEA_MARKS * 8);
  private markLv = new Uint8Array(SEA_MARKS);
  private lw = 1;

  constructor(layers: CarrierLayers, colors: CarrierColors = CARRIER_DARK) {
    this.shipCv = layers.ship;
    if (layers.still && typeof OffscreenCanvas !== "undefined") {
      this.still = layers.still;
      this.stillCtx = layers.still.getContext("bitmaprenderer");
      layers.still.style.display = "none";
    }
    this.seaCv = layers.sea;
    // the sea is opaque: it covers the page, so nothing under it has to be composited
    const a = this.seaCv.getContext("2d", { alpha: false });
    if (!a) throw new Error("2d canvas unavailable");
    this.sea2d = a;
    // stacking (over the ship's z 1): the lift, deflector, wire and deck shadows, the jets (re-ordered
    // by depth), smoke, the helicopter
    const fx = layers.fx;
    this.L = {
      lift: new Layer(fx, 1), jbd: new Layer(fx, 2), wire: new Layer(fx, 3), shA: new Layer(fx, 3), shB: new Layer(fx, 3),
      jetA: new Layer(fx, 4), jetB: new Layer(fx, 5), smoke: new Layer(fx, 6), heliSh: new Layer(fx, 7), heli: new Layer(fx, 9),
    };
    this.colors = this.parseAll(colors);
    this.c = this.cssAll(this.colors);
  }

  private parseAll(c: CarrierColors) {
    const o = {} as Pal;
    for (const k of CARRIER_KEYS) o[k] = parse(c[k] ?? CARRIER_DARK[k]);
    return o;
  }
  private cssAll(c: Pal) {
    const o = {} as Record<keyof CarrierColors, string>;
    for (const k of CARRIER_KEYS) o[k] = css(c[k]);
    return o;
  }

  // canvas size in page px and its pixel ratio; where the 1194 × 1140 stage sits on the page
  resize(width: number, height: number, dpr: number, place: Placement) {
    const W = Math.max(1, Math.round(width * dpr)), H = Math.max(1, Math.round(height * dpr));
    this.seaQ = Math.min(1 / dpr, Math.sqrt(SEA_PX / (W * H)));
    this.w = W;
    this.h = H;
    this.sizeSea(1);
    this.dpr = dpr;
    this.place = place;
    this.dirty = true;
  }

  // colours change over `seconds` (0 = at once)
  setColors(colors: CarrierColors, seconds = 0) {
    const next = this.parseAll(colors);
    if (seconds <= 0) {
      this.colors = next;
      this.c = this.cssAll(next);
      this.to = null;
      this.dirty = true;
      return;
    }
    this.from = { ...this.colors };
    this.to = next;
    this.fadeT = 0;
    this.fadeDur = seconds;
    // the ship (a few hundred paths at full resolution) is not redrawn every frame of the fade: a still
    // copy in the old colours fades off the canvas drawn once in the new ones
    if (this.stillCtx && !this.dirty && !this.xfade && this.shipMode !== 0) {
      if (this.shipMode === 1) this.freeze();
      if (this.shipMode === 2) this.xfade = this.xnew = true;
    }
  }

  // the sea canvas at k times its resolution
  private sizeSea(k: number) {
    const sw = Math.max(1, Math.round(this.w * this.seaQ * k)), sh = Math.max(1, Math.round(this.h * this.seaQ * k));
    if (sw !== this.seaCv.width || sh !== this.seaCv.height) {
      this.seaCv.width = sw;
      this.seaCv.height = sh;
    }
    this.seaX = sw / this.w;
    this.seaY = sh / this.h;
  }

  setTurn(rad: number) {
    this.pend = rad;
  }

  private setup() {
    const { k, x0, y0 } = this.place;
    const yaw = CAMERA.yaw + this.turn;
    this.cs = Math.cos(yaw);
    this.sn = Math.sin(yaw);
    this.K = CAMERA.scale * k * this.dpr;
    this.OX = (x0 + k * CAMERA.pivotAt[0]) * this.dpr;
    this.OY = (y0 + k * CAMERA.pivotAt[1]) * this.dpr;
    // the sun stays put while the ship turns under it
    const a = -this.turn;
    this.sun = [SUN[0] * Math.cos(a) - SUN[1] * Math.sin(a), SUN[0] * Math.sin(a) + SUN[1] * Math.cos(a)];
    // outlines: 1 page px, thicker only when the stage is drawn larger than recorded
    this.lw = Math.max(1, k) * this.dpr;
  }

  // ship point → canvas px
  private X(x: number, y: number) {
    return this.OX + this.K * ((x - CAMERA.pivot[0]) * this.cs - (y - CAMERA.pivot[1]) * this.sn);
  }
  private Y(x: number, y: number, z: number) {
    return this.OY - this.K * (((x - CAMERA.pivot[0]) * this.sn + (y - CAMERA.pivot[1]) * this.cs) * this.SA + (z - HD) * this.CA);
  }
  // device-px box around ship points, grown by `pad` ship units and the line width
  private boxOf(pts: readonly V3[], pad: number): [number, number, number, number] {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const sx = this.X(p[0], p[1]), sy = this.Y(p[0], p[1], p[2]);
      if (sx < x0) x0 = sx;
      if (sx > x1) x1 = sx;
      if (sy < y0) y0 = sy;
      if (sy > y1) y1 = sy;
    }
    const m = pad * this.K + 2 * this.lw + 2;
    return [x0 - m, y0 - m, x1 + m, y1 + m];
  }
  // the layer over box b (clipped to the page), or null (and hidden) when none of it is on the page
  private open(l: Layer, b: [number, number, number, number]) {
    const x0 = Math.max(0, b[0]), y0 = Math.max(0, b[1]), x1 = Math.min(this.w, b[2]), y1 = Math.min(this.h, b[3]);
    if (x1 <= x0 || y1 <= y0) {
      l.show(false);
      return null;
    }
    const c = l.open(x0, y0, x1, y1, this.dpr);
    c.lineWidth = this.lw;
    return c;
  }
  /** stop drawing and remove the fx canvases */
  destroy() {
    for (const l of Object.values(this.L)) l.remove();
  }

  // larger = farther from the viewer
  private depth(x: number, y: number) {
    return x * this.sn + y * this.cs;
  }

  private path(ctx: CanvasRenderingContext2D, pts: readonly V3[], close = true) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const sx = this.X(p[0], p[1]), sy = this.Y(p[0], p[1], p[2]);
      if (i) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    }
    if (close) ctx.closePath();
  }
  // a closed ring of deck-plane points at height z, shifted by (dx, dy)
  private ring(ctx: CanvasRenderingContext2D, pts: readonly V2[], z: number, fill: string | null, stroke: string | null, dx = 0, dy = 0) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0] + dx, y = pts[i][1] + dy;
      const sx = this.X(x, y), sy = this.Y(x, y, z);
      if (i) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  private poly(ctx: CanvasRenderingContext2D, pts: readonly V3[], fill: string | null, stroke: string | null) {
    this.path(ctx, pts);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  private line(ctx: CanvasRenderingContext2D, a: V3, b: V3) {
    ctx.moveTo(this.X(a[0], a[1]), this.Y(a[0], a[1], a[2]));
    ctx.lineTo(this.X(b[0], b[1]), this.Y(b[0], b[1], b[2]));
  }

  // ------------------------------------------------------------------ static layers
  private bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x: number, y: number, z: number) => {
      const sx = this.X(x, y), sy = this.Y(x, y, z);
      if (sx < x0) x0 = sx;
      if (sx > x1) x1 = sx;
      if (sy < y0) y0 = sy;
      if (sy > y1) y1 = sy;
    };
    for (const [x, y] of DECK) {
      add(x, y, HD + 3);
      add(x, y, WL);
      add(x + this.sun[0] * (HD - WL), y + this.sun[1] * (HD - WL), WL);
    }
    for (const p of [...SPONSONS, NEAR_LIFT, FAR_LIFT]) for (const [x, y] of p) {
      add(x, y, HD + 3);
      add(x, y, 0);
    }
    add(MAST.at[0], MAST.at[1], MAST.pole + 0.5);
    const [wx, wy, wa, wl] = BOW_WAVE;
    add(wx - Math.cos(wa) * wl, wy + Math.sin(wa) * wl, WL);
    const m = 24 * this.dpr;
    const bx = Math.max(0, Math.floor(x0 - m)), by = Math.max(0, Math.floor(y0 - m));
    const bw = Math.min(this.w, Math.ceil(x1 + m)) - bx, bh = Math.min(this.h, Math.ceil(y1 + m)) - by;
    this.box = { x: bx, y: by, w: Math.max(1, bw), h: Math.max(1, bh) };
  }

  // the ship canvas, cleared, over the ship's box; it draws in page device px
  private prepare(cv: HTMLCanvasElement) {
    this.bounds();
    const { w, h } = this.box;
    // reallocate only when the ship outgrows the canvas (or shrinks well inside it): turning changes the box
    const fresh = w > cv.width || h > cv.height || w < cv.width * 0.6 || h < cv.height * 0.6;
    if (fresh) {
      cv.width = Math.ceil(w * 1.04) + 32;
      cv.height = Math.ceil(h * 1.04) + 32;
    }
    const st = cv.style, d = this.dpr;
    if (fresh || this.shipDpr !== d) {
      this.shipDpr = d;
      st.width = `${cv.width / d}px`;
      st.height = `${cv.height / d}px`;
    }
    st.transform = `translate(${this.box.x / d}px,${this.box.y / d}px)`;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(1, 0, 0, 1, -this.box.x, -this.box.y);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = this.lw;
    return ctx;
  }

  // the ship. fold: while it spins (drawn on the sea), also the lift, the deflector, the wire and the
  // jets on the deck at frame f, which have their own layers otherwise
  private drawShip(ctx: CanvasRenderingContext2D, fold: { f: number; A: JetPose; B: JetPose } | null = null) {
    const c = this.c;
    ctx.lineWidth = this.lw;
    // ---- below the flight deck: shadow on the water, hull, deck-edge band, bow wave
    const [gx, gy] = this.sun;
    const sh = HD - WL;
    this.ring(ctx, DECK, WL, c.shadow, null, gx * sh, gy * sh);
    this.ring(ctx, NEAR_LIFT, WL, c.shadow, null, gx * sh, gy * sh);
    for (const p of SPONSONS) this.ring(ctx, p, WL, c.shadow, null, gx * sh, gy * sh);
    // hull faces that look toward the viewer, far ones first: the deck-edge band, the flare (or the
    // side, aft), a lit strip under the bow knuckle, the lower hull
    let area = 0;
    for (let i = 0; i < HULL.length; i++) {
      const p = HULL[i][0], q = HULL[(i + 1) % HULL.length][0];
      area += p[0] * q[1] - q[0] * p[1];
    }
    const sgn = area > 0 ? 1 : -1;
    const V: V3 = [-this.sn * this.CA, -this.cs * this.CA, this.SA]; // toward the viewer
    const faces: [number, V3[], string, number][] = [];
    const lerp = (p: V3, q: V3, t: number): V3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
    const face = (q: V3[], col: string, kind: number) => {
      // outward 3D normal from the quad's diagonals, turned outward with the ring's orientation
      const [a0, a1, a2, a3] = q;
      const ux = a2[0] - a0[0], uy = a2[1] - a0[1], uz = a2[2] - a0[2];
      const vx = a3[0] - a1[0], vy = a3[1] - a1[1], vz = a3[2] - a1[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const ox = sgn * (a1[1] - a0[1]), oy = -sgn * (a1[0] - a0[0]); // horizontal outward
      if (nx * ox + ny * oy < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      if (nx * V[0] + ny * V[1] + nz * V[2] <= 1e-6) return;
      faces.push([this.depth((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2), q, col, kind]);
    };
    for (let i = 0; i < HULL.length; i++) {
      const [ta, ba, ka, wa] = HULL[i], [tb, bb, kb, wb] = HULL[(i + 1) % HULL.length];
      const bow = ta[0] >= BOW_FROM && tb[0] >= BOW_FROM;
      face([ta, tb, bb, ba], c.band, 0);
      face([ba, bb, kb, ka], c.flare, 1);
      if (bow) {
        const sa = lerp(ka, wa, 0.3), sb = lerp(kb, wb, 0.3);
        face([ka, kb, sb, sa], c.hullLit, 2);
        face([sa, sb, wb, wa], c.hull, 3);
      } else face([ka, kb, wb, wa], c.shadow, 3);
    }
    faces.sort((p, q) => q[0] - p[0] || p[3] - q[3]);
    for (const [, q, col] of faces) {
      this.poly(ctx, q, col, null);
      ctx.strokeStyle = col;
      ctx.stroke();
    }
    // lines: the band's lower edge, the bow knuckle, the transom and the stern corners
    ctx.strokeStyle = c.line;
    ctx.beginPath();
    for (const [, q, , kind] of faces) {
      const bow = q[0][0] >= BOW_FROM && q[1][0] >= BOW_FROM;
      const stern = q[0][0] < -35 && q[1][0] < -35;
      if (kind === 0) this.line(ctx, q[3], q[2]);
      if (kind === 1 && (bow || stern)) this.line(ctx, q[3], q[2]);
      if (stern && kind === 1) {
        this.line(ctx, q[0], q[3]);
        this.line(ctx, q[1], q[2]);
      }
    }
    ctx.stroke();
    // foam where the bow meets the sea
    ctx.strokeStyle = c.mark;
    ctx.beginPath();
    for (const [, q, , kind] of faces) if (kind === 3 && q[0][0] >= BOW_FROM && q[1][0] >= BOW_FROM) this.line(ctx, q[3], q[2]);
    ctx.stroke();
    // sponsons' bands
    for (const p of SPONSONS) this.band(ctx, p, HD, c.band);
    this.bowWave(ctx);
    // a lowered far lift sits under the deck edge
    const liftDown = fold !== null && liftAt(fold.f) <= -0.15;
    if (fold && liftDown) this.farLift(ctx, fold.f);

    // ---- the flight deck and everything on it
    for (const p of SPONSONS) this.ring(ctx, p, HD, c.deck, c.line);
    this.ring(ctx, DECK, HD, c.deck, c.line);
    this.markings(ctx);
    // near lift with its own band
    this.band(ctx, NEAR_LIFT, HD, c.band);
    this.ring(ctx, NEAR_LIFT, HD, c.deck, c.line);
    // whip antennas over the near edge
    ctx.strokeStyle = c.line;
    ctx.beginPath();
    for (const [x, y] of WHIPS) this.line(ctx, [x, y, HD - 1.3], [x, y, HD + 1.3]);
    ctx.stroke();
    // shadows of the island and the jets on the deck
    ctx.fillStyle = c.shadow;
    ctx.globalAlpha = 0.75;
    for (const b of ISLAND) this.boxShadow(ctx, b);
    ctx.globalAlpha = 0.6;
    for (const [x, y, h] of PARKED) this.jetShadow(ctx, x, y, HD, (h * Math.PI) / 180);
    ctx.globalAlpha = 1;
    // island and parked jets, far to near
    const items: [number, () => void][] = [];
    const ic = (ISLAND[0][0] + ISLAND[0][1]) / 2, iy = (ISLAND[0][2] + ISLAND[0][3]) / 2;
    items.push([this.depth(ic, iy), () => this.island(ctx)]);
    for (const [x, y, h] of PARKED)
      items.push([this.depth(x, y), () => this.jet(ctx, { p: [x, y, HD], h: (h * Math.PI) / 180, bank: 0, air: false, flame: 0, hook: null, wire: 1 })]);
    items.sort((a, b) => b[0] - a[0]);
    for (const [, f] of items) f();
    if (fold) this.foldTop(ctx, fold.f, fold.A, fold.B, liftDown);
  }

  // what the fx layers lift, jbd, wire, shA/shB (on the deck) and the jets on the deck show, in their order
  private foldTop(ctx: CanvasRenderingContext2D, f: number, A: JetPose, B: JetPose, liftDown: boolean) {
    const c = this.c;
    if (!liftDown) this.farLift(ctx, f);
    this.deflector(ctx, f);
    this.wire(ctx, A);
    const gx = this.sun[0], gy = this.sun[1];
    ctx.fillStyle = c.shadow;
    ctx.globalAlpha = 0.7;
    for (const j of [A, B]) {
      if (!j.air) continue;
      const x = j.p[0], y = j.p[1], z = j.p[2];
      if (this.onDeck(x + gx * (z - HD), y + gy * (z - HD))) this.jetShadow(ctx, x + gx * (z - HD), y + gy * (z - HD), HD, j.h);
    }
    const far = this.depth(A.p[0], A.p[1]) < this.depth(B.p[0], B.p[1]) ? B : A;
    for (const j of far === A ? [A, B] : [B, A]) {
      if (j.air) continue;
      ctx.fillStyle = c.shadow;
      ctx.globalAlpha = 0.6;
      this.jetShadow(ctx, j.p[0], j.p[1], HD, j.h);
      ctx.globalAlpha = 1;
      this.jet(ctx, j);
    }
    ctx.globalAlpha = 1;
  }

  private band(ctx: CanvasRenderingContext2D, ring: readonly V2[], z: number, fill: string) {
    const n = ring.length;
    // ring orientation (shoelace) decides which way is out
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const sgn = area > 0 ? 1 : -1;
    const quads: [number, V3[]][] = [];
    for (let i = 0; i < n; i++) {
      const ax = ring[i][0], ay = ring[i][1], bx = ring[(i + 1) % n][0], by = ring[(i + 1) % n][1];
      const nx = sgn * (by - ay), ny = -sgn * (bx - ax);
      if (nx * this.sn + ny * this.cs >= 0) continue;
      quads.push([this.depth((ax + bx) / 2, (ay + by) / 2), [[ax, ay, z], [bx, by, z], [bx, by, z - BAND], [ax, ay, z - BAND]]]);
    }
    quads.sort((a, b) => b[0] - a[0]);
    for (const [, q] of quads) {
      this.poly(ctx, q, fill, null);
      ctx.strokeStyle = fill;
      ctx.stroke();
    }
    ctx.strokeStyle = this.c.line;
    ctx.beginPath();
    for (const [, q] of quads) this.line(ctx, q[3], q[2]);
    ctx.stroke();
  }

  private markings(ctx: CanvasRenderingContext2D) {
    const c = this.c;
    ctx.strokeStyle = c.mark;
    ctx.beginPath();
    for (const [a, b] of MARK_LINES) this.line(ctx, [a[0], a[1], HD], [b[0], b[1], HD]);
    ctx.stroke();
    // dashed centre line of the landing area
    ctx.beginPath();
    for (const [a, b] of MARK_DASHES) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      for (let s = 0; s < L; s += 3.0) {
        const e = Math.min(L, s + 1.6);
        this.line(ctx, [a[0] + ux * s, a[1] + uy * s, HD], [a[0] + ux * e, a[1] + uy * e, HD]);
      }
    }
    ctx.stroke();
    // the waist catapult's blast deflector, flat (the bow one moves: deflector() each frame)
    {
      const [x0, x1, y0, y1] = DEFLECTORS[1];
      this.poly(ctx, [[x0, y0, HD], [x1, y0, HD], [x1, y1, HD], [x0, y1, HD]], null, c.mark);
      this.poly(ctx, [[x0 + 0.3, y0 + 0.3, HD], [x1 - 0.3, y0 + 0.3, HD], [x1 - 0.3, y1 - 0.3, HD], [x0 + 0.3, y1 - 0.3, HD]], null, c.mark);
    }
    // deck lights
    ctx.fillStyle = c.mark;
    for (const [x, y] of LIGHTS) {
      ctx.beginPath();
      ctx.ellipse(this.X(x, y), this.Y(x, y, HD), 0.17 * this.K, 0.3 * this.K, 0, 0, TAU);
      ctx.fill();
    }
    // the hull number, painted on the deck (affine map from the deck plane to the canvas)
    const [nx, ny] = NUMBER.at;
    const ox = this.X(nx, ny), oy = this.Y(nx, ny, HD);
    // text x runs toward the stern, text y toward the near side
    const ax = this.X(nx - 1, ny) - ox, ay = this.Y(nx - 1, ny, HD) - oy;
    const bx = this.X(nx, ny + 1) - ox, by = this.Y(nx, ny + 1, HD) - oy;
    ctx.save();
    ctx.transform(ax, ay, bx, by, ox, oy);
    ctx.font = `600 ${NUMBER.size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = c.mark;
    ctx.fillText(NUMBER.text, 0, 0);
    ctx.restore();
  }

  private boxShadow(ctx: CanvasRenderingContext2D, b: Box) {
    const [x0, x1, y0, y1, , z1] = b;
    const hgt = z1 - HD;
    const [gx, gy] = this.sun;
    const corners: V2[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    this.fillHull(ctx, [...corners, ...corners.map(([x, y]) => [x + gx * hgt, y + gy * hgt] as V2)], HD);
  }

  // fill the convex hull of deck-plane points
  private fillHull(ctx: CanvasRenderingContext2D, pts: V2[], z: number) {
    const p = pts.map(([x, y]) => [this.X(x, y), this.Y(x, y, z)] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: number[][] = [], upper: number[][] = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    const h = lower.slice(0, -1).concat(upper.slice(0, -1));
    ctx.beginPath();
    h.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }

  private boxFaces(ctx: CanvasRenderingContext2D, b: Box) {
    const [x0, x1, y0, y1, z0, z1] = b;
    const c = this.c;
    const side = (nx: number, ny: number, q: V3[], col: string) => {
      if (nx * this.sn + ny * this.cs < 0) this.poly(ctx, q, col, c.line);
    };
    side(-1, 0, [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], c.islandSide);
    side(1, 0, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], c.islandSide);
    side(0, 1, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c.island);
    side(0, -1, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], c.island);
    this.poly(ctx, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], c.islandTop, c.line);
  }

  private island(ctx: CanvasRenderingContext2D) {
    const c = this.c;
    for (const b of ISLAND) this.boxFaces(ctx, b);
    // window band on the bridge level
    const b = ISLAND[1];
    ctx.strokeStyle = c.line;
    ctx.beginPath();
    const wz = b[4] + (b[5] - b[4]) * 0.62;
    if (this.cs < 0) this.line(ctx, [b[0], b[3], wz], [b[1], b[3], wz]);
    if (this.sn > 0) this.line(ctx, [b[0], b[2], wz], [b[0], b[3], wz]);
    ctx.stroke();
    // radar panel
    this.poly(ctx, PANEL, c.islandSide, c.line);
    // radomes
    for (const [[x, y, z], r] of RADOMES) {
      ctx.beginPath();
      ctx.arc(this.X(x, y), this.Y(x, y, z + r * 0.6), r * this.K, 0, TAU);
      ctx.fillStyle = c.islandTop;
      ctx.fill();
      ctx.strokeStyle = c.line;
      ctx.stroke();
    }
    // lattice mast
    const { at, z0, z1, pole, w0, w1 } = MAST;
    const corner = (z: number, i: number): V3 => {
      const w = w0 + (w1 - w0) * ((z - z0) / (z1 - z0));
      return [at[0] + (i & 1 ? w : -w), at[1] + (i & 2 ? w : -w), z];
    };
    ctx.strokeStyle = c.line;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) this.line(ctx, corner(z0, i), corner(z1, i));
    const rungs = 6;
    for (let r = 0; r <= rungs; r++) {
      const z = z0 + ((z1 - z0) * r) / rungs;
      const q = [0, 1, 3, 2].map((i) => corner(z, i));
      for (let i = 0; i < 4; i++) this.line(ctx, q[i], q[(i + 1) % 4]);
      if (r < rungs) {
        const q2 = [0, 1, 3, 2].map((i) => corner(z0 + ((z1 - z0) * (r + 1)) / rungs, i));
        for (let i = 0; i < 4; i++) this.line(ctx, q[i], q2[(i + 1) % 4]);
      }
    }
    // yards and the pole
    const yz = z0 + (z1 - z0) * 0.62;
    this.line(ctx, [at[0], at[1] - 1.5, yz], [at[0], at[1] + 1.5, yz]);
    this.line(ctx, [at[0] - 0.9, at[1], yz + 0.8], [at[0] + 0.9, at[1], yz + 0.8]);
    this.line(ctx, [at[0], at[1], z1], [at[0], at[1], pole]);
    ctx.stroke();
  }

  // ------------------------------------------------------------------ jets
  private jetShadow(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, h: number) {
    const ch = Math.cos(h), sh = Math.sin(h);
    const off = 0.6;
    const ox = x + this.sun[0] * off, oy = y + this.sun[1] * off;
    const shape = (pts: readonly (readonly number[])[], sg: number) => {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const u = pts[i][0], v = pts[i][1] * sg;
        const px = ox + u * ch - v * sh, py = oy + u * sh + v * ch;
        const sx = this.X(px, py), sy = this.Y(px, py, z);
        if (i) ctx.lineTo(sx, sy);
        else ctx.moveTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
    };
    shape(JET_BODY, 1);
    shape(JET_WING, 1);
    shape(JET_WING, -1);
    shape(JET_STAB, 1);
    shape(JET_STAB, -1);
  }

  private jet(ctx: CanvasRenderingContext2D, s: JetPose) {
    const c = this.c;
    const px = s.p[0], py = s.p[1], pz = s.p[2];
    const ch = Math.cos(s.h), sh = Math.sin(s.h), cb = Math.cos(s.bank), sb = Math.sin(s.bank);
    // a point of the jet (u forward, v to the side, w up) → canvas (qx, qy)
    let qx = 0, qy = 0;
    const Q = (u: number, v: number, w: number) => {
      const v2 = v * cb - w * sb, w2 = w * cb + v * sb;
      const x = px + u * ch - v2 * sh, y = py + u * sh + v2 * ch;
      qx = this.X(x, y);
      qy = this.Y(x, y, pz + w2);
    };
    const to = (i: number) => (i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy));
    // a planform outline at height w (or the points' own third coordinate), mirrored when sg = -1
    const shape = (pts: readonly (readonly number[])[], w: number, sg: number, fill: string | null, stroke: string | null) => {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        Q(p[0], p[1] * sg, p.length > 2 ? p[2] : w);
        to(i);
      }
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    };
    const V0 = -this.sn * this.CA, V1 = -this.cs * this.CA, V2 = this.SA; // toward the viewer
    // which side (+v or -v) faces the viewer: draw the far side first
    const side = -sh * cb * V0 + ch * cb * V1 + sb * V2;
    const far = side > 0 ? -1 : 1;
    for (const sg of [far, -far]) {
      shape(JET_STAB, JET_W.wing + 0.07, sg, c.jet, c.line);
      shape(JET_WING, JET_W.wing, sg, c.jet, c.line);
    }
    // fuselage: the sides that face the viewer (their lower edge outlined), then the back
    const n = JET_BODY.length;
    ctx.fillStyle = c.jet;
    ctx.strokeStyle = c.jet;
    const facing: number[] = [];
    // one path for all of them: they face the viewer, so they wind the same way on the canvas
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = JET_BODY[i], b = JET_BODY[(i + 1) % n];
      // the planform runs nose → +v side → tail → -v side: outward normal (-dv, du)
      const nu = -(b[1] - a[1]), nv = b[0] - a[0];
      const wx = nu * ch - nv * cb * sh, wy = nu * sh + nv * cb * ch, wz = nv * sb;
      if (wx * V0 + wy * V1 + wz * V2 <= 0) continue;
      Q(a[0], a[1], JET_W.belly);
      to(0);
      Q(b[0], b[1], JET_W.belly);
      to(1);
      Q(b[0], b[1], JET_W.body);
      to(2);
      Q(a[0], a[1], JET_W.body);
      to(3);
      ctx.closePath();
      facing.push(i);
    }
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = c.line;
    ctx.beginPath();
    for (const i of facing) {
      const a = JET_BODY[i], b = JET_BODY[(i + 1) % n];
      Q(a[0], a[1], JET_W.belly);
      to(0);
      Q(b[0], b[1], JET_W.belly);
      to(1);
    }
    ctx.stroke();
    shape(JET_BODY, JET_W.body, 1, c.jet, c.line);
    // spine
    ctx.beginPath();
    Q(2.3, 0, JET_W.body);
    to(0);
    Q(-2.4, 0, JET_W.body);
    to(1);
    ctx.strokeStyle = c.line;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
    shape(JET_CANOPY, JET_W.canopy, 1, c.jet, c.line);
    if (s.flame > 0) {
      const L = 1.6 * s.flame;
      shape([[-3.0, 0.32], [-3.0 - L, 0], [-3.0, -0.32]], 0.58, 1, c.flame, null);
      shape([[-3.0, 0.16], [-3.0 - L * 0.55, 0], [-3.0, -0.16]], 0.58, 1, c.flameCore, null);
    }
    // fins, the far one first
    for (const sg of [far, -far]) shape(JET_FIN, 0, sg, c.jet, c.line);
  }

  // ------------------------------------------------------------------ per frame
  private sea(ctx: CanvasRenderingContext2D, t: number) {
    // short "~" marks fixed to the water: they stream past toward the stern and fade in and out. They
    // are stroked in 8 batches by opacity (an eighth of their faint contrast is not visible)
    const N = SEA_MARKS, R = 130, speed = SEA_DRIFT, buf = this.markBuf, lv = this.markLv;
    for (let i = 0; i < N; i++) {
      lv[i] = 0;
      const life = 150 + hash(i * 3.1) * 140;
      const ph = t / life + hash(i * 7.7);
      const gen = Math.floor(ph);
      const a = Math.sin(Math.PI * (ph - gen));
      if (a < 0.05) continue;
      let x = (hash(i * 13.3 + gen * 1.7) * 2 - 1) * R - speed * t;
      x = ((((x + R) % (2 * R)) + 2 * R) % (2 * R)) - R;
      const y = (hash(i * 5.9 + gen * 3.3) * 2 - 1) * R;
      const L = 2.8 + hash(i * 2.3) * 1.8;
      const sx = this.X(x, y), sy = this.Y(x, y, 0);
      if (sx < -60 || sx > this.w + 60 || sy < -60 || sy > this.h + 60) continue;
      const ex = this.X(x - L, y) - sx, ey = this.Y(x - L, y, 0) - sy;
      const nl = Math.hypot(ex, ey) || 1;
      const nx = (-ey / nl) * 0.22 * this.K, ny = (ex / nl) * 0.22 * this.K;
      const o = i * 8;
      buf[o] = sx;
      buf[o + 1] = sy;
      buf[o + 2] = sx + ex * 0.33 + nx;
      buf[o + 3] = sy + ey * 0.33 + ny;
      buf[o + 4] = sx + ex * 0.66 - nx;
      buf[o + 5] = sy + ey * 0.66 - ny;
      buf[o + 6] = sx + ex;
      buf[o + 7] = sy + ey;
      lv[i] = Math.max(1, Math.round(a * 8));
    }
    ctx.strokeStyle = this.c.seaMark;
    ctx.lineWidth = 1.6 * this.dpr * Math.max(1, this.place.k);
    for (let l = 1; l <= 8; l++) {
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < N; i++) {
        if (lv[i] !== l) continue;
        const o = i * 8;
        ctx.moveTo(buf[o], buf[o + 1]);
        ctx.bezierCurveTo(buf[o + 2], buf[o + 3], buf[o + 4], buf[o + 5], buf[o + 6], buf[o + 7]);
        any = true;
      }
      if (!any) continue;
      ctx.globalAlpha = l / 8;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private wake(ctx: CanvasRenderingContext2D, t: number) {
    const x0 = WAKE_X0, x1 = WAKE_X1;
    const far = wakeFar, near = wakeNear;
    ctx.fillStyle = this.c.wake;
    ctx.beginPath();
    ctx.moveTo(this.X(x0, far(x0)), this.Y(x0, far(x0), 0));
    ctx.lineTo(this.X(x1, far(x1)), this.Y(x1, far(x1), 0));
    ctx.lineTo(this.X(x1, near(x1)), this.Y(x1, near(x1), 0));
    ctx.lineTo(this.X(x0, near(x0)), this.Y(x0, near(x0), 0));
    ctx.closePath();
    ctx.fill();
    // streaks in the churned water, streaming aft
    ctx.strokeStyle = this.c.seaMark;
    ctx.lineWidth = this.dpr * Math.max(1, this.place.k);
    ctx.beginPath();
    const span = 150;
    for (let i = 0; i < 46; i++) {
      const lane = hash(i * 4.1);
      const L = 3 + hash(i * 9.2) * 7;
      const s = (((hash(i * 1.3) * span + t * 0.12) % span) + span) % span;
      const xa = x0 - 1 - s, xb = xa - L;
      const ya = far(xa) + (near(xa) - far(xa)) * lane, yb = far(xb) + (near(xb) - far(xb)) * lane;
      ctx.moveTo(this.X(xa, ya), this.Y(xa, ya, 0));
      ctx.lineTo(this.X(xb, yb), this.Y(xb, yb, 0));
    }
    ctx.stroke();
  }

  // the bow catapult's blast deflector, hinged at its forward edge
  private deflector(ctx: CanvasRenderingContext2D, f: number) {
    const [x0, x1, y0, y1] = DEFLECTORS[0];
    const a = jbdAt(f), L = x1 - x0;
    const P = (u: number, y: number): V3 => [x1 - u * L * Math.cos(a), y, HD + u * L * Math.sin(a)];
    const c = this.c;
    ctx.lineWidth = this.lw;
    if (a > 0.01) {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = c.shadow;
      ctx.beginPath();
      const s = L * Math.sin(a) * 0.6;
      this.path(ctx, [[x1, y0, HD], [x1 - L * Math.cos(a) + this.sun[0] * s, y0 + this.sun[1] * s, HD], [x1 - L * Math.cos(a) + this.sun[0] * s, y1 + this.sun[1] * s, HD], [x1, y1, HD]]);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    this.poly(ctx, [P(0, y0), P(1, y0), P(1, y1), P(0, y1)], a > 0.01 ? c.deck : null, c.mark);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const y = y0 + ((y1 - y0) * i) / 4;
      this.line(ctx, P(0, y), P(1, y));
    }
    ctx.stroke();
  }

  // the bow wave: a dashed line of foam that peels off the near side of the bow
  private bowWave(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = this.c.wake;
    ctx.lineWidth = 2 * this.dpr * Math.max(1, this.place.k);
    ctx.setLineDash([0.8 * this.K, 0.75 * this.K]);
    // from the stem at the waterline, 20° off the ship's line
    const [x, y, a, L] = BOW_WAVE;
    ctx.beginPath();
    ctx.moveTo(this.X(x, y), this.Y(x, y, WL));
    const ex = x - Math.cos(a) * L, ey = y + Math.sin(a) * L;
    ctx.lineTo(this.X(ex, ey), this.Y(ex, ey, WL));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = this.lw;
  }

  private farLift(ctx: CanvasRenderingContext2D, t: number) {
    const z = HD + liftAt(t);
    const c = this.c;
    this.band(ctx, FAR_LIFT, z, c.band);
    this.ring(ctx, FAR_LIFT, z, c.deck, c.line);
    const h = (LIFT_JET[2] * Math.PI) / 180;
    ctx.fillStyle = c.shadow;
    ctx.globalAlpha = 0.6;
    this.jetShadow(ctx, LIFT_JET[0], LIFT_JET[1], z, h);
    ctx.globalAlpha = 1;
    this.jet(ctx, { p: [LIFT_JET[0], LIFT_JET[1], z], h, bank: 0, air: false, flame: 0, hook: null, wire: 1 });
  }

  private wire(ctx: CanvasRenderingContext2D, a: JetPose) {
    const [[ax, ay], [bx, by]] = WIRE;
    const z = HD + 0.05;
    ctx.strokeStyle = this.c.line;
    ctx.beginPath();
    ctx.moveTo(this.X(ax, ay), this.Y(ax, ay, z));
    if (a.hook) {
      ctx.lineTo(this.X(a.hook[0], a.hook[1]), this.Y(a.hook[0], a.hook[1], a.hook[2]));
    } else if (a.wire < 1) {
      // let go: springs back to its line across the deck
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const last = jetAt(224);
      const hx = last.p[0] - Math.cos(last.h) * 2.5, hy = last.p[1] - Math.sin(last.h) * 2.5;
      const e = 1 - Math.pow(1 - a.wire, 3);
      const qx = hx + (mx - hx) * e, qy = hy + (my - hy) * e;
      ctx.lineTo(this.X(qx, qy), this.Y(qx, qy, z));
    }
    ctx.lineTo(this.X(bx, by), this.Y(bx, by, z));
    ctx.stroke();
    ctx.fillStyle = this.c.line;
    for (const [x, y] of WIRE) {
      ctx.beginPath();
      ctx.arc(this.X(x, y), this.Y(x, y, z), 0.22 * this.K, 0, TAU);
      ctx.fill();
    }
  }

  private smoke(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.c.smoke;
    const pb = this.puffBuf;
    for (let i = 0; i < pb.length; i++) {
      const q = pb[i];
      ctx.globalAlpha = q[4];
      ctx.beginPath();
      ctx.arc(this.X(q[0], q[1]), this.Y(q[0], q[1], q[2]), q[3] * this.K, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // where the helicopter's shadow falls: on the deck (HD) or on the water (0)
  private heliGround(t: number) {
    const { p } = heliAt(t);
    const [gx, gy] = this.sun;
    return this.onDeck(p[0] + gx * (p[2] - HD), p[1] + gy * (p[2] - HD)) ? HD : 0;
  }

  private heliShadow(ctx: CanvasRenderingContext2D, t: number, gz: number) {
    const { p, h, rotor } = heliAt(t);
    const [x, y, z] = p;
    const c = this.c;
    const ch = Math.cos(h), sh = Math.sin(h);
    const L = (u: number, v: number, w: number): V3 => [x + u * ch - v * sh, y + u * sh + v * ch, z + w];
    const [gx, gy] = this.sun;
    const S = (q: V3): V3 => [q[0] + gx * (q[2] - gz), q[1] + gy * (q[2] - gz), gz];
    const pod = POD.map(([u, v]) => L(u * 1.2, v * 1.2, 0));
    ctx.fillStyle = c.shadow;
    ctx.strokeStyle = c.shadow;
    ctx.globalAlpha = 0.7;
    this.path(ctx, pod.map(S));
    ctx.fill();
    ctx.lineWidth = this.lw * 2;
    ctx.beginPath();
    this.line(ctx, S(L(-1.1, 0, 0.25)), S(L(-4.6, 0, 0.55)));
    for (let i = 0; i < 2; i++) {
      const a = rotor + (i * Math.PI) / 2;
      const ca = Math.cos(a) * 2.9, sa = Math.sin(a) * 2.9;
      this.line(ctx, S(L(ca, sa, 0.95)), S(L(-ca, -sa, 0.95)));
    }
    ctx.stroke();
    ctx.lineWidth = this.lw;
    ctx.globalAlpha = 1;
  }

  private heli(ctx: CanvasRenderingContext2D, t: number) {
    const { p, h, rotor } = heliAt(t);
    const [x, y, z] = p;
    const c = this.c;
    const ch = Math.cos(h), sh = Math.sin(h);
    const L = (u: number, v: number, w: number): V3 => [x + u * ch - v * sh, y + u * sh + v * ch, z + w];
    const pod = POD.map(([u, v]) => L(u * 1.2, v * 1.2, 0));
    // tail boom, fin, tail rotor, skids
    ctx.strokeStyle = c.line;
    ctx.beginPath();
    this.line(ctx, L(-1.1, 0.16, 0.35), L(-4.6, 0.06, 0.6));
    this.line(ctx, L(-1.1, -0.16, 0.2), L(-4.6, -0.06, 0.5));
    this.line(ctx, L(-4.3, 0, 0.5), L(-4.8, 0, 1.25));
    this.line(ctx, L(-4.8, 0, 1.25), L(-4.55, 0, 1.3));
    this.line(ctx, L(-4.6, 0.1, 0.25), L(-4.6, 0.1, 1.0));
    this.line(ctx, L(0.9, 0.45, -0.55), L(-0.9, 0.45, -0.55));
    this.line(ctx, L(0.9, -0.45, -0.55), L(-0.9, -0.45, -0.55));
    ctx.stroke();
    this.poly(ctx, pod, c.flare, c.line);
    this.poly(ctx, POD_TOP.map(([u, v]) => L(u * 1.2, v * 1.2, 0.6)), c.flare, c.line);
    // rotor mast and blades
    ctx.beginPath();
    this.line(ctx, L(0, 0, 0.55), L(0, 0, 0.95));
    for (let i = 0; i < 2; i++) {
      const a = rotor + (i * Math.PI) / 2;
      const ca = Math.cos(a) * 2.9, sa = Math.sin(a) * 2.9;
      this.line(ctx, L(ca, sa, 0.95), L(-ca, -sa, 0.95));
    }
    ctx.lineWidth = this.lw * 1.6;
    ctx.stroke();
    ctx.lineWidth = this.lw;
  }

  private onDeck(x: number, y: number) {
    let inside = false;
    for (let i = 0, j = DECK.length - 1; i < DECK.length; j = i++) {
      const xi = DECK[i][0], yi = DECK[i][1], xj = DECK[j][0], yj = DECK[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // draw frame f (60 fps frames since the scene started); dt: seconds since the last frame.
  // Returns the frame of the flight cycle.
  render(f: number, dt = 0) {
    if (this.to && this.from) {
      this.fadeT = Math.min(1, this.fadeT + dt / this.fadeDur);
      const e = this.fadeT * this.fadeT * (3 - 2 * this.fadeT);
      const o = {} as Pal;
      for (const k of CARRIER_KEYS) {
        const a = this.from[k], b = this.to[k];
        o[k] = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e, a[3] + (b[3] - a[3]) * e];
      }
      this.colors = o;
      this.c = this.cssAll(o);
      this.ver++; // the fx layers follow every frame
      if (!this.xfade) this.dirty = true;
      if (this.fadeT >= 1) this.to = null;
    }
    // when frames run slow (a slow device, a busy machine), the sea and the ship are redrawn every other
    // frame for a while; the frames between keep the turn and only move what flies
    if (dt > 0) this.ema += (Math.min(dt, 0.1) - this.ema) * 0.15;
    if (this.ema > 0.022) this.slowFor = 600;
    else if (this.slowFor > 0) this.slowFor--;
    const pace = this.slowFor > 0 && (++this.tick & 1) === 1;
    // the turn: in steps of at least TURN_STEP, and exactly once the drag and its glide have stopped
    const step = Math.abs(this.pend - this.turn);
    if (pace) {
      // keep it for this frame
    } else if (step > 0 && (step >= TURN_STEP || this.pend === this.lastPend)) {
      this.calm = 0;
      this.turn = this.pend;
      this.dirty = true;
    } else this.calm++;
    if (!pace) this.lastPend = this.pend;
    this.setup();
    const gA = ((f % LIFE) + LIFE) % LIFE; // the jet that lands this cycle
    const gB = (((f + CYCLE) % LIFE) + LIFE) % LIFE; // the one waiting to launch
    const A = jetAt(gA), B = jetAt(gB);
    // spinning fast (and for a few frames after): the ship and what moves on its deck are drawn on the sea
    const fold = this.calm < 6;
    const c = this.c, L = this.L;
    const [gx, gy] = this.sun;

    // ---- the sea: water, marks, wake, shadows on the water
    const sea = this.sea2d;
    const hz = this.heliGround(f);
    if (!pace) {
      // on a slow device a fast-spinning ship and the sea are drawn at half resolution until it settles
      this.sizeSea(fold && this.slowFor > 0 ? 0.5 : 1);
      sea.setTransform(this.seaX, 0, 0, this.seaY, 0, 0);
      sea.globalAlpha = 1;
      sea.globalCompositeOperation = "source-over";
      sea.fillStyle = c.sea;
      sea.fillRect(0, 0, this.w, this.h);
      sea.lineJoin = "round";
      sea.lineCap = "round";
      this.sea(sea, f);
      this.wake(sea, f);
      sea.lineWidth = this.lw;
      sea.fillStyle = c.shadow;
      sea.globalAlpha = 0.7;
      for (const j of [A, B]) {
        if (!j.air) continue;
        const x = j.p[0], y = j.p[1], z = j.p[2];
        if (!this.onDeck(x + gx * (z - HD), y + gy * (z - HD))) this.jetShadow(sea, x + gx * z, y + gy * z, 0, j.h);
      }
      sea.globalAlpha = 1;
      if (!hz) this.heliShadow(sea, f, 0);
    }

    // ---- the ship
    if (this.xfade && !pace && (fold || this.dirty)) this.endFade(); // turned or resized meanwhile
    if (pace) {
      // as it was (a colour change or a turn waits for the next frame)
    } else if (this.xfade) {
      if (this.xnew) {
        const now = this.c;
        this.c = this.cssAll(this.to ?? this.colors);
        this.drawShip(this.prepare(this.shipCv));
        this.c = now;
        this.shipCv.style.display = "block";
        this.xnew = false;
      }
      if (this.to && this.still) this.still.style.opacity = String(1 - this.fadeT * this.fadeT * (3 - 2 * this.fadeT));
      else {
        this.endFade();
        this.setShip(1);
        this.age = 0;
      }
    } else if (fold) {
      this.drawShip(sea, { f, A, B });
      this.ver++;
      this.dirty = false;
      this.setShip(0);
    } else if (this.dirty || this.shipMode === 0) {
      this.drawShip(this.prepare(this.shipCv));
      this.ver++;
      this.dirty = false;
      this.age = 0;
      this.setShip(1);
    } else if (this.shipMode === 1 && ++this.age === 10) this.freeze();
    const v = this.ver;

    // ---- the fx layers
    if (fold) {
      L.lift.show(false);
      L.jbd.show(false);
      L.wire.show(false);
    }
    // the far lift (only redrawn while it moves); when it is down, the flight deck hides the part under its edge
    const lz = liftAt(f);
    const lk = `${lz.toFixed(4)}|${v}`;
    if (!fold && L.lift.key !== lk) {
      L.lift.key = lk;
      const z = HD + lz;
      const pts: V3[] = [[LIFT_JET[0], LIFT_JET[1], z + 2.2]];
      for (const [x, y] of FAR_LIFT) pts.push([x, y, z + 0.1], [x, y, z - BAND]);
      const b = this.boxOf(pts, 3.6);
      const ctx = this.open(L.lift, b);
      if (ctx) this.farLift(ctx, f);
      if (ctx && lz <= -0.15) {
        // cut out what stands on the flight deck in front of it: the deck itself, the island and the jets parked by the lift
        ctx.globalCompositeOperation = "destination-out";
        this.ring(ctx, DECK, HD, "#000", "#000");
        this.island(ctx);
        for (const [x, y, h] of PARKED)
          if (x > -40 && x < -12 && y < 3)
            this.jet(ctx, { p: [x, y, HD], h: (h * Math.PI) / 180, bank: 0, air: false, flame: 0, hook: null, wire: 1 });
        ctx.globalCompositeOperation = "source-over";
      }
    }
    // the bow catapult's blast deflector (only redrawn while it moves)
    const ja = jbdAt(f), jk = `${ja.toFixed(4)}|${v}`;
    if (!fold && L.jbd.key !== jk) {
      L.jbd.key = jk;
      const [x0, x1, y0, y1] = DEFLECTORS[0];
      const b = this.boxOf([[x0, y0, HD], [x1, y0, HD], [x1, y1, HD], [x0, y1, HD], [x1, y0, HD + 1.6], [x1, y1, HD + 1.6]], 1);
      const ctx = this.open(L.jbd, b);
      if (ctx) this.deflector(ctx, f);
    }
    // the arresting wire (only redrawn while a jet pulls it out or it springs back)
    const wk = `${A.hook ? A.hook.map((n) => n.toFixed(2)).join() : ""}|${A.wire.toFixed(3)}|${v}`;
    if (!fold && L.wire.key !== wk) {
      L.wire.key = wk;
      const [[ax, ay], [bx, by]] = WIRE;
      const pts: V3[] = [[ax, ay, HD], [bx, by, HD], [-14, 9.6, HD], [-16, 6.4, HD]];
      if (A.hook) pts.push(A.hook);
      const ctx = this.open(L.wire, this.boxOf(pts, 1));
      if (ctx) this.wire(ctx, A);
    }
    // the two jets, and the shadow of one in the air when it falls on the deck
    const near = this.depth(A.p[0], A.p[1]) < this.depth(B.p[0], B.p[1]) ? A : B;
    const slots: [JetPose, Layer, Layer][] = [[A, L.jetA, L.shA], [B, L.jetB, L.shB]];
    for (const [j, lj, ls] of slots) {
      const x = j.p[0], y = j.p[1], z = j.p[2];
      const sx = x + gx * (z - HD), sy = y + gy * (z - HD);
      const deckShadow = j.air && !fold && this.onDeck(sx, sy);
      const sc = deckShadow ? this.open(ls, this.boxOf([[sx, sy, HD]], 4)) : null;
      if (sc) {
        sc.fillStyle = c.shadow;
        sc.globalAlpha = 0.7;
        this.jetShadow(sc, sx, sy, HD, j.h);
        sc.globalAlpha = 1;
      } else ls.show(false);
      if (fold && !j.air) {
        lj.show(false); // drawn with the ship
        continue;
      }
      // a jet standing still is not redrawn
      const jk = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)},${j.h.toFixed(4)},${j.bank.toFixed(3)},${j.flame.toFixed(3)}|${v}`;
      lj.setZ(j.air ? 8 : j === near ? 5 : 4);
      if (lj.key === jk) continue;
      const ctx = this.open(lj, this.boxOf([[x, y, z - 0.5], [x, y, z + 2.6]], 4.9));
      lj.key = jk;
      if (!ctx) continue;
      if (!j.air) {
        ctx.fillStyle = c.shadow;
        ctx.globalAlpha = 0.6;
        this.jetShadow(ctx, x, y, HD, j.h);
        ctx.globalAlpha = 1;
      }
      this.jet(ctx, j);
    }
    // tyre smoke and catapult steam
    puffs(gA, gB, this.puffBuf);
    if (this.puffBuf.length) {
      const pb = this.puffBuf, pts: V3[] = [];
      for (let i = 0; i < pb.length; i++) pts.push([pb[i][0], pb[i][1], pb[i][2]]);
      const ctx = this.open(L.smoke, this.boxOf(pts, 1.4));
      if (ctx) this.smoke(ctx);
    } else L.smoke.show(false);
    // the helicopter, and its shadow when it falls on the deck
    const hp = heliAt(f).p;
    if (hz) {
      const sx = hp[0] + gx * (hp[2] - hz), sy = hp[1] + gy * (hp[2] - hz);
      const ctx = this.open(L.heliSh, this.boxOf([[sx, sy, hz]], 5.6));
      if (ctx) this.heliShadow(ctx, f, hz);
    } else L.heliSh.show(false);
    const hc = this.open(L.heli, this.boxOf([[hp[0], hp[1], hp[2] - 0.8], [hp[0], hp[1], hp[2] + 1.3]], 5.6));
    if (hc) this.heli(hc, f);
    return Math.floor(((f % CYCLE) + CYCLE) % CYCLE);
  }

  private endFade() {
    this.xfade = this.xnew = false;
    if (this.still) {
      this.still.style.display = "none";
      this.still.style.opacity = "1";
    }
    this.shipMode = -1; // the next setShip sets both canvases
  }

  private setShip(mode: number) {
    if (mode === this.shipMode) return;
    this.shipMode = mode;
    this.shipCv.style.display = mode === 1 ? "block" : "none";
    if (this.still) this.still.style.display = mode === 2 ? "block" : "none";
  }

  // the ship has not changed for a while: show a still copy of its canvas instead
  private freeze() {
    const s = this.still, sc = this.stillCtx, cv = this.shipCv;
    if (!s || !sc) return;
    const oc = new OffscreenCanvas(cv.width, cv.height);
    const o = oc.getContext("2d");
    if (!o) return;
    o.drawImage(cv, 0, 0);
    s.width = cv.width;
    s.height = cv.height;
    sc.transferFromImageBitmap(oc.transferToImageBitmap());
    s.style.width = cv.style.width;
    s.style.height = cv.style.height;
    s.style.transform = cv.style.transform;
    this.setShip(2);
  }
}
