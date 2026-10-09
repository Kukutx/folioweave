import { smooth } from "./motion";

export type Vec3 = { x: number; y: number; z: number };
export type GeoVertex = Vec3 & { lon: number; lat: number };
export type GlassFace = {
  points: [GeoVertex, GeoVertex, GeoVertex];
  center: Vec3;
  normal: Vec3;
  seed: number;
  band: number;
};

export const TAU = Math.PI * 2;
export const noise = (seed: number) => {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
};

export function spherePoint(lon: number, lat: number, radius = 1): GeoVertex {
  const ring = Math.cos(lat) * radius;
  return {
    x: Math.sin(lon) * ring,
    y: Math.sin(lat) * radius,
    z: Math.cos(lon) * ring,
    lon,
    lat,
  };
}

export function normalized(v: Vec3): Vec3 {
  const size = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / size, y: v.y / size, z: v.z / size };
}

export type Rotation = {
  cy: number;
  sy: number;
  cp: number;
  sp: number;
  cr: number;
  sr: number;
  preCp?: number;
  preSp?: number;
};

export function rotation(yaw: number, pitch: number, roll = 0): Rotation {
  return {
    cy: Math.cos(yaw),
    sy: Math.sin(yaw),
    cp: Math.cos(pitch),
    sp: Math.sin(pitch),
    cr: Math.cos(roll),
    sr: Math.sin(roll),
  };
}

/** Turn about the globe's Y axis when closed and the rings' Z axis when open.
 * Tilt the axis, not the elapsed angle: seeking after a long visit must not
 * unwind the entire animation clock through the assembly. */
export function axialRotation(
  angle: number,
  opening: number,
  pitch = 0,
  roll = 0,
): Rotation {
  if (opening <= 0) return rotation(angle, pitch, roll);
  const tilt = (Math.min(1, Math.max(0, opening)) * Math.PI) / 2;
  return {
    ...rotation(angle, pitch + tilt, roll),
    preCp: Math.cos(tilt),
    preSp: -Math.sin(tilt),
  };
}

/** Keep separated slices turning in their ring planes until they are close
 * enough to become one globe; tilting them early swells the fitting envelope. */
export const toolsSpinOpening = (split: number) => smooth(0, 0.35, split);

export function rotate(point: Vec3, r: Rotation): Vec3 {
  if (r.preCp !== undefined && r.preSp !== undefined) {
    point = {
      x: point.x,
      y: point.y * r.preCp - point.z * r.preSp,
      z: point.y * r.preSp + point.z * r.preCp,
    };
  }
  const x = point.x * r.cy + point.z * r.sy;
  const z = point.z * r.cy - point.x * r.sy;
  const y = point.y * r.cp - z * r.sp;
  const depth = point.y * r.sp + z * r.cp;
  return { x: x * r.cr - y * r.sr, y: x * r.sr + y * r.cr, z: depth };
}

/** Jittered glass triangles. The four depth bands share the scene's Z axis. */
export function createGlassShell(columns: number, rows: number): GlassFace[] {
  const grid: GeoVertex[][] = [];
  for (let row = 0; row <= rows; row++) {
    const ring: GeoVertex[] = [];
    for (let col = 0; col <= columns; col++) {
      const seam = col === 0 || col === columns;
      const pole = row === 0 || row === rows;
      const seed = row * columns + (col === columns ? 0 : col);
      const lon =
        -Math.PI +
        (col / columns) * TAU +
        (seam || pole
          ? 0
          : (((noise(seed + 13) - 0.5) * TAU) / columns) * 0.46);
      const lat =
        -Math.PI / 2 +
        (row / rows) * Math.PI +
        (pole ? 0 : (((noise(seed + 67) - 0.5) * Math.PI) / rows) * 0.36);
      ring.push(spherePoint(lon, lat));
    }
    grid.push(ring);
  }

  const faces: GlassFace[] = [];
  const add = (a: GeoVertex, b: GeoVertex, c: GeoVertex) => {
    const center = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3,
      z: (a.z + b.z + c.z) / 3,
    };
    faces.push({
      points: [a, b, c],
      center,
      normal: normalized(center),
      seed: noise(faces.length + 91),
      band: Math.min(3, Math.max(0, Math.floor((center.z + 1) * 2))),
    });
  };
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const a = grid[row][col],
        b = grid[row][col + 1];
      const c = grid[row + 1][col],
        d = grid[row + 1][col + 1];
      if (row === 0) add(a, d, c);
      else if (row === rows - 1) add(a, b, c);
      else if ((row + col) % 2) {
        add(a, b, c);
        add(b, d, c);
      } else {
        add(a, b, d);
        add(a, d, c);
      }
    }
  }
  return faces;
}

export function createGraticule(stepDegrees: number): GeoVertex[][] {
  const lines: GeoVertex[][] = [];
  const step = (stepDegrees * Math.PI) / 180;
  for (let lon = -Math.PI; lon <= Math.PI + 0.001; lon += step) {
    const line: GeoVertex[] = [];
    for (let i = 0; i <= 80; i++)
      line.push(spherePoint(lon, -Math.PI / 2 + (i / 80) * Math.PI));
    lines.push(line);
  }
  for (let lat = -Math.PI / 2 + step; lat < Math.PI / 2 - 0.001; lat += step) {
    const line: GeoVertex[] = [];
    for (let i = 0; i <= 160; i++)
      line.push(spherePoint(-Math.PI + (i / 160) * TAU, lat));
    lines.push(line);
  }
  return lines;
}
export { clamp, mix, smooth } from "./motion";
