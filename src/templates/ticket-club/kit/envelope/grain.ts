// The paper's grain: fractal noise as SVG's feTurbulence computes it (type fractalNoise, base frequency .82
// stitched to a seamless 240 px tile, 3 octaves, seed 0; its alpha channel), shown as one warm tone at
// alpha .78 − 1.25 × noise. Painted once into a bitmap, a few rows at a time so no task runs long, and shared
// by every envelope on the page (as `--env-grain`).

const TILE = 240;
const BS = 256, BM = 255, PN = 4096;
let url = "";
let job: Promise<string> | null = null;

/** The grain bitmap's URL once it is ready ("" before). */
export const grainUrl = () => url;

function lattice() {
  const sel = new Int32Array(BS + BS + 2);
  const g = new Float64Array((BS + BS + 2) * 2 * 4);
  let seed = 1; // setup_seed(0)
  const rnd = () => {
    const r = 16807 * (seed % 127773) - 2836 * Math.floor(seed / 127773);
    seed = r <= 0 ? r + 2147483647 : r;
    return seed;
  };
  let i = 0;
  for (let k = 0; k < 4; k++) {
    for (i = 0; i < BS; i++) {
      sel[i] = i;
      const o = (k * (BS + BS + 2) + i) * 2;
      g[o] = ((rnd() % (BS + BS)) - BS) / BS;
      g[o + 1] = ((rnd() % (BS + BS)) - BS) / BS;
      const s = Math.hypot(g[o], g[o + 1]) || 1;
      g[o] /= s; g[o + 1] /= s;
    }
  }
  while (--i) {
    const k = sel[i], j = rnd() % BS;
    sel[i] = sel[j];
    sel[j] = k;
  }
  for (i = 0; i < BS + 2; i++) {
    sel[BS + i] = sel[i];
    for (let k = 0; k < 4; k++) {
      const a = (k * (BS + BS + 2) + i) * 2, b = (k * (BS + BS + 2) + BS + i) * 2;
      g[b] = g[a]; g[b + 1] = g[a + 1];
    }
  }
  return { sel, g };
}

const idle = () =>
  new Promise<void>((ok) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => ok(), { timeout: 300 });
    else setTimeout(ok, 0);
  });

/** Starts painting the grain (once per page); resolves with its URL. Safe to call early, e.g. when idle. */
export function prepareGrain(): Promise<string> {
  if (job) return job;
  if (typeof document === "undefined") return Promise.resolve("");
  job = (async () => {
    const sc = (window.devicePixelRatio || 1) > 1.25 ? 2 : 1;
    const P = TILE * sc;
    const { sel, g } = lattice();
    const C = 3 * (BS + BS + 2) * 2; // the alpha channel's gradients
    // base frequency adjusted so the tile stitches (as the spec does it)
    const lo = Math.floor(TILE * 0.82) / TILE, hi = Math.ceil(TILE * 0.82) / TILE;
    const f = 0.82 / lo < hi / 0.82 ? lo : hi;
    const W0 = Math.trunc(TILE * f + 0.5), X0 = Math.trunc(PN + W0);
    const noise = (vx: number, vy: number, w: number, wrap: number) => {
      let t = vx + PN;
      let bx0 = Math.trunc(t) & BM, bx1 = (bx0 + 1) & BM;
      const rx0 = t - Math.trunc(t), rx1 = rx0 - 1;
      t = vy + PN;
      let by0 = Math.trunc(t) & BM, by1 = (by0 + 1) & BM;
      const ry0 = t - Math.trunc(t), ry1 = ry0 - 1;
      if (bx0 >= wrap) bx0 -= w;
      if (bx1 >= wrap) bx1 -= w;
      if (by0 >= wrap) by0 -= w;
      if (by1 >= wrap) by1 -= w;
      bx0 &= BM; bx1 &= BM; by0 &= BM; by1 &= BM;
      const i = sel[bx0], j = sel[bx1];
      const b00 = C + sel[i + by0] * 2, b10 = C + sel[j + by0] * 2, b01 = C + sel[i + by1] * 2, b11 = C + sel[j + by1] * 2;
      const sx = rx0 * rx0 * (3 - 2 * rx0), sy = ry0 * ry0 * (3 - 2 * ry0);
      let u = rx0 * g[b00] + ry0 * g[b00 + 1], v = rx1 * g[b10] + ry0 * g[b10 + 1];
      const a = u + sx * (v - u);
      u = rx0 * g[b01] + ry1 * g[b01 + 1]; v = rx1 * g[b11] + ry1 * g[b11 + 1];
      const b = u + sx * (v - u);
      return a + sy * (b - a);
    };
    const cv = document.createElement("canvas");
    cv.width = cv.height = P;
    const ctx = cv.getContext("2d")!;
    const im = ctx.createImageData(P, P), d = im.data;
    const ROWS = 24;
    for (let y0 = 0; y0 < P; y0 += ROWS) {
      await idle();
      for (let y = y0; y < Math.min(P, y0 + ROWS); y++) {
        for (let x = 0; x < P; x++) {
          let vx = ((x + 0.5) / sc) * f, vy = ((y + 0.5) / sc) * f, w = W0, wrap = X0, sum = 0, ratio = 1;
          for (let o = 0; o < 3; o++) {
            sum += noise(vx, vy, w, wrap) / ratio;
            vx *= 2; vy *= 2; ratio *= 2; w *= 2; wrap = 2 * wrap - PN;
          }
          const n = Math.round(Math.min(1, Math.max(0, (sum + 1) / 2)) * 255) / 255;
          const k = (y * P + x) * 4;
          // rgb(.42 .38 .26) in linear light
          d[k] = 173; d[k + 1] = 166; d[k + 2] = 140;
          d[k + 3] = Math.round(Math.min(1, Math.max(0, 0.78 - 1.25 * n)) * 255);
        }
      }
    }
    ctx.putImageData(im, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok));
    url = blob ? URL.createObjectURL(blob) : "";
    return url;
  })();
  return job;
}
