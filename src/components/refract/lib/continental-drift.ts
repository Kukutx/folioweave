import mesh from "./continent-mesh.json";
import {
  clamp,
  noise,
  normalized,
  rotate,
  rotation,
  smooth,
  spherePoint,
  type GeoVertex,
  type Rotation,
  type Vec3,
} from "./earth-geometry";

export type ContinentalPlate = {
  id: string;
  region: string;
  seed: number;
  pivot: Vec3;
  normal: Vec3;
  radius: number;
  vertices: Vec3[];
  contours: number[][];
  dots: GeoVertex[];
};
export type ContinentalPose = {
  pivot: Vec3;
  center: Vec3;
  local: Rotation;
  normal: Vec3;
  x: Vec3;
  y: Vec3;
  z: Vec3;
  flatten: number;
};
const radians = Math.PI / 180;
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
function inMask(lon: number, lat: number, mask: number[][]) {
  let inside = false;
  for (let i = 0, j = mask.length - 1; i < mask.length; j = i++) {
    const a = mask[i],
      b = mask[j];
    if (
      a[1] > lat !== b[1] > lat &&
      lon < ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
/** The same physical-land masks and Voronoi seeds as the offline generator. */
export function continentalRegion(lon: number, lat: number) {
  return Math.max(
    0,
    mesh.findIndex(
      (region, index) =>
        index === mesh.length - 1 || inMask(lon, lat, region.mask),
    ),
  );
}
export function createContinentalPlates(
  land: readonly GeoVertex[],
): ContinentalPlate[] {
  let serial = 0;
  const regions = mesh.map((region) =>
    region.fragments.map((fragment, index) => {
      const pivot = spherePoint(
        fragment.pivot[0] * radians,
        fragment.pivot[1] * radians,
        1.004,
      );
      const vertices = fragment.vertices.map(([lon, lat]) =>
        spherePoint(lon * radians, lat * radians, 1.004),
      );
      return {
        id: `${region.id}-${index}`,
        region: region.id,
        seed: noise(++serial + 53),
        pivot,
        normal: normalized(pivot),
        radius: Math.max(
          ...vertices.map((v) =>
            Math.hypot(v.x - pivot.x, v.y - pivot.y, v.z - pivot.z),
          ),
        ),
        vertices,
        contours: fragment.contours,
        dots: [] as GeoVertex[],
      };
    }),
  );
  for (const point of land) {
    const lon = point.lon / radians,
      lat = point.lat / radians,
      region = continentalRegion(lon, lat);
    let nearest = 0,
      distance = Infinity;
    mesh[region].fragments.forEach((fragment, index) => {
      const d = (lon - fragment.seed[0]) ** 2 + (lat - fragment.seed[1]) ** 2;
      if (d < distance) {
        distance = d;
        nearest = index;
      }
    });
    regions[region][nearest].dots.push(point);
  }
  return regions.flat();
}
export function continentalAmount(phase: number, index = 0) {
  if (phase <= 0 || phase >= 1) return 0;
  const delay = ((index * 3) % 7) * 0.012;
  return (
    smooth(delay, 0.26 + delay, phase) *
    (1 - smooth(0.72 + delay * 0.4, 0.98, phase))
  );
}
/** Curved map patches peel into planar mirrors, turn independently, then close exactly.
 * The parent's clock freezes with pause/visibility; scroll alone owns separation. */
export function continentalPose(
  plate: ContinentalPlate,
  phase: number,
  index: number,
  amplitude = 1,
  time = 0,
  spread = 1,
): ContinentalPose {
  const amount = continentalAmount(phase, index) * clamp(amplitude, 0, 1.4);
  const seed = plate.seed,
    n = plate.normal;
  const turn = amount * (1 - 1.1 * smooth(0.71, 0.94, phase));
  const local = rotation(
    ((seed - 0.5) * 2.5 +
      Math.sin(time * 0.55 + seed * 17) * 0.4 +
      (phase - 0.45) * (seed > 0.5 ? 1 : -1)) *
      turn,
    ((noise(seed * 91) - 0.5) * 1.8 +
      Math.cos(time * 0.43 + seed * 23) * 0.32) *
      turn,
    ((noise(seed * 37) - 0.5) * 1.1 +
      Math.sin(time * 0.31 + seed * 31) * 0.18) *
      turn,
  );
  const lift = (0.22 + seed * 0.26) * amount * clamp(spread, 0.5, 1.6),
    flatten = Math.min(1, amount),
    scale = 1 - amount * 0.09;
  const axis = (x: number, y: number, z: number) => {
    const depth = (n.x * x + n.y * y + n.z * z) * flatten;
    return rotate(
      {
        x: (x - n.x * depth) * scale,
        y: (y - n.y * depth) * scale,
        z: (z - n.z * depth) * scale,
      },
      local,
    );
  };
  return {
    pivot: plate.pivot,
    center: {
      x: plate.pivot.x + n.x * lift,
      y: plate.pivot.y + n.y * lift,
      z: plate.pivot.z + n.z * lift,
    },
    local,
    normal: rotate(n, local),
    x: axis(1, 0, 0),
    y: axis(0, 1, 0),
    z: axis(0, 0, 1),
    flatten,
  };
}
/** One affine transform attaches every geographic dot to its own glass fragment. */
export function transformContinentalPoint(
  point: Vec3,
  pose: ContinentalPose,
): Vec3 {
  const x = point.x - pose.pivot.x,
    y = point.y - pose.pivot.y,
    z = point.z - pose.pivot.z;
  return {
    x: pose.center.x + x * pose.x.x + y * pose.y.x + z * pose.z.x,
    y: pose.center.y + x * pose.x.y + y * pose.y.y + z * pose.z.y,
    z: pose.center.z + x * pose.x.z + y * pose.y.z + z * pose.z.z,
  };
}
export type ContinentalFrame = {
  phase: number;
  amplitude: number;
  spread?: number;
  clock: number;
  mobile: boolean;
  geometryKey: string;
  landColor: string;
  landOpacity: number;
  bounds: {
    cx: number;
    cy: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  globe: (point: Vec3) => Vec3;
  project: (point: Vec3) => {
    x: number;
    y: number;
    z: number;
    perspective: number;
  };
  material: { fill: number; edge: number; glint: number };
};
const gray = (color: number, alpha: number) =>
  `rgba(${Math.round(color)},${Math.round(color)},${Math.round(color)},${alpha})`;
type Screen = ReturnType<ContinentalFrame["project"]>;
/** Clip each physical outline against the horizon before filling it. This avoids
 * thousands of interior triangles, hairline seams and back-side ghost polygons. */
function visibleContour(
  contour: number[],
  vertices: Vec3[],
  points: Screen[],
  project: ContinentalFrame["project"],
) {
  const result: Screen[] = [];
  for (let i = 1; i < contour.length; i++) {
    const ai = contour[i - 1],
      bi = contour[i],
      a = vertices[ai],
      b = vertices[bi];
    if (a.z >= 0.015) result.push(points[ai]);
    if (a.z >= 0.015 !== b.z >= 0.015) {
      const t = (0.015 - a.z) / (b.z - a.z);
      result.push(
        project({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: 0.015,
        }),
      );
    }
  }
  return result;
}
function projectPlates(plates: ContinentalPlate[], frame: ContinentalFrame) {
  const geometry = [];
  for (let index = 0; index < plates.length; index++) {
    const plate = plates[index],
      local = continentalPose(
        plate,
        frame.phase,
        index,
        frame.amplitude,
        frame.clock,
        frame.spread,
      );
    // Compose rotations once per shard instead of repeating them for every vertex.
    const pose = {
      ...local,
      center: frame.globe(local.center),
      x: frame.globe(local.x),
      y: frame.globe(local.y),
      z: frame.globe(local.z),
    };
    if (pose.center.z + plate.radius < -0.02) continue;
    const normal = frame.globe(local.normal);
    const vertices = plate.vertices.map((p) =>
      transformContinentalPoint(p, pose),
    );
    const thickness = 0.016 * continentalAmount(frame.phase, index);
    const backs = vertices.map((p) =>
      frame.project({
        x: p.x - normal.x * thickness,
        y: p.y - normal.y * thickness,
        z: p.z - normal.z * thickness,
      }),
    );
    const dots: { screen: Screen; size: number }[][] = [[], [], [], []];
    for (const p of plate.dots) {
      const point = transformContinentalPoint(p, pose);
      const n = frame.globe(
        rotate(
          normalized({
            x: p.x * (1 - local.flatten) + plate.normal.x * local.flatten,
            y: p.y * (1 - local.flatten) + plate.normal.y * local.flatten,
            z: p.z * (1 - local.flatten) + plate.normal.z * local.flatten,
          }),
          local.local,
        ),
      );
      if (point.z < 0.015 || n.z < -0.07) continue;
      const depth = clamp((n.z + 0.08) / 1.08),
        screen = frame.project(point);
      dots[Math.min(3, Math.floor(depth * 3.999))].push({
        screen,
        size:
          // The same dot as on the globe, so land keeps its colour as it lifts.
          (frame.mobile ? 1.02 : 1.32) *
          (0.57 + depth * 0.65) *
          screen.perspective,
      });
    }
    const points = vertices.map(frame.project);
    const surfaces = plate.contours.map((contour) =>
      visibleContour(contour, vertices, points, frame.project),
    );
    geometry.push({
      plate,
      vertices,
      points,
      surfaces,
      backs,
      dots,
      normal,
      depth: pose.center.z,
    });
  }
  geometry.sort((a, b) => a.depth - b.depth);
  const { cx, cy, left, right, top, bottom } = frame.bounds;
  let l = 1,
    r = 1,
    t = 1,
    b = 1;
  for (const shard of geometry)
    for (const p of shard.points)
      if (p.z > 0) {
        l = Math.max(l, cx - p.x);
        r = Math.max(r, p.x - cx);
        t = Math.max(t, cy - p.y);
        b = Math.max(b, p.y - cy);
      }
  const fit = Math.min(
    1,
    (cx - left) / l,
    (right - cx) / r,
    (cy - top) / t,
    (bottom - cy) / b,
  );
  if (fit < 1)
    for (const shard of geometry) {
      const scale = (p: Screen) => {
        p.x = cx + (p.x - cx) * fit;
        p.y = cy + (p.y - cy) * fit;
      };
      // Clipped contours share their original vertices. Transform each screen point once.
      new Set([
        ...shard.points,
        ...shard.surfaces.flat(),
        ...shard.backs,
      ]).forEach(scale);
      for (const bucket of shard.dots)
        for (const d of bucket) {
          scale(d.screen);
          d.size *= fit;
        }
    }
  return geometry;
}
export function createContinentalRenderer(land: readonly GeoVertex[]) {
  let plates = createContinentalPlates(land);
  let geometry: ReturnType<typeof projectPlates> = [],
    key = "";
  return {
    destroy() {
      plates = [];
      geometry = [];
      key = "";
    },
    draw(ctx: CanvasRenderingContext2D, frame: ContinentalFrame) {
      const reveal =
        smooth(0, 0.13, frame.phase) * (1 - smooth(0.91, 1, frame.phase));
      if (reveal <= 0 || !plates.length) return;
      const nextKey = `${frame.geometryKey}/${frame.amplitude}/${frame.spread ?? 1}`;
      if (key !== nextKey) {
        key = nextKey;
        geometry = projectPlates(plates, frame);
      }
      ctx.save();
      ctx.globalAlpha *= reveal;
      const light = normalized({ x: -0.38, y: 0.56, z: 0.82 });
      for (const {
        plate,
        vertices,
        points,
        surfaces,
        backs,
        dots,
        normal,
      } of geometry) {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        ctx.beginPath();
        for (const surface of surfaces) {
          if (surface.length < 3) continue;
          surface.forEach((p, j) => {
            if (j) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });
          ctx.closePath();
        }
        if (!Number.isFinite(minX)) continue;
        const facing = Math.abs(normal.z),
          specular = Math.max(0, dot(normal, light)) ** 6;
        const strength =
          (normal.z < 0 ? 0.45 : 1) *
          (0.18 + specular * 0.56 + (1 - facing) * 0.18);
        const h = maxY - minY;
        const reflection = ctx.createLinearGradient(
          minX,
          minY + h * (0.25 + normal.x * 0.25),
          maxX,
          maxY - h * (0.25 + normal.y * 0.25),
        );
        const edge = clamp(
          0.5 +
            normal.x * 0.17 +
            Math.sin(frame.clock * 0.24 + plate.seed * 19) * 0.09,
          0.25,
          0.75,
        );
        reflection.addColorStop(0, gray(frame.material.fill * 0.24, 0.2));
        reflection.addColorStop(edge - 0.18, gray(frame.material.fill, 0.045));
        reflection.addColorStop(
          edge - 0.035,
          gray(frame.material.glint, strength * 0.4),
        );
        reflection.addColorStop(edge, gray(frame.material.glint, strength));
        reflection.addColorStop(
          edge + 0.065,
          gray(frame.material.fill, strength * 0.24),
        );
        reflection.addColorStop(
          edge + 0.22,
          gray(frame.material.fill * 0.1, 0.2),
        );
        reflection.addColorStop(
          1,
          gray(frame.material.fill, 0.1 + (1 - facing) * 0.1),
        );
        ctx.fillStyle = reflection;
        ctx.fill("evenodd");
        ctx.beginPath();
        for (const contour of plate.contours)
          for (let i = 1; i < contour.length; i++) {
            const a = contour[i - 1],
              b = contour[i];
            if (vertices[a].z < 0.02 || vertices[b].z < 0.02) continue;
            ctx.moveTo(points[a].x, points[a].y);
            ctx.lineTo(points[b].x, points[b].y);
            ctx.lineTo(backs[b].x, backs[b].y);
            ctx.lineTo(backs[a].x, backs[a].y);
            ctx.closePath();
          }
        ctx.fillStyle = gray(frame.material.glint, 0.15 + (1 - facing) * 0.35);
        ctx.fill();
        ctx.beginPath();
        for (const contour of plate.contours) {
          let drawing = false;
          for (const index of contour) {
            if (vertices[index].z < 0.025) {
              drawing = false;
              continue;
            }
            const p = points[index];
            if (drawing) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
            drawing = true;
          }
        }
        ctx.strokeStyle = gray(frame.material.edge, 0.22 + specular * 0.3);
        ctx.lineWidth = frame.mobile ? 0.65 : 0.85;
        ctx.stroke();
        ctx.strokeStyle = gray(frame.material.glint, 0.1 + (1 - facing) * 0.25);
        ctx.lineWidth = frame.mobile ? 0.3 : 0.45;
        ctx.stroke();
        ctx.fillStyle = frame.landColor;
        for (let i = 0; i < dots.length; i++) {
          ctx.save();
          ctx.globalAlpha *= (0.18 + i * 0.2) * frame.landOpacity;
          ctx.beginPath();
          for (const { screen: p, size } of dots[i]) {
            ctx.moveTo(p.x + size, p.y);
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    },
  };
}
