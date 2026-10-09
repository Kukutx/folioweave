export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
