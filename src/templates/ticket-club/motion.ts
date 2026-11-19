// Animation maths of the original (replicas src/lib/motion.ts): every curve constant was fitted with
// exactly these functions, so they stay numerically identical.
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export type Ease = (u: number) => number;

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress u (0..1), solved by Newton steps. */
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
