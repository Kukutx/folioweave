import type { PliersPose } from "./pliers";

// The punch is painted once into a canvas (it never changes while it moves or squeezes): each vector layer
// with its own soft blur, one layer per idle moment so no task runs long, then its shadow
// (offset 7 px, blur σ 9 px, then 1 px, σ 2 px). Units of the pose are half a CSS px.

/** Room around the pose for its shadow, CSS px. */
export const PLIERS_MARGIN = 40;
const FILTERS =
  '<filter id="s" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="0.8"/></filter>' +
  '<filter id="r" x="-4%" y="-4%" width="108%" height="108%"><feGaussianBlur stdDeviation="2.6"/></filter>';

const idle = () =>
  new Promise<void>((ok) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => ok(), { timeout: 400 });
    else setTimeout(ok, 16);
  });

/** Size of the painted pose at `c` canvas px per CSS px: canvas px, and CSS px. */
export function pliersBox(pz: PliersPose, c: number) {
  const W = Math.ceil((pz.w / 2 + 2 * PLIERS_MARGIN) * c), H = Math.ceil((pz.h / 2 + 2 * PLIERS_MARGIN) * c);
  return { W, H, w: W / c, h: H / c };
}

/** Paints `pz` into `out` at `c` canvas px per CSS px. Resolves false (and leaves `out` alone) if `live()` turns false. */
export async function paintPliers(out: HTMLCanvasElement, pz: PliersPose, c: number, live: () => boolean): Promise<boolean> {
  const { W, H } = pliersBox(pz, c);
  const M = 2 * PLIERS_MARGIN;
  const vb = `${-M} ${-M} ${(2 * W) / c} ${(2 * H) / c}`;
  const a = document.createElement("canvas");
  a.width = W; a.height = H;
  const ctx = a.getContext("2d")!;
  const items = [...pz.layers.map((l) => ({ fill: l.c, d: l.d, f: l.s ? "r" : "s" })), { fill: "rgba(255,255,255,0.16)", d: pz.dots, f: "s" }];
  for (const it of items) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${vb}"><defs>${FILTERS}</defs>` +
      `<path fill="${it.fill}" fill-rule="evenodd" d="${it.d}" filter="url(#${it.f})"/></svg>`;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    try { await img.decode(); } catch { return false; }
    await idle();
    if (!live()) return false;
    ctx.drawImage(img, 0, 0, W, H);
  }
  // the shadow of it all, then a close shadow of that
  await idle();
  if (!live()) return false;
  const b = document.createElement("canvas");
  b.width = W; b.height = H;
  const bx = b.getContext("2d")!;
  Object.assign(bx, { shadowColor: "rgba(0, 0, 0, 0.24)", shadowOffsetX: 0, shadowOffsetY: 7 * c, shadowBlur: 18 * c });
  bx.drawImage(a, 0, 0);
  await idle();
  if (!live()) return false;
  out.width = W; out.height = H;
  const ox = out.getContext("2d")!;
  Object.assign(ox, { shadowColor: "rgba(0, 0, 0, 0.18)", shadowOffsetX: 0, shadowOffsetY: 1 * c, shadowBlur: 4 * c });
  ox.drawImage(b, 0, 0);
  return true;
}
