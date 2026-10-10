import {
  clamp,
  mix,
  noise,
  rotate,
  rotation,
  smooth,
  spherePoint,
  type Vec3,
} from "./earth-geometry";
import { researchBlend } from "./scene-progress";

type Projected = Vec3 & { perspective: number };
type DrawingContext =
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type LayerFrame = {
  amount: number;
  clock: number;
  mobile: boolean;
  dark: number;
  poseKey: number;
  plane(point: Vec3): Vec3;
  project(point: Vec3): Projected;
  globe(point: Vec3): Vec3;
};
type Vertex = { u: number; v: number; height: number };
type Sample = { plane: Vec3; sphere: Vec3 };
const view = rotation(-0.62, 0.58, -0.045);
const elevation = (u: number, v: number) => {
  const ridge = Math.exp(
    -Math.pow(v + 0.35 * Math.sin(u * 3) - u * 0.32, 2) * 13,
  );
  const folds = Math.pow(
    (Math.sin(u * 12 + Math.sin(v * 9) * 1.6) + 1) * 0.5,
    2,
  );
  return (
    0.04 +
    ridge * (0.15 + folds * 0.23) +
    0.05 * Math.sin(u * 21 - v * 17) * Math.sin(v * 23)
  );
};
// These endpoints do not change during the animation. Only their transform and
// interpolation change; do not repeat terrain/trigonometry work for each frame.
const sample = (u: number, v: number, layer: number, extra = 0): Sample => {
  const lift =
    layer === 0
      ? elevation(u, v)
      : layer === 1
        ? 0.06 * Math.sin(u * 6) * Math.cos(v * 7)
        : 0;
  return {
    plane: rotate(
      { x: u * 1.3, y: (layer - 1) * 0.91 + lift + extra, z: v * 1.3 },
      view,
    ),
    sphere: spherePoint(u * Math.PI, v * Math.PI * 0.48, 1 + layer * 0.012),
  };
};
const terrainColors = (
  shade: number,
  seed: number,
  dark: number,
): [string, string] => {
  const value = Math.round(mix(64 + shade * 140, 18 + shade * 94, dark));
  const secondary = value + (seed - 0.5) * 22;
  return [
    `rgba(${value},${value},${value},.94)`,
    `rgba(${secondary},${secondary},${secondary},.94)`,
  ];
};
const layerInk = (dark: number) =>
  [49, 47, 45].map((value) => Math.round(mix(value, 235, dark))).join(",");

/** A procedural landscape, flux surface and embedding field — not measured elevation data. */
export function createResearchLayers() {
  let resolution = 0;
  let cache: OffscreenCanvas | null = null;
  let cacheKey = "";
  let vertices: Vertex[] = [];
  let sheetGeometry: Sample[][] = [];
  let cells: {
    a: number;
    b: number;
    c: number;
    d: number;
    seed: number;
    shade: number;
    depth: number;
    light: [string, string];
    dark: [string, string];
  }[] = [];
  const nodes = Array.from({ length: 64 }, (_, i) => ({
    u: (noise(i * 7 + 3) * 2 - 1) * 0.91,
    v: (noise(i * 7 + 11) * 2 - 1) * 0.91,
    lift: 0.08 + noise(i * 7 + 25) * 0.36,
  }));
  nodes.push({ u: 0.8, v: -0.78, lift: 0.24 });
  const build = (mobile: boolean) => {
    const count = mobile ? 28 : 48;
    if (resolution === count) return;
    resolution = count;
    vertices = [];
    cells = [];
    for (let row = 0; row <= count; row++)
      for (let col = 0; col <= count; col++) {
        const u = (col / count) * 2 - 1,
          v = (row / count) * 2 - 1;
        vertices.push({ u, v, height: elevation(u, v) });
      }
    sheetGeometry = [0, 1, 2].map((layer) =>
      vertices.map((vertex) => sample(vertex.u, vertex.v, layer)),
    );
    for (let row = 0; row < count; row++)
      for (let col = 0; col < count; col++) {
        const a = row * (count + 1) + col,
          b = a + 1,
          c = b + count + 1,
          d = c - 1;
        const slope = (vertices[b].height - vertices[d].height) * count;
        const shade = clamp(0.54 + slope * 0.16, 0.08, 0.98),
          seed = noise(a + 923);
        cells.push({
          a,
          b,
          c,
          d,
          seed,
          shade,
          light: terrainColors(shade, seed, 0),
          dark: terrainColors(shade, seed, 1),
          depth: rotate({ x: vertices[a].u, y: 0, z: vertices[a].v }, view).z,
        });
      }
    cells.sort((a, b) => a.depth - b.depth);
  };
  const sampleWorld = (sample: Sample, frame: LayerFrame): Vec3 => {
    const plane = frame.plane(sample.plane);
    const unfold = smooth(0, 0.86, frame.amount);
    // The open sheets no longer depend on the hidden rotating globe. Avoid
    // thousands of discarded transforms; keep the full fold below this endpoint.
    if (unfold === 1) return plane;
    const globe = frame.globe(sample.sphere);
    return {
      x: mix(globe.x, plane.x, unfold),
      y: mix(globe.y, plane.y, unfold),
      z: mix(globe.z, plane.z, unfold),
    };
  };
  const world = (
    u: number,
    v: number,
    layer: number,
    frame: LayerFrame,
    extra = 0,
  ) => sampleWorld(sample(u, v, layer, extra), frame);
  const point = (
    u: number,
    v: number,
    layer: number,
    frame: LayerFrame,
    extra = 0,
  ) => frame.project(world(u, v, layer, frame, extra));
  const anchor = (index: number, frame: LayerFrame) => {
    const positions = [
      [0.8, -0.78, 2, 0.24],
      [0.55, -0.75, 1, 0],
      [-0.25, 0.9, 1, 0],
      [-0.25, 0.9, 0, 0],
    ];
    const [u, v, layer, extra] = positions[index];
    return point(u, v, layer, frame, extra);
  };
  const drawScene = (ctx: DrawingContext, frame: LayerFrame) => {
    const { lines: alpha, surfaces } = researchBlend(frame.amount);
    if (alpha < 0.001) return;
    build(frame.mobile);
    const dark = clamp(frame.dark);
    const ink = layerInk(dark);
    const sheets = sheetGeometry.map((layer) =>
      layer.map((vertex) => frame.project(sampleWorld(vertex, frame))),
    );
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    const polygon = (
      a: Projected,
      b: Projected,
      c: Projected,
      d?: Projected,
    ) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      if (d) ctx.lineTo(d.x, d.y);
      ctx.closePath();
    };
    // Directional shading makes the lowest sheet a terrain surface, not another flat disc.
    const lineAlpha = ctx.globalAlpha;
    if (surfaces > 0) {
      ctx.globalAlpha = lineAlpha * surfaces;
      const terrainCells = [...cells].sort(
        (a, b) =>
          sheets[0][a.a].z +
          sheets[0][a.c].z -
          sheets[0][b.a].z -
          sheets[0][b.c].z,
      );
      for (const cell of terrainCells) {
        const colors =
          dark === 1
            ? cell.dark
            : dark === 0
              ? cell.light
              : terrainColors(cell.shade, cell.seed, dark);
        polygon(sheets[0][cell.a], sheets[0][cell.b], sheets[0][cell.c]);
        ctx.fillStyle = colors[0];
        ctx.fill();
        polygon(sheets[0][cell.a], sheets[0][cell.c], sheets[0][cell.d]);
        ctx.fillStyle = colors[1];
        ctx.fill();
      }
      ctx.globalAlpha = lineAlpha;
    }
    for (let layer = 0; layer < 3; layer++) {
      const points = sheets[layer],
        n = resolution;
      if (layer > 0 && surfaces > 0) {
        ctx.globalAlpha = lineAlpha * surfaces;
        polygon(points[0], points[n], points.at(-1)!, points[n * (n + 1)]);
        const tone = Math.round(mix(255, 80, dark));
        ctx.fillStyle = `rgba(${tone},${tone},${tone},${mix(0.14, 0.055, dark)})`;
        ctx.fill();
        ctx.globalAlpha = lineAlpha;
      }
      ctx.beginPath();
      const step = layer === 0 ? 1 : 2;
      for (let row = 0; row <= n; row += step)
        for (let col = 0; col <= n; col++) {
          const p = points[row * (n + 1) + col];
          if (col) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        }
      for (let col = 0; col <= n; col += step)
        for (let row = 0; row <= n; row++) {
          const p = points[row * (n + 1) + col];
          if (row) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        }
      ctx.strokeStyle = `rgba(${ink},${layer === 0 ? 0.15 : 0.3})`;
      ctx.lineWidth = 0.55;
      ctx.stroke();
      polygon(points[0], points[n], points.at(-1)!, points[n * (n + 1)]);
      ctx.strokeStyle = `rgba(${ink},.5)`;
      ctx.lineWidth = 0.85;
      ctx.stroke();
      if (layer === 2 && surfaces > 0) {
        ctx.globalAlpha = lineAlpha * surfaces;
        for (const cell of cells) {
          if (cell.seed < 0.72) continue;
          polygon(
            points[cell.a],
            points[cell.b],
            points[cell.c],
            points[cell.d],
          );
          ctx.fillStyle = `rgba(${ink},${0.13 + cell.seed * 0.43})`;
          ctx.fill();
        }
        ctx.globalAlpha = lineAlpha;
      }
      // Fine vertical registrations link the same sample across the successive surfaces.
      if (layer < 2) {
        ctx.beginPath();
        for (let i = 0; i < nodes.length; i += frame.mobile ? 4 : 2) {
          const node = nodes[i],
            a = point(node.u, node.v, layer, frame),
            b = point(node.u, node.v, layer + 1, frame);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.setLineDash([1, 3]);
        ctx.strokeStyle = `rgba(${ink},.32)`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Curved paths rise from the landscape into the flux surface, with moving observations.
      if (layer === 1)
        for (let i = 0; i < (frame.mobile ? 5 : 10); i++) {
          const source = nodes[i * 3],
            destination = nodes[i * 3 + 1];
          const from = world(source.u, source.v, 0, frame),
            to = world(destination.u, destination.v, 1, frame);
          const curve = (t: number) =>
            frame.project({
              x: mix(from.x, to.x, t),
              y:
                mix(from.y, to.y, t) +
                Math.sin(t * Math.PI) * 0.4 * frame.amount,
              z: mix(from.z, to.z, t),
            });
          ctx.beginPath();
          for (let j = 0; j <= 22; j++) {
            const p = curve(j / 22);
            if (j) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
          }
          ctx.strokeStyle = `rgba(${ink},.45)`;
          ctx.lineWidth = 0.75;
          ctx.stroke();
        }
    }
    for (let i = 0; i < nodes.length; i += frame.mobile ? 2 : 1) {
      const node = nodes[i],
        a = point(node.u, node.v, 2, frame),
        b = point(node.u, node.v, 2, frame, node.lift);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.setLineDash([1, 2]);
      ctx.strokeStyle = `rgba(${ink},.38)`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.setLineDash([]);
      const size = (frame.mobile ? 1.5 : 2.2) + noise(i + 193) * 2.3;
      ctx.fillStyle = `rgba(${ink},.55)`;
      ctx.fillRect(b.x - size / 2, b.y - size / 2, size, size);
    }
    ctx.restore();
  };
  const draw = (ctx: CanvasRenderingContext2D, frame: LayerFrame) => {
    if (frame.amount < 0.001) return;
    // The full-size field is static. Rasterize its thousands of shaded triangles
    // once; ongoing frames contain only the observation pulses and sample heads.
    if (frame.amount >= 0.86 && typeof OffscreenCanvas !== "undefined") {
      const origin = frame.project({ x: 0, y: 0, z: 0 }),
        corner = frame.project({ x: 1, y: 1, z: 1 });
      const key = [
        ctx.canvas.width,
        ctx.canvas.height,
        frame.poseKey,
        origin.x,
        origin.y,
        corner.x,
        corner.y,
        frame.dark,
        frame.mobile,
      ].join("/");
      if (key !== cacheKey) {
        if (!cache)
          cache = new OffscreenCanvas(ctx.canvas.width, ctx.canvas.height);
        cache.width = ctx.canvas.width;
        cache.height = ctx.canvas.height;
        const layerContext = cache.getContext("2d");
        if (layerContext) {
          layerContext.setTransform(ctx.getTransform());
          drawScene(layerContext, frame);
          cacheKey = key;
        }
      }
      if (cache && cacheKey === key) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(cache, 0, 0);
        ctx.restore();
      } else drawScene(ctx, frame);
    } else drawScene(ctx, frame);
    const alpha = researchBlend(frame.amount).lines,
      ink = layerInk(clamp(frame.dark));
    ctx.save();
    ctx.globalAlpha *= alpha;
    for (let i = 0; i < (frame.mobile ? 5 : 10); i++) {
      const source = nodes[i * 3],
        destination = nodes[i * 3 + 1];
      const from = world(source.u, source.v, 0, frame),
        to = world(destination.u, destination.v, 1, frame);
      const t = (frame.clock * 0.11 + i * 0.19) % 1;
      const p = frame.project({
        x: mix(from.x, to.x, t),
        y: mix(from.y, to.y, t) + Math.sin(t * Math.PI) * 0.4 * frame.amount,
        z: mix(from.z, to.z, t),
      });
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${ink},.9)`;
      ctx.fill();
    }
    for (let i = 0; i < nodes.length; i += frame.mobile ? 2 : 1) {
      const node = nodes[i],
        p = point(node.u, node.v, 2, frame, node.lift);
      const size = (frame.mobile ? 1.5 : 2.2) + noise(i + 193) * 2.3;
      ctx.fillStyle = `rgba(${ink},${0.4 * Math.sin(frame.clock * 0.45 + i) ** 2})`;
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.restore();
  };
  const destroy = () => {
    // Release the backing store immediately, including browsers with delayed GC.
    if (cache) {
      cache.width = 1;
      cache.height = 1;
    }
    cache = null;
    cacheKey = "";
    resolution = 0;
    vertices = [];
    cells = [];
    sheetGeometry = [];
  };
  return { draw, anchor, destroy };
}
