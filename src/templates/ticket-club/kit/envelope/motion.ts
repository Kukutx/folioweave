// Small motion helpers (kept inside the component folder so it can be copied on its own).
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export type Ease = (u: number) => number;
/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress u (0..1). */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return (u: number) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 8; i++) {
      const x = ((ax * t + bx) * t + cx) * t - u;
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(x) < 1e-6 || !d) break;
      t -= x / d;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}
