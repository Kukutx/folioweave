import {
  TAU,
  mix,
  noise,
  normalized,
  rotate,
  rotation,
  smooth,
  spherePoint,
  toolsSpinOpening,
  type GlassFace,
  type Vec3,
} from "./earth-geometry";

export type GlassShard = {
  face: GlassFace;
  vertices: [Vec3, Vec3, Vec3];
  normal: Vec3;
  dots: Vec3[];
  tilt: Vec3;
  lift: number;
};

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const identity = rotation(0, 0);

/** A circumscribed surface of revolution for fitting a full turn once per pose.
 * Its meridian follows the actual shards, rather than a large bounding sphere. */
export function glassSpinEnvelope(
  shards: readonly GlassShard[],
  split: number,
) {
  const pre = rotation(0, (-toolsSpinOpening(split) * Math.PI) / 2);
  const bands: { r: number; h: number }[][] = [[], [], [], []];
  for (const shard of shards) {
    const pose = glassShardPose(shard, split);
    for (const vertex of shard.vertices) {
      const p = rotate(transformShardPoint(vertex, pose), pre);
      const r = Math.hypot(p.x, p.z);
      bands[shard.face.band].push({ r, h: p.y }, { r: -r, h: p.y });
    }
  }
  const count = 32,
    padding = 1 / Math.cos(Math.PI / count);
  return bands.flatMap((points, band) => {
    points.sort((a, b) => a.h - b.h || a.r - b.r);
    const cross = (a: (typeof points)[number], b: typeof a, c: typeof a) =>
      (b.h - a.h) * (c.r - a.r) - (b.r - a.r) * (c.h - a.h);
    const half = (ordered: typeof points) => {
      const hull: typeof points = [];
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
    const hull = [
      ...half(points).slice(0, -1),
      ...half([...points].reverse()).slice(0, -1),
    ]
      .filter((p) => p.r >= 0)
      .sort((a, b) => a.h - b.h);
    const rings = hull.map((p) =>
      Array.from({ length: count }, (_, i) => ({
        x: p.r * padding * Math.cos((i / count) * TAU),
        y: p.h,
        z: p.r * padding * Math.sin((i / count) * TAU),
      })),
    );
    // Fit the projected silhouette of each convex band. Its surface quads
    // repeated every vertex four times and needlessly re-clipped interior edges.
    return [{ band, points: rings.flat() }];
  });
}

/** Bind map samples to their actual triangular glass surface once, rather than
 * letting a separately sliced point cloud drift through rotating fragments. */
export function createGlassShards(
  faces: GlassFace[],
  land: Vec3[],
): GlassShard[] {
  const shards = faces.map((face) => {
    const [a, b, c] = face.points;
    const ab = subtract(b, a),
      ac = subtract(c, a);
    let normal = normalized({
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x,
    });
    if (dot(normal, face.center) < 0)
      normal = { x: -normal.x, y: -normal.y, z: -normal.z };
    return {
      face,
      normal,
      vertices: face.points.map((point) => subtract(point, face.center)) as [
        Vec3,
        Vec3,
        Vec3,
      ],
      dots: [] as Vec3[],
      tilt: {
        x: (noise(face.seed * 27) - 0.5) * 0.68,
        y: (face.seed - 0.5) * 0.76,
        z: (noise(face.seed * 53) - 0.5) * 0.24,
      },
      lift: 0.035 + noise(face.seed * 79) * 0.075,
    };
  });
  const bases = shards.map(({ face, normal }) => {
    const a = face.points[0],
      ab = subtract(face.points[1], a),
      ac = subtract(face.points[2], a);
    const aa = dot(ab, ab),
      bb = dot(ac, ac),
      cross = dot(ab, ac);
    return {
      a,
      ab,
      ac,
      aa,
      bb,
      cross,
      inverse: 1 / (aa * bb - cross * cross),
      plane: dot(normal, a),
    };
  });
  // Conservative spherical bins avoid testing thousands of samples against the
  // whole shell. The angular margin covers every point in a bin, including poles.
  const columns = 16,
    rows = 8,
    margin = Math.PI / rows / 2 + TAU / columns / 2;
  const bins = Array.from({ length: columns * rows }, (_, i) => ({
    center: spherePoint(
      -Math.PI + (((i % columns) + 0.5) * TAU) / columns,
      -Math.PI / 2 + ((Math.floor(i / columns) + 0.5) * Math.PI) / rows,
    ),
    indices: [] as number[],
  }));
  shards.forEach(({ face }, index) => {
    const radius = Math.acos(
      Math.min(
        ...face.points.map((p) =>
          Math.max(-1, Math.min(1, dot(face.normal, p))),
        ),
      ),
    );
    const limit = Math.cos(radius + margin);
    for (const bin of bins)
      if (dot(bin.center, face.normal) >= limit) bin.indices.push(index);
  });
  for (const point of land) {
    const longitude = Math.atan2(point.x, point.z),
      latitude = Math.atan2(point.y, Math.hypot(point.x, point.z));
    const column = Math.min(
      columns - 1,
      Math.floor(((longitude + Math.PI) / TAU) * columns),
    );
    const row = Math.min(
      rows - 1,
      Math.floor(((latitude + Math.PI / 2) / Math.PI) * rows),
    );
    for (const i of bins[row * columns + column].indices) {
      const shard = shards[i];
      const denominator = dot(shard.normal, point);
      if (denominator < 0.8) continue;
      const basis = bases[i],
        distance = basis.plane / denominator;
      const onFace = {
        x: point.x * distance,
        y: point.y * distance,
        z: point.z * distance,
      };
      const relative = subtract(onFace, basis.a);
      const u = dot(relative, basis.ab),
        v = dot(relative, basis.ac);
      const b = (basis.bb * u - basis.cross * v) * basis.inverse;
      const c = (basis.aa * v - basis.cross * u) * basis.inverse;
      if (b < -1e-7 || c < -1e-7 || b + c > 1 + 1e-7) continue;
      shard.dots.push(subtract(onFace, shard.face.center));
      break;
    }
  }
  return shards;
}

/** Absolute scroll pose: no accumulating physics, random per-frame jitter or
 * lag when seeking backwards. All points on one shard share this rigid pose. */
export function glassShardPose(
  shard: GlassShard,
  split: number,
  globe = identity,
  scene = identity,
  layerOffset = 0,
) {
  const amount = smooth(
    shard.face.seed * 0.16,
    0.86 + shard.face.seed * 0.14,
    split,
  );
  const normal = shard.face.normal;
  const local = rotation(
    shard.tilt.y * amount,
    shard.tilt.x * amount,
    shard.tilt.z * amount,
  );
  const scale = 1 - amount * 0.075;
  const orient = (point: Vec3) =>
    rotate(rotate(rotate(point, local), globe), scene);
  const center = rotate(
    {
      x: shard.face.center.x + normal.x * shard.lift * amount,
      y: shard.face.center.y + normal.y * shard.lift * amount,
      z: shard.face.center.z + normal.z * shard.lift * amount,
    },
    globe,
  );
  center.z += layerOffset;
  const fracture = smooth(0, 0.7, split);
  // Compose the rotations once; vertices and map samples share this affine basis.
  return {
    center: rotate(center, scene),
    x: orient({ x: scale, y: 0, z: 0 }),
    y: orient({ x: 0, y: scale, z: 0 }),
    z: orient({ x: 0, y: 0, z: scale }),
    normal: orient(
      normalized({
        x: mix(normal.x, shard.normal.x, fracture),
        y: mix(normal.y, shard.normal.y, fracture),
        z: mix(normal.z, shard.normal.z, fracture),
      }),
    ),
  };
}

export function transformShardPoint(
  point: Vec3,
  pose: ReturnType<typeof glassShardPose>,
): Vec3 {
  return {
    x:
      pose.center.x +
      pose.x.x * point.x +
      pose.y.x * point.y +
      pose.z.x * point.z,
    y:
      pose.center.y +
      pose.x.y * point.x +
      pose.y.y * point.y +
      pose.z.y * point.z,
    z:
      pose.center.z +
      pose.x.z * point.x +
      pose.y.z * point.y +
      pose.z.z * point.z,
  };
}
