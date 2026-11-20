// The golden ticket's face, drawn in code: hammered gold foil, the engraved frame (a fine line, then a
// beaded band) that bows around the notches, the corner blocks, the corner scrolls (traced from the
// recording curl by curl, see scrolls.ts), the oval with its fleurons, and the two plaques
// with their lettering. Only the engraved scene inside the oval is a picture (a prop). Design units: the
// ticket is 840 × 340 (notches at mid-height). The face is drawn once with Canvas 2D at `scale` px per
// unit; the foil's relief is a tileable noise field lit like the recording (light from the upper left),
// computed in short slices between frames so it never blocks the page.
import { SCROLLS } from "./scrolls";

export const TW = 840, TH = 340;
/** The notches: arcs of radius NOTCH_R about a centre NOTCH_O beyond each end (so NOTCH deep, 2 × NOTCH_H open). */
export const NOTCH_R = 75, NOTCH_O = 26.9, NOTCH = NOTCH_R - NOTCH_O;
const NOTCH_H = Math.sqrt(NOTCH_R * NOTCH_R - NOTCH_O * NOTCH_O);
/** Where the scene picture sits (its own box, design units) and the oval it shows through. */
export const SCENE = { x: 118, y: 43, w: 604, h: 256 };
const OVAL = { cx: 420, cy: 171, rx: 299, ry: 125 };
const PLAQUE_TOP = { x: 339, y: 32, w: 162, h: 47 };
const PLAQUE_BOT = { x: 283, y: 288, w: 274, h: 29 };

// gold, as recorded: a bright, pale yellow gold at the upper left deepening to amber at the lower right
// (the foil's colour at the ticket's four corners, fitted to the recording's foil; bilinear between them)
const FOIL = { tl: [238, 228, 138], tr: [194, 154, 38], bl: [212, 174, 57], br: [135, 77, 7] };
const gold = (x: number, y: number) => {
  const u = Math.min(1, Math.max(0, x / TW)), v = Math.min(1, Math.max(0, y / TH));
  return [0, 1, 2].map((i) => (FOIL.tl[i] * (1 - u) + FOIL.tr[i] * u) * (1 - v) + (FOIL.bl[i] * (1 - u) + FOIL.br[i] * u) * v);
};
const css = (c: number[]) => `rgb(${c.map(Math.round).join(", ")})`;
const INK = "rgb(112, 74, 10)"; // engraved lines, the shadow of raised ones
const LINE = "rgb(120, 86, 18)"; // the frame's strong lines
const CUT = "rgb(100, 56, 0)"; // the scrolls' grooves
const SHINE = "rgb(255, 232, 150)"; // the lit edge
const RAISED = "rgb(214, 174, 82)"; // raised ornament

/** The frame line at inset d: straight sides, bowing inward around both notches (concentric with them). */
function frameLine(d: number) {
  const R = NOTCH_R + 0.875 * d, s = Math.sqrt(R * R - (d + NOTCH_O) ** 2), c = TH / 2;
  return `M${d} ${d}H${TW - d}V${c - s}A${R} ${R} 0 0 0 ${TW - d} ${c + s}V${TH - d}H${d}V${c + s}A${R} ${R} 0 0 0 ${d} ${c - s}Z`;
}
const OUTLINE = (() => {
  const c = TH / 2, h = NOTCH_H, r = NOTCH_R;
  return `M0 0H${TW}V${c - h}A${r} ${r} 0 0 0 ${TW} ${c + h}V${TH}H0V${c + h}A${r} ${r} 0 0 0 0 ${c - h}Z`;
})();

// a corner block (top left; mirrored for the others) where the beaded band turns: a dark square with a
// four-petalled flower on its diagonals
const BLOCK = { x: 11.5, s: 15 };
const PETAL = "M0 0C1.5 -0.8 4.8 0.6 5.4 3C5.8 4.6 4.6 5.8 3 5.4C0.6 4.8 -0.8 1.5 0 0Z";
// a fleuron (at the oval's ends and over / under the number plaque), pointing right from its origin
const FLEURON = [
  "M0 0C8 -2 14 -8 22 -6C28 -4 28 4 22 6C14 8 8 2 0 0Z",
  "M4 -2C2 -10 6 -18 14 -20C18 -21 21 -17 18 -14C16 -12 12 -13 13 -16",
  "M4 2C2 10 6 18 14 20C18 21 21 17 18 14C16 12 12 13 13 16",
  "M22 0H32M34 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
].join("");
// a scroll that ends a plaque, pointing right
const PLAQUE_END = "M0 0C5 -9 16 -12 22 -6C27 -1 22 7 16 5C12 4 12 -1 16 -1M0 0C6 8 18 12 26 6C30 3 30 -2 27 -4M0 0H8";

type Ctx = CanvasRenderingContext2D;
type Shape = { d: string; m?: [number, number, number, number, number, number] };
const at = (d: string, m?: Shape["m"]): Shape => ({ d, m });
const mirror = (sx: number, sy: number, tx: number, ty: number): Shape["m"] => [sx, 0, 0, sy, tx, ty];
const move = (x: number, y: number, rot = 0, s = 1): Shape["m"] => {
  const c = Math.cos(rot) * s, n = Math.sin(rot) * s;
  return [c, n, -n, c, x, y];
};

/** Stroke shapes (each with its own placement) with an offset / colour / width. */
function stroke(c: Ctx, shapes: Shape[], color: string, w: number, dx = 0, dy = 0, alpha = 1) {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = "round";
  c.lineJoin = "round";
  const base = c.getTransform();
  for (const s of shapes) {
    c.setTransform(base);
    c.translate(dx, dy);
    if (s.m) c.transform(...s.m);
    c.stroke(new Path2D(s.d));
  }
  c.restore();
}
/** Pressed into the foil: a lit edge under the dark line. */
const engrave = (c: Ctx, s: Shape[], w: number, a = 1) => { stroke(c, s, SHINE, w, 0.7, 0.8, 0.55 * a); stroke(c, s, INK, w, 0, 0, a); };
/** Raised from the foil: a shadow below-right, the gold line, a lit edge above-left. */
const emboss = (c: Ctx, s: Shape[], w: number) => {
  stroke(c, s, INK, w + 1.3, 0.5, 0.7, 0.8);
  stroke(c, s, RAISED, w);
  stroke(c, s, SHINE, w * 0.4, -0.35, -0.45, 0.75);
};

// ---- the foil: gold under a tileable value-noise relief, lit from the upper left (azimuth 235°,
// elevation 55°), computed per pixel in slices (yielding between them) on a CPU canvas ----
const TILE = 384;
function lattice(n: number, seed: number) {
  const a = new Float32Array(n * n);
  let s = seed;
  for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; }
  return a;
}
const yieldFrame = () => new Promise<void>((ok) => setTimeout(ok, 0));
async function foil(W: number, H: number, px: number) {
  const oct = [[28, 0.45], [56, 0.36], [112, 0.2], [224, 0.08]].map(([n, wgt]) => ({ n, wgt, g: lattice(n, 7 + n) }));
  const N = TILE, h = new Float32Array(N * N);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y0 = 0; y0 < N; y0 += 32) {
    for (let y = y0; y < Math.min(N, y0 + 32); y++)
      for (let x = 0; x < N; x++) {
        let v = 0;
        for (const o of oct) {
          const fx = (x / N) * o.n, fy = (y / N) * o.n;
          const ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
          const x1 = (ix + 1) % o.n, y1 = (iy + 1) % o.n, g = o.g, n = o.n;
          const a = g[iy * n + ix] + (g[iy * n + x1] - g[iy * n + ix]) * tx;
          const b = g[y1 * n + ix] + (g[y1 * n + x1] - g[y1 * n + ix]) * tx;
          v += (a + (b - a) * ty) * o.wgt;
        }
        h[y * N + x] = v;
      }
    await yieldFrame();
  }
  const az = (235 * Math.PI) / 180, el = (55 * Math.PI) / 180;
  const L = [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
  const Hv = [L[0], L[1], L[2] + 1], hl = Math.hypot(Hv[0], Hv[1], Hv[2]);
  const depth = 2 / px; // a low relief: the foil is mottled, not crumpled
  const lit = new Float32Array(N * N), shine = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    if (y % 96 === 95) await yieldFrame();
    for (let x = 0; x < N; x++) {
      const hx = (h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)]) * depth;
      const hy = (h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x]) * depth;
      const nl = Math.hypot(hx, hy, 1), nx = -hx / nl, ny = hy / nl, nz = 1 / nl;
      lit[y * N + x] = Math.min(1, 0.95 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) + 0.17);
      shine[y * N + x] = 0.16 * Math.max(0, (nx * Hv[0] + ny * Hv[1] + nz * Hv[2]) / hl) ** 40;
    }
  }
  await yieldFrame();
  // the gold at each pixel, plus the relief's light as a soft, even (grey) brightening or darkening, + glint
  const L0 = 0.95 * Math.sin(el) + 0.17, TEX = [150, 175, 195], G = [255, 236, 160];
  const im = new ImageData(W, H), d = im.data;
  for (let y0 = 0; y0 < H; y0 += 40) {
    for (let y = y0; y < Math.min(H, y0 + 40); y++) {
      const ty = (y % N) * N;
      const a = gold(0, y / px), b = gold(TW, y / px);
      for (let x = 0; x < W; x++) {
        const f = Math.min(1, x / px / TW);
        const k = ty + (x % N), l = lit[k] - L0, sp = shine[k], i = (y * W + x) * 4;
        d[i] = a[0] + (b[0] - a[0]) * f + TEX[0] * l + G[0] * sp;
        d[i + 1] = a[1] + (b[1] - a[1]) * f + TEX[1] * l + G[1] * sp;
        d[i + 2] = a[2] + (b[2] - a[2]) * f + TEX[2] * l + G[2] * sp;
        d[i + 3] = 255;
      }
    }
    await yieldFrame();
  }
  return im;
}

export type FaceText = { number: string; admit: string; font: string };

/** Render the whole face (no holes) into `out` (sized TW × TH × scale). */
export async function renderFace(out: HTMLCanvasElement, scale: number, scene: HTMLImageElement | null, text: FaceText) {
  const W = Math.round(TW * scale), H = Math.round(TH * scale);
  const im = await foil(W, H, scale);
  out.width = W;
  out.height = H;
  // drawn on the CPU (a one-off picture, then used as an image)
  const c = out.getContext("2d", { willReadFrequently: true })!;
  c.putImageData(im, 0, 0);
  // (each stage is flushed and followed by a pause, so no one task runs long)
  const flush = async () => { c.getImageData(0, 0, 1, 1); await yieldFrame(); };
  c.setTransform(scale, 0, 0, scale, 0, 0);
  const outline = new Path2D(OUTLINE);
  c.globalCompositeOperation = "destination-in";
  c.fill(outline);
  c.globalCompositeOperation = "source-over";
  c.save();
  c.clip(outline);
  // the rim, a little paler than the field, to the die-cut edge
  stroke(c, [at(OUTLINE)], "rgb(255, 240, 176)", 12, 0, 0, 0.14);
  stroke(c, [at(OUTLINE)], "rgb(120, 78, 16)", 1.4, 0, 0, 0.3);
  c.restore();

  await flush();
  // the frame: a fine line, then the beaded band (a strong line, a row of beads, a line), which turns
  // at the corner blocks
  engrave(c, [at(frameLine(9))], 1.1, 0.85);
  const mirrors = [mirror(1, 1, 0, 0), mirror(-1, 1, TW, 0), mirror(1, -1, 0, TH), mirror(-1, -1, TW, TH)];
  const { x: bx, s: bs } = BLOCK, bc = bx + bs / 2;
  const blocks = mirrors.map((m) => at(`M${bx} ${bx}h${bs}v${bs}h${-bs}Z`, m));
  c.save();
  const rest = new Path2D(`M-9 -9H${TW + 9}V${TH + 9}H-9Z`);
  for (const b of blocks) rest.addPath(new Path2D(b.d), new DOMMatrix(b.m));
  c.clip(rest, "evenodd");
  stroke(c, [at(frameLine(16))], INK, 2.6, 0, 0, 0.4);
  stroke(c, [at(frameLine(14))], SHINE, 2, 0.7, 0.8, 0.5);
  stroke(c, [at(frameLine(14))], LINE, 2);
  stroke(c, [at(frameLine(18))], SHINE, 1.5, 0.7, 0.8, 0.5);
  stroke(c, [at(frameLine(18))], LINE, 1.5);
  c.setLineDash([0.01, 2.6]);
  stroke(c, [at(frameLine(16))], "rgb(64, 38, 4)", 1.25, 0.3, 0.35, 0.5);
  stroke(c, [at(frameLine(16))], "rgb(236, 200, 116)", 1.1, 0, 0, 0.95);
  c.restore();
  c.save();
  c.fillStyle = "rgb(86, 52, 8)";
  for (const b of blocks) { c.save(); c.transform(...b.m!); c.fill(new Path2D(b.d)); c.restore(); }
  c.restore();
  stroke(c, blocks, SHINE, 0.6, 0.45, 0.55, 0.45);
  const petals = mirrors.flatMap((m) => [0, 1, 2, 3].map((i) => {
    const p = move(bc, bc, (i * Math.PI) / 2, 0.95);
    // (the petal's placement, then the corner's mirror)
    const [a, b, cc, d, e, f] = m!;
    return at(PETAL, [a * p![0] + cc * p![1], b * p![0] + d * p![1], a * p![2] + cc * p![3], b * p![2] + d * p![3], a * p![4] + cc * p![5] + e, b * p![4] + d * p![5] + f]);
  }));
  c.save();
  c.fillStyle = "rgb(206, 166, 76)";
  for (const p of petals) { c.save(); c.transform(...p.m!); c.fill(new Path2D(p.d)); c.restore(); }
  c.restore();
  stroke(c, petals, SHINE, 0.4, -0.25, -0.3, 0.5);

  // the corner scrolls, traced (see scrolls.ts): the broad lit faces, the lit crests, then the grooves, each
  // over its own lit lower lip
  c.save();
  c.scale(0.1, 0.1);
  for (const sc of SCROLLS) {
    const cut = new Path2D(sc.cut);
    c.fillStyle = SHINE;
    c.globalAlpha = 0.3;
    c.fill(new Path2D(sc.glow));
    c.globalAlpha = 0.7;
    c.fill(new Path2D(sc.lit));
    c.globalAlpha = 0.4;
    c.translate(3, 3.5);
    c.fill(cut);
    c.translate(-3, -3.5);
    c.globalAlpha = 0.9;
    c.fillStyle = CUT;
    c.fill(cut);
  }
  c.restore();

  await flush();
  // the scene, inside the oval's inner line
  if (scene) {
    c.save();
    c.beginPath();
    c.ellipse(OVAL.cx, OVAL.cy, OVAL.rx - 1, OVAL.ry - 1, 0, 0, Math.PI * 2);
    c.clip();
    c.drawImage(scene, SCENE.x, SCENE.y, SCENE.w, SCENE.h);
    c.restore();
  }
  await flush();
  // the oval's lines over the picture's edge, its fleurons, the plaques
  const ell = (r: number) => `M${OVAL.cx - OVAL.rx - r} ${OVAL.cy}a${OVAL.rx + r} ${OVAL.ry + r} 0 1 0 ${2 * (OVAL.rx + r)} 0a${OVAL.rx + r} ${OVAL.ry + r} 0 1 0 ${-2 * (OVAL.rx + r)} 0Z`;
  engrave(c, [at(ell(5))], 0.8);
  emboss(c, [at(ell(0))], 2.2);
  emboss(c, [at(FLEURON, move(OVAL.cx + OVAL.rx + 6, OVAL.cy)), at(FLEURON, [-1, 0, 0, 1, OVAL.cx - OVAL.rx - 6, OVAL.cy])], 1.6);
  emboss(c, [at(FLEURON, move(420, PLAQUE_TOP.y - 1, -Math.PI / 2, 0.55)), at(FLEURON, move(420, PLAQUE_TOP.y + PLAQUE_TOP.h + 1, Math.PI / 2, 0.5))], 1.4);
  plaque(c, PLAQUE_TOP, true);
  plaque(c, PLAQUE_BOT, false);
  await flush();

  // lettering: raised numerals on the sunk field; engraved words on the lower plaque
  const letter = (s: string, x: number, y: number, size: number, weight: number, track: number, raised: boolean) => {
    c.font = `${weight} ${size}px ${text.font}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    (c as Ctx & { letterSpacing?: string }).letterSpacing = `${track}px`;
    const layer = (dx: number, dy: number, fill: string, a: number) => { c.globalAlpha = a; c.fillStyle = fill; c.fillText(s, x + dx, y + dy); };
    if (raised) { layer(0.7, 0.9, "rgb(84, 48, 6)", 0.85); layer(-0.3, -0.4, "rgb(255, 236, 170)", 0.8); layer(0, 0, "rgb(232, 196, 116)", 1); }
    else { layer(0.6, 0.7, SHINE, 0.55); layer(0, 0, "rgb(122, 78, 12)", 1); }
    c.globalAlpha = 1;
  };
  letter(text.number, PLAQUE_TOP.x + PLAQUE_TOP.w / 2, PLAQUE_TOP.y + PLAQUE_TOP.h / 2 + 1, 25, 700, 0.6, true);
  letter(text.admit, PLAQUE_BOT.x + PLAQUE_BOT.w / 2, PLAQUE_BOT.y + PLAQUE_BOT.h / 2 + 1, 16, 600, 1.8, false);
  c.setTransform(1, 0, 0, 1, 0, 0);
}

/** A plaque: a raised frame with scroll ends; `sunk` = a recessed amber field (for raised numerals). */
function plaque(c: Ctx, p: { x: number; y: number; w: number; h: number }, sunk: boolean) {
  const { x, y, w, h } = p;
  const f = 4.5;
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, css(gold(x, y + h / 2))); g.addColorStop(1, css(gold(x + w, y + h / 2)));
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  if (sunk) {
    const s = c.createLinearGradient(0, y + f, 0, y + h - f);
    s.addColorStop(0, "rgb(160, 104, 36)"); s.addColorStop(1, "rgb(182, 126, 50)");
    c.fillStyle = s;
    c.fillRect(x + f, y + f, w - 2 * f, h - 2 * f);
    c.save();
    c.beginPath(); c.rect(x + f, y + f, w - 2 * f, h - 2 * f); c.clip();
    c.strokeStyle = "rgba(90, 52, 6, 0.45)"; c.lineWidth = 2.4;
    c.strokeRect(x + f, y + f, w - 2 * f, h - 2 * f);
    c.restore();
  }
  const frame = at(`M${x + 1.5} ${y + 1.5}h${w - 3}v${h - 3}h${-(w - 3)}Z`);
  emboss(c, [frame, at(PLAQUE_END, move(x + w + 1, y + h / 2)), at(PLAQUE_END, [-1, 0, 0, 1, x - 1, y + h / 2])], 2.2);
  engrave(c, [at(`M${x + f} ${y + f}h${w - 2 * f}v${h - 2 * f}h${-(w - 2 * f)}Z`)], 0.9);
}
