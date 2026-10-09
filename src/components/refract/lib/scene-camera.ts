import { clamp, mix, smooth } from "./motion";
import { toolsMotion } from "./scene-progress";

/** A fixed lens with a moving camera: foreground and background travel at
 * different speeds. Scroll remains the only input to these reversible shots. */
export const SCENE_FOCAL_DISTANCE = 6.8;
type Keyframe = readonly [progress: number, value: number];
const track = (p: number, keys: readonly Keyframe[]) => {
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0])
      return mix(
        keys[i - 1][1],
        keys[i][1],
        smooth(keys[i - 1][0], keys[i][0], p),
      );
  }
  return keys[keys.length - 1][1];
};

// Research keeps its approach and return. Tools winds the complete assembly
// into a front-facing globe before departure, with a fixed lens throughout.
// Finish the approach while the data sheets are still open. As their model
// scale returns to the globe's radius, the camera settles in the same movement.
const framing: readonly Keyframe[] = [
  [0, 1],
  [0.045, 1.08],
  [0.17, 1.04],
  [0.27, 1.02],
  [0.315, 1.02],
  [0.35, 1.2],
  [0.42, 1],
  [0.81, 1],
  [0.94, 1],
  [0.953, 1],
  [1, 0.82],
];
const toolsOrbit: readonly Keyframe[] = [
  [0, 0],
  [toolsMotion.enter, 0],
  [0.85, 0.5],
  [0.863, 0.59],
  [toolsMotion.close, 0.6068],
  [toolsMotion.orbitEnd, 1],
];
// A shot passes through its guide poses without stopping at every keyframe.
// Weighted monotone tangents preserve their exact poses and cannot overshoot;
// the stationary endpoints still ease gently into and out of the complete turn.
const orbitSlopes = toolsOrbit
  .slice(1)
  .map(([p, value], i) => (value - toolsOrbit[i][1]) / (p - toolsOrbit[i][0]));
const orbitTangents = toolsOrbit.map(([p], i) => {
  if (
    !i ||
    i === toolsOrbit.length - 1 ||
    orbitSlopes[i - 1] * orbitSlopes[i] <= 0
  )
    return 0;
  const before = p - toolsOrbit[i - 1][0],
    after = toolsOrbit[i + 1][0] - p;
  const a = 2 * after + before,
    b = after + 2 * before;
  return (a + b) / (a / orbitSlopes[i - 1] + b / orbitSlopes[i]);
});
const toolsOrbitAt = (p: number) => {
  for (let i = 1; i < toolsOrbit.length; i++) {
    const [end, to] = toolsOrbit[i],
      [start, from] = toolsOrbit[i - 1];
    if (p > end) continue;
    const duration = end - start,
      t = clamp((p - start) / duration);
    return (
      (2 * t ** 3 - 3 * t ** 2 + 1) * from +
      (t ** 3 - 2 * t ** 2 + t) * duration * orbitTangents[i - 1] +
      (-2 * t ** 3 + 3 * t ** 2) * to +
      (t ** 3 - t ** 2) * duration * orbitTangents[i]
    );
  }
  return toolsOrbit[toolsOrbit.length - 1][1];
};
const layerTurn: readonly Keyframe[] = [
  [0, 0],
  [0.15, -0.12],
  [0.27, -0.12],
  [0.34, 0.28],
  [0.4, 0.5],
  [0.42, 0],
];
const layerTilt: readonly Keyframe[] = [
  [0, 0],
  [0.15, 0.08],
  [0.27, 0.08],
  [0.36, -0.17],
  [0.42, 0],
];

export function sceneCamera(progress: number, reduced = false, mobile = false) {
  const p = clamp(progress);
  const open = smooth(0.15, 0.285, p),
    front = smooth(0.3, 0.42, p);
  const tools = toolsOrbitAt(p);
  const toolsPitch = Math.sin(tools * Math.PI) * Math.PI * 0.25;
  // Bank into the turn: keep the separated axis on its established diagonal
  // instead of sweeping it through the copy and forcing the auto-fit to shrink.
  // Level out only as the stack becomes spherical. All transforms share center.
  const bank =
    p <= toolsMotion.close || p >= toolsMotion.orbitEnd
      ? 0
      : (0.94 -
          Math.atan2(
            -Math.cos(tools * Math.PI * 2) * Math.sin(toolsPitch),
            -Math.sin(tools * Math.PI * 2),
          )) *
        smooth(toolsMotion.close, 0.9, p) *
        (1 - smooth(0.925, toolsMotion.orbitEnd, p));
  const zoom = reduced ? 1 : mix(1, track(p, framing), mobile ? 0.5 : 1);
  return {
    distance: SCENE_FOCAL_DISTANCE / zoom,
    yaw: reduced
      ? 0
      : mix(-open * Math.PI * 0.75, -Math.PI * 2, front) - tools * Math.PI * 2,
    pitch: reduced ? 0 : (open * (1 - front) * Math.PI) / 2 + toolsPitch,
    roll: reduced ? 0 : bank,
    layerYaw: reduced ? 0 : track(p, layerTurn),
    layerPitch: reduced ? 0 : track(p, layerTilt),
  };
}

export const scenePerspective = (depth: number, distance: number) =>
  SCENE_FOCAL_DISTANCE / Math.max(1.2, distance - depth);
export const sceneSphereScale = (distance: number) =>
  Math.sqrt((SCENE_FOCAL_DISTANCE ** 2 - 1) / (distance ** 2 - 1));

type ReadingRect = { left: number; right: number; top: number; bottom: number };
export type ReadingBounds = ReadingRect & { lines?: readonly ReadingRect[] };
/** Perspective preserves convexity in front of the lens. Only this outline is
 * needed for fitting; the renderer still draws every original glass triangle. */
export function projectedHull<T extends { x: number; y: number }>(
  points: T[],
): T[] {
  if (points.length < 4) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: T, b: T, c: T) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (ordered: T[]) => {
    const hull: T[] = [];
    for (const p of ordered) {
      while (
        hull.length > 1 &&
        cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0
      )
        hull.pop();
      hull.push(p);
    }
    return hull;
  };
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
}
/** Only constrain geometry beside the measured copy. Lower pieces may use the
 * empty space beneath it; fitting the entire left half made the shot too small. */
export function fitBesideReading(
  faces: readonly { points: readonly { x: number; y: number }[] }[],
  cx: number,
  cy: number,
  limit: number,
  reading: ReadingBounds,
) {
  let scale = limit;
  const lines = reading.lines ?? [reading];
  for (let pass = 0; pass < 32; pass++) {
    const previous = scale;
    for (const { points } of faces) {
      for (const line of lines) {
        // Intersect the actual triangle with the text line's horizontal strip.
        // A face's leftmost corner may be well BELOW the copy; its bounding
        // rectangle used to trigger an unnecessary zoom-out anyway.
        const top = cy + (line.top - 16 - cy) / Math.max(scale, 0.001);
        const bottom = cy + (line.bottom + 16 - cy) / Math.max(scale, 0.001);
        let left = Infinity;
        for (let i = 0; i < points.length; i++) {
          const a = points[i],
            b = points[(i + 1) % points.length];
          if (a.y >= top && a.y <= bottom) left = Math.min(left, a.x);
          if (a.y !== b.y)
            for (const y of [top, bottom]) {
              const t = (y - a.y) / (b.y - a.y);
              if (t >= 0 && t <= 1) left = Math.min(left, mix(a.x, b.x, t));
            }
        }
        if (left < cx)
          scale = Math.min(
            scale,
            Math.max(0, cx - line.right - 24) / (cx - left),
          );
      }
    }
    if (Math.abs(previous - scale) < 1e-8) break;
  }
  return scale;
}
