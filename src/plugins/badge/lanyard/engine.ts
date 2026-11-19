import * as THREE from "three";
import { paintCardBack, paintCardFace, siteFont, type FaceTheme } from "./face";

/*
 * The lanyard scene: a woven band hanging from above the view, metal
 * hardware at its end and one or more rigid cards on the hook.
 *
 * The band is a chain of JOINTS segments solved in sub-steps of at most
 * MAX_STEP seconds; the front card is a rigid body pinned to the chain's
 * last node. Cards behind it hang from the same hook and swing in its
 * plane as pendulums. Nothing is drawn while everything is at rest or the
 * view is off screen.
 */

export const FINISHES = {
  glossy: { roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, foil: 0, anisotropy: 0 },
  matte: { roughness: 0.85, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.6, foil: 0, anisotropy: 0 },
  holographic: { roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, foil: 1, anisotropy: 0 },
  metallic: { roughness: 0.36, metalness: 0.75, clearcoat: 0.5, clearcoatRoughness: 0.18, foil: 0, anisotropy: 0.7 },
} as const;

export const METALS = {
  silver: { color: "#d9dce2", roughness: 0.16 },
  gold: { color: "#e4b965", roughness: 0.2 },
  graphite: { color: "#4d4f55", roughness: 0.28 },
} as const;

export type Finish = keyof typeof FINISHES;
export type Metal = keyof typeof METALS;

/**
 * A card is its front and back pictures on a card of `cardColor`; without
 * pictures, a face drawn from `logo`, `title`, `kicker` and `description` in
 * the reference's layout; with neither, plain `cardColor`.
 */
export type LanyardCard = {
  frontImage?: string;
  backImage?: string;
  imageFit: "cover" | "contain";
  cardColor: string;
  finish: Finish;
  theme: FaceTheme;
  logo?: string;
  title?: string;
  kicker?: string;
  description?: string;
};

const drawnFace = (card: LanyardCard) =>
  !card.frontImage && Boolean(card.logo || card.title || card.kicker || card.description);

export type LanyardSettings = {
  /** Front to back; at least one. */
  cards: LanyardCard[];
  orientation: "portrait" | "landscape";
  cornerRadius: number;
  size: number;
  anchor: "left" | "center" | "right";
  strapLength: number;
  strapImage?: string;
  strapColor: string;
  strapWidth: number;
  /** One band, or two that meet at the sleeve. */
  strapStyle: "single" | "v";
  /** How fast the two bands of a V part above the sleeve (width per height). */
  strapSpread: number;
  /** A sleeve, D-ring and lobster clasp through a round hole, or a clamp
   * and ring through a slot. */
  hardware: "clasp" | "ring";
  metal: Metal;
  gravity: number;
  damping: number;
  elasticity: number;
  breeze: number;
  interactive: boolean;
  intro: boolean;
  /** The side the cards swing in from when `intro` is on. */
  introFrom: "left" | "right";
  /** A soft shadow cast behind the band and cards. */
  shadow: boolean;
};

export type LanyardScene = {
  /** Read the settings again and apply what changed. */
  apply: () => void;
  /** Turn the cards over, as a tap does (for the keyboard). */
  flip: () => void;
  dispose: () => void;
};

const CARD_SIZES = {
  portrait: [1.6, 2.125],
  landscape: [2.125, 1.6],
} as const;
const ANCHORS = { left: 0.27, center: 0.5, right: 0.73 } as const;
const THICKNESS = 0.018;
const BEVEL = 0.007;
const JOINTS = 4;
const NODE_WEIGHT = 1 / 0.05;
const MAX_STEP = 1 / 960;
const ITERATIONS = 2;
const SAMPLES = 72;
const FOV = 24;
const STRAP_WIDTH = 0.36;
const FACE_WIDTH = 1024;

// The clamp and ring hardware.
const RING_RADIUS = 0.095;
const RING_TUBE = 0.0135;
const EYELET_RADIUS = 0.036;
const CLAMP_BODY = 0.15;

// The clasp hardware, measured on the reference with the card 1.6 wide. The
// pivot is the swivel's foot: heights above it run up the band, depths
// below it run down the card.
const HOLE_RADIUS = 0.042;
const HOLE_DROP = 0.088;
const HOOK_DROP = 0.39;
const SLEEVE_BOTTOM = 0.37;
const SLEEVE_HEIGHT = 0.345;
const SLEEVE_TOP = SLEEVE_BOTTOM + SLEEVE_HEIGHT;
const D_RING = { y: 0.15, width: 0.39, height: 0.16, tube: 0.022 };
const SWIVEL = { radius: 0.03, height: 0.11, flange: 0.046 };
const WIRE = 0.026;
/** The clasp's plane, in front of the card's face. */
const CLASP_FRONT = THICKNESS / 2 + BEVEL + WIRE + 0.004;
/** The clasp is a dark cast of the sleeve's metal (gunmetal for silver). */
const CLASP_SHADE = 0.36;
/** The sleeve is brushed: rougher than the polished metal. */
const SLEEVE_ROUGHNESS = 0.3;
/** And a little warmer than the polished metal, as on the reference. */
const SLEEVE_TINT = { color: "#cfc9bf", amount: 0.4 };
/** The sleeve's depth front to back. */
const SLEEVE_DEPTH = 0.14;
/** Gap between cards on one hook; where each further card's hole sits on
 * the hook (right and down), and how it leans at rest, all as measured on
 * the reference's back card. */
const CARD_GAP = 0.006;
const CARD_SHIFT = { x: 0.034, y: -0.012 };
const CARD_LEAN = 0.023;

// The cast shadow, measured on the reference: offset and blur in scene
// units, darkness where it is deepest.
const SHADOW = { x: 0.08, y: 0.05, blur: 0.07, alpha: 0.3 };

/** A V's bands narrow to this share of their width where they enter the
 * sleeve, over this length of band above it (as on the reference). */
const V_NARROW = 0.55;
const V_GATHER = 0.6;

const BAND_COLUMNS = [0, 0.07, 0.93, 1];
const BAND_BEND = [-0.95, -0.28, 0.28, 0.95];
const FLIP_SPIN = 9;

const FOIL_VERTEX_HEAD = `
varying vec2 vFoilUv;
varying vec3 vFoilX;
varying vec3 vFoilY;
`;

const FOIL_VERTEX_BODY = `
vFoilUv = uv;
vFoilX = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
vFoilY = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
`;

const FOIL_FRAGMENT_HEAD = `
uniform float foilStrength;
uniform float foilAspect;
uniform vec3 foilKey;
uniform vec3 foilFill;
uniform vec3 foilTop;
varying vec2 vFoilUv;
varying vec3 vFoilX;
varying vec3 vFoilY;

float foilHash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float foilBump(float t, float center, float width) {
  float x = (t - center) / width;
  return max(0.0, 1.0 - x * x);
}

vec3 foilSpectrum(float t) {
  return vec3(
    foilBump(t, 0.82, 0.32) + 0.4 * foilBump(t, 0.02, 0.12),
    foilBump(t, 0.5, 0.26),
    foilBump(t, 0.18, 0.24)
  );
}

vec3 foilGrating(float u, float spacing) {
  vec3 color = vec3(0.0);
  for (int m = 1; m <= 2; m++) {
    float order = float(m);
    float t = (spacing * abs(u) / order - 0.38) / 0.32;
    color += foilSpectrum(t) / order;
  }
  return color;
}

vec3 foilShard(vec2 p) {
  vec2 base = floor(p);
  float best = 9.0;
  float edge = 9.0;
  vec2 id = base;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = base + vec2(float(i), float(j));
      vec2 site = cell + vec2(foilHash(cell), foilHash(cell + 7.31)) * 0.9 + 0.05;
      float d = length(site - p);
      if (d < best) {
        edge = best;
        best = d;
        id = cell;
      } else if (d < edge) {
        edge = d;
      }
    }
  }
  return vec3(foilHash(id + 3.17), foilHash(id + 11.73), edge - best);
}
`;

const FOIL_FRAGMENT_BODY = `
if (foilStrength > 0.0) {
  vec3 foilView = normalize(vViewPosition);
  vec3 foilNormal = normalize(normal);
  vec2 foilP = vec2(vFoilUv.x, vFoilUv.y * foilAspect);
  vec3 shard = foilShard(foilP * 26.0);
  vec2 ray = foilP - vec2(-1.6, 2.6 * foilAspect);
  float angle = atan(ray.y, ray.x) + (shard.x - 0.5) * 0.16;
  vec3 grating = normalize(vFoilX * cos(angle) + vFoilY * sin(angle));
  float spacing = 1.7 * (0.95 + shard.y * 0.1);
  vec3 rainbow = foilGrating(dot(foilKey + foilView, grating), spacing);
  rainbow += 0.6 * foilGrating(dot(foilTop + foilView, grating), spacing);
  rainbow *= 0.8 + 0.2 * smoothstep(0.0, 0.04, shard.z);
  rainbow = max(rainbow - 0.35 * min(rainbow.r, min(rainbow.g, rainbow.b)), 0.0);
  vec2 grid = foilP * 64.0;
  vec2 cell = floor(grid);
  vec2 jitter = vec2(foilHash(cell + 1.7), foilHash(cell + 9.2));
  float flake = smoothstep(0.32, 0.06, length(fract(grid) - jitter * 0.6 - 0.2)) * step(0.45, foilHash(cell + 4.4));
  vec3 facet = normalize(foilNormal + (vFoilX * (jitter.x - 0.5) + vFoilY * (jitter.y - 0.5)) * 0.8);
  float glint = pow(max(dot(reflect(-foilKey, facet), foilView), 0.0), 28.0);
  glint += 0.7 * pow(max(dot(reflect(-foilTop, facet), foilView), 0.0), 28.0);
  float fine = 1.0 - smoothstep(0.35, 0.9, max(fwidth(grid.x), fwidth(grid.y)));
  vec3 sparkle = flake * glint * fine * (vec3(0.7) + foilGrating(dot(foilKey + foilView, grating) + jitter.x * 0.4, spacing));
  float ink = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float foil = foilStrength * (0.08 + 0.92 * smoothstep(0.04, 0.7, ink));
  float facing = clamp(dot(foilNormal, foilView), 0.0, 1.0);
  float tint = clamp(dot(rainbow, vec3(0.4)), 0.0, 1.0);
  outgoingLight = outgoingLight * (1.0 - foil * (0.3 + 0.32 * tint)) + (rainbow * 0.62 * (0.4 + 0.6 * facing) + sparkle * 1.6) * foil;
}
`;

type Rgb = [number, number, number];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

const parseColor = (value: string, fallback: Rgb): Rgb => {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return fallback;
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    const resolved = String(ctx.fillStyle);
    if (resolved.startsWith("#")) {
      const n = parseInt(resolved.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    const parts = resolved.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return fallback;
    return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255];
  } catch {
    return fallback;
  }
};

const luminance = (rgb: Rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
const toCss = (rgb: Rgb, alpha = 1) =>
  `rgba(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)}, ${alpha})`;

const seeded = (start: number) => {
  let state = start >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const traceRoundedRect = (
  path: THREE.Path,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const k = r * 0.4477;
  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  path.bezierCurveTo(x + width - k, y, x + width, y + k, x + width, y + r);
  path.lineTo(x + width, y + height - r);
  path.bezierCurveTo(x + width, y + height - k, x + width - k, y + height, x + width - r, y + height);
  path.lineTo(x + r, y + height);
  path.bezierCurveTo(x + k, y + height, x, y + height - k, x, y + height - r);
  path.lineTo(x, y + r);
  path.bezierCurveTo(x, y + k, x + k, y, x + r, y);
};

const loadImage = (
  cache: Map<string, Promise<HTMLImageElement | null>>,
  url?: string,
) => {
  if (!url) return Promise.resolve(null);
  const cached = cache.get(url);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
  cache.set(url, promise);
  return promise;
};

type Layout = {
  width: number;
  height: number;
  radius: number;
  hardware: LanyardSettings["hardware"];
  /** Slot for the ring, or round hole for the clasp. */
  slot: { width: number; height: number; y: number };
  hole: { radius: number; y: number };
  ringY: number;
  /** Where the card hangs from, from its centre: up, and towards its front
   * (the clasp rides in front of the card, in line with the band). */
  hangY: number;
  hangZ: number;
  /** Rigid hardware above the pivot: where the band enters it, and how far
   * into it the band is drawn. */
  reach: number;
  tuck: number;
};

const cardLayout = (
  orientation: LanyardSettings["orientation"],
  cornerRadius: number,
  hardware: LanyardSettings["hardware"],
): Layout => {
  const [width, height] = CARD_SIZES[orientation] ?? CARD_SIZES.portrait;
  const radius = mix(0.03, Math.min(width, height) * 0.2, clamp(cornerRadius, 0, 1));
  const slot = { width: 0.34, height: 0.07, y: height / 2 - 0.13 };
  const hole = { radius: HOLE_RADIUS, y: height / 2 - HOLE_DROP };
  const ringY = height / 2 - 0.055;
  if (hardware === "ring")
    return {
      width,
      height,
      radius,
      hardware,
      slot,
      hole,
      ringY,
      hangY: ringY + RING_RADIUS,
      hangZ: 0,
      reach: EYELET_RADIUS + CLAMP_BODY + 0.05,
      tuck: EYELET_RADIUS + CLAMP_BODY * 0.35,
    };
  return {
    width,
    height,
    radius,
    hardware,
    slot,
    hole,
    ringY,
    hangY: hole.y + HOOK_DROP,
    hangZ: CLASP_FRONT,
    reach: SLEEVE_TOP + 0.05,
    tuck: SLEEVE_TOP - SLEEVE_HEIGHT * 0.65,
  };
};

const buildCardGeometry = (layout: Layout) => {
  const { width, height, radius, slot, hole } = layout;
  const outline = new THREE.Shape();
  traceRoundedRect(
    outline,
    -width / 2 + BEVEL,
    -height / 2 + BEVEL,
    width - BEVEL * 2,
    height - BEVEL * 2,
    Math.max(radius - BEVEL, 0.005),
  );
  const opening = new THREE.Path();
  if (layout.hardware === "ring")
    traceRoundedRect(
      opening,
      -slot.width / 2 - BEVEL,
      slot.y - slot.height / 2 - BEVEL,
      slot.width + BEVEL * 2,
      slot.height + BEVEL * 2,
      slot.height / 2 + BEVEL,
    );
  else opening.absarc(0, hole.y, hole.radius + BEVEL, 0, Math.PI * 2, true);
  outline.holes.push(opening);
  const body = new THREE.ExtrudeGeometry(outline, {
    depth: THICKNESS,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 5,
    curveSegments: 24,
  });
  body.translate(0, 0, -THICKNESS / 2);
  const face = new THREE.ShapeGeometry(outline, 24);
  const position = face.getAttribute("position");
  const uv = face.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + width / 2) / width, (position.getY(i) + height / 2) / height);
  }
  uv.needsUpdate = true;
  return { body, face };
};

const buildClampGeometry = (width: number, body = CLAMP_BODY) => {
  const shape = new THREE.Shape();
  const w = width * 1.16;
  traceRoundedRect(shape, -w / 2 + 0.014, -body / 2 + 0.014, w - 0.028, body - 0.028, 0.024);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 6,
    curveSegments: 10,
  });
  geometry.translate(0, 0, -0.01);
  return geometry;
};

/** The sleeve: curved across its face, so light rolls off its sides. */
const buildSleeveGeometry = (width: number) => {
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 1, false);
  geometry.scale(width * 1.16, SLEEVE_HEIGHT, SLEEVE_DEPTH);
  return geometry;
};

/** A D-ring: straight bar on top for the band, rounded below for the swivel. */
const buildDRingGeometry = () => {
  const { width, height, tube } = D_RING;
  const w = width / 2 - tube;
  const h = height / 2 - tube;
  const r = h * 0.98;
  const path = new THREE.CurvePath<THREE.Vector3>();
  const at = (x: number, y: number) => new THREE.Vector3(x, y, 0);
  path.add(new THREE.LineCurve3(at(-w + r, h), at(w - r, h)));
  path.add(new THREE.CubicBezierCurve3(at(w - r, h), at(w, h), at(w, h), at(w, h - r)));
  path.add(new THREE.CubicBezierCurve3(at(w, h - r), at(w, -h), at(w * 0.5, -h), at(0, -h)));
  path.add(new THREE.CubicBezierCurve3(at(0, -h), at(-w * 0.5, -h), at(-w, -h), at(-w, h - r)));
  path.add(new THREE.CubicBezierCurve3(at(-w, h - r), at(-w, h), at(-w, h), at(-w + r, h)));
  return new THREE.TubeGeometry(path, 96, tube, 12, true);
};

/**
 * The lobster clasp around its pivot (the swivel's foot, in line with the
 * band): a cast claw in front of the cards whose wire runs back through
 * their holes, so they hang on it. `depth` is how far behind the front card
 * the last card sits.
 */
const buildClaspGeometry = (layout: Layout, depth: number) => {
  // Card planes relative to the pivot: the front card's face, and behind the
  // last card.
  const face = -CLASP_FRONT + THICKNESS / 2 + BEVEL;
  const behind = -2 * CLASP_FRONT - depth;
  const top = layout.height / 2 - layout.hangY;
  const hole = layout.hole.y - layout.hangY;
  const tube = (points: number[][], radius: number) =>
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        false,
        "centripetal",
      ),
      64,
      radius,
      12,
      false,
    );

  // The cast body under the swivel, with its small hole.
  const body = new THREE.Shape();
  body.moveTo(-0.026, 0);
  body.lineTo(0.026, 0);
  body.bezierCurveTo(0.05, -0.03, 0.09, -0.07, 0.085, -0.12);
  body.bezierCurveTo(0.08, -0.15, 0.04, -0.155, 0.02, -0.14);
  body.lineTo(-0.03, -0.14);
  body.bezierCurveTo(-0.055, -0.15, -0.075, -0.13, -0.07, -0.1);
  body.bezierCurveTo(-0.06, -0.06, -0.04, -0.03, -0.026, 0);
  const eye = new THREE.Path();
  eye.absarc(0, -0.1, 0.014, 0, Math.PI * 2, true);
  body.holes.push(eye);
  const cast = new THREE.ExtrudeGeometry(body, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 4,
    curveSegments: 16,
  });
  cast.translate(0, 0, -0.008);

  // The thumb lever on the gate's side.
  const leverShape = new THREE.Shape();
  leverShape.moveTo(0.07, -0.095);
  leverShape.bezierCurveTo(0.095, -0.095, 0.125, -0.105, 0.128, -0.122);
  leverShape.bezierCurveTo(0.125, -0.14, 0.1, -0.142, 0.075, -0.135);
  leverShape.lineTo(0.07, -0.095);
  const lever = new THREE.ExtrudeGeometry(leverShape, {
    depth: 0.01,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 12,
  });
  lever.translate(0, 0, -0.005);

  // The hook: down the right in front of the card, curling left into the
  // hole and through to the back.
  const hook = tube(
    [
      [0.06, -0.13, 0],
      [0.11, -0.21, 0],
      [0.12, hole + 0.06, 0],
      [0.075, hole - 0.028, 0],
      // Inside the hole, clear of its rim (hole radius > offset + wire).
      [0.008, hole - 0.008, face - 0.004],
      [0, hole - 0.004, -CLASP_FRONT],
      [-0.012, hole, behind],
      [-0.03, hole + 0.02, behind],
    ],
    WIRE * 1.15,
  );
  // The gate: a thinner wire down the left, passing behind the cards above
  // their top edge to meet the hook's tip.
  const gate = tube(
    [
      [-0.05, -0.13, 0],
      [-0.12, -0.21, -0.004],
      [-0.145, top + 0.012, face + 0.01],
      [-0.15, top - 0.03, behind],
      [-0.11, hole + 0.01, behind],
      [-0.035, hole + 0.022, behind],
    ],
    WIRE * 0.6,
  );
  const swivel = new THREE.CylinderGeometry(SWIVEL.radius, SWIVEL.radius * 0.8, SWIVEL.height, 18);
  swivel.translate(0, SWIVEL.height / 2 - 0.01, 0);
  const flange = new THREE.CylinderGeometry(SWIVEL.flange, SWIVEL.flange, 0.02, 24);
  flange.translate(0, SWIVEL.height * 0.45, 0);
  return [cast, lever, hook, gate, swivel, flange];
};

const buildBandGeometry = (count: number) => {
  const columns = BAND_COLUMNS.length;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * columns * 3), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(count * columns * 3), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * columns * 2), 2));
  const index: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    for (let c = 0; c < columns - 1; c++) {
      const a = i * columns + c;
      index.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  geometry.setIndex(index);
  return geometry;
};

const buildEnvironment = (renderer: THREE.WebGLRenderer) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.035, 0.035, 0.04);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials: THREE.Material[] = [];
  const panel = (
    intensity: number,
    position: [number, number, number],
    scale: [number, number],
    rotation = 0,
  ) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(intensity, intensity, intensity),
      side: THREE.DoubleSide,
    });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(scale[0], scale[1], 1);
    mesh.lookAt(0, 0, 0);
    mesh.rotateZ(rotation);
    scene.add(mesh);
  };
  panel(2.6, [0, 4.5, 8], [9, 4]);
  panel(6, [-5.5, 0.5, 7], [0.9, 14]);
  panel(4, [5, -0.5, 8], [0.6, 14]);
  panel(3.5, [0, -1, 9], [24, 0.35], Math.PI / 3);
  panel(2.5, [1, 2.5, 9], [24, 0.2], Math.PI / 3);
  panel(1.4, [0, 6, -6], [12, 4]);
  panel(0.5, [0, -7, 1], [16, 6]);
  panel(0.9, [8, 0, -2], [4, 10]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  geometry.dispose();
  materials.forEach((material) => material.dispose());
  return target;
};

const makeCanvasTexture = (canvas: HTMLCanvasElement, anisotropy: number) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
};

const buildGrainTexture = () => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const random = seeded(7);
  const field = Float32Array.from({ length: size * size }, () => random());
  const height = (x: number, y: number) => {
    let sum = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) sum += field[((y + j + size) % size) * size + ((x + i + size) % size)];
    }
    return (sum / 9) * 1.6;
  };
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = height((x - 1 + size) % size, y) - height((x + 1) % size, y);
      const ny = height(x, (y - 1 + size) % size) - height(x, (y + 1) % size);
      const length = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      image.data[i] = ((nx / length) * 0.5 + 0.5) * 255;
      image.data[i + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      image.data[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 7);
  return texture;
};

const buildWeaveTexture = () => {
  const size = 128;
  const threads = 8;
  const random = seeded(19);
  const fiber = Float32Array.from({ length: size * size }, () => random());
  const profile = (f: number) => Math.sqrt(Math.max(0, 1 - 4 * f * f));
  const height = (x: number, y: number) => {
    const px = ((x % size) + size) % size;
    const py = ((y % size) + size) % size;
    const u = (px / size) * threads;
    const v = (py / size) * threads;
    const cu = Math.floor(u);
    const cv = Math.floor(v);
    const fu = u - cu - 0.5;
    const fv = v - cv - 0.5;
    const lift = (cu + cv) % 2 === 0;
    const warp = profile(fu) * (0.55 + 0.45 * Math.cos(fv * Math.PI * (lift ? 1 : 0.6)));
    const weft = profile(fv) * (0.55 + 0.45 * Math.cos(fu * Math.PI * (lift ? 0.6 : 1)));
    return (lift ? Math.max(warp, weft * 0.7) : Math.max(weft, warp * 0.7)) + fiber[py * size + px] * 0.08;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (height(x - 1, y) - height(x + 1, y)) * 1.6;
      const ny = (height(x, y - 1) - height(x, y + 1)) * 1.6;
      const length = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      data[i] = ((nx / length) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

const drawFitted = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  fit: LanyardCard["imageFit"],
) => {
  const scale = (fit === "contain" ? Math.min : Math.max)(width / image.width, height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
};

const paintFace = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | null,
  color: Rgb,
  fit: LanyardCard["imageFit"],
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = toCss(color);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (image) drawFitted(ctx, image, canvas.width, canvas.height, fit);
};

const paintStrap = (canvas: HTMLCanvasElement, image: HTMLImageElement | null, color: Rgb) => {
  const across = 192;
  const along = image ? Math.max(64, Math.round((image.width / image.height) * across)) : across * 2;
  canvas.width = across;
  canvas.height = along;
  const ctx = canvas.getContext("2d");
  if (!ctx) return along / across;
  ctx.fillStyle = toCss(color);
  ctx.fillRect(0, 0, across, along);
  if (image) {
    ctx.save();
    ctx.translate(across, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(image, 0, 0, along, across);
    ctx.restore();
    return along / across;
  }
  const ink: Rgb = luminance(color) > 0.5 ? [0, 0, 0] : [1, 1, 1];
  ctx.fillStyle = toCss(ink, 0.05);
  for (let y = 0; y < along; y += 4) ctx.fillRect(0, y, across, 1);
  ctx.fillStyle = toCss(ink, 0.2);
  for (let y = 0; y < along; y += 14) {
    ctx.fillRect(across * 0.075, y, 2, 8);
    ctx.fillRect(across * 0.925 - 2, y, 2, 8);
  }
  return along / across;
};

type Body = {
  position: THREE.Vector3;
  previous: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  previousQuaternion: THREE.Quaternion;
  angular: THREE.Vector3;
  mass: number;
  inverseInertia: THREE.Vector3;
  hang: THREE.Vector3;
};

type Grab = {
  /** 0 for the front card; a card behind swings on the hook as it is held. */
  card: number;
  local: THREE.Vector3;
  rotation: THREE.Quaternion;
  reach: number;
  from: THREE.Vector3;
  target: THREE.Vector3;
  /** A card behind: its hole relative to the hook, in the front card's frame. */
  pivot: THREE.Vector3;
  /** A card behind: the held point relative to its hole, in its own frame. */
  arm: THREE.Vector3;
};

/** A card behind the front one: an angle in the front card's plane. */
type Swing = { angle: number; spin: number };

type Simulation = {
  nodes: THREE.Vector3[];
  previous: THREE.Vector3[];
  velocities: THREE.Vector3[];
  lengths: Float64Array;
  impulses: Float64Array;
  rest: number;
  anchor: THREE.Vector3;
  body: Body;
  grab: Grab | null;
  turn: number;
  twist: number;
  twistRaw: number;
  calm: number;
  swings: Swing[];
  /** The hook's motion, smoothed, felt by the cards behind. */
  hook: {
    velocity: THREE.Vector3;
    acceleration: THREE.Vector3;
    spin: number;
    spinRate: number;
  };
};

type Physics = {
  gravity: number;
  hold: number;
  stiffness: number;
  spring: number;
  bandDamping: number;
  linearDrag: number;
  angularDrag: number;
  air: number;
  broadside: number;
  spinAir: number;
  nodeDrag: number;
  nodeAir: number;
  twist: number;
  twistDamping: number;
  grip: number;
  gripDamping: number;
  breeze: number;
};

const createSimulation = (): Simulation => {
  const vectors = () => Array.from({ length: JOINTS + 1 }, () => new THREE.Vector3());
  return {
    nodes: vectors(),
    previous: vectors(),
    velocities: vectors(),
    lengths: new Float64Array(JOINTS),
    impulses: new Float64Array(JOINTS),
    rest: 1,
    anchor: new THREE.Vector3(),
    body: {
      position: new THREE.Vector3(),
      previous: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      previousQuaternion: new THREE.Quaternion(),
      angular: new THREE.Vector3(),
      mass: 1,
      inverseInertia: new THREE.Vector3(1, 1, 1),
      hang: new THREE.Vector3(),
    },
    grab: null,
    turn: 0,
    twist: 0,
    twistRaw: 0,
    calm: 0,
    swings: [],
    hook: {
      velocity: new THREE.Vector3(),
      acceleration: new THREE.Vector3(),
      spin: 0,
      spinRate: 0,
    },
  };
};

const scratch = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
  d: new THREE.Vector3(),
  e: new THREE.Vector3(),
  f: new THREE.Vector3(),
  g: new THREE.Vector3(),
  pin: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  r: new THREE.Quaternion(),
};

const applyInverseInertia = (body: Body, vector: THREE.Vector3, out: THREE.Vector3) => {
  scratch.r.copy(body.quaternion).invert();
  out.copy(vector).applyQuaternion(scratch.r);
  out.set(out.x * body.inverseInertia.x, out.y * body.inverseInertia.y, out.z * body.inverseInertia.z);
  return out.applyQuaternion(body.quaternion);
};

const rotateBody = (q: THREE.Quaternion, w: THREE.Vector3) => {
  const { x: qx, y: qy, z: qz, w: qw } = q;
  q.x += 0.5 * (w.x * qw + w.y * qz - w.z * qy);
  q.y += 0.5 * (w.y * qw + w.z * qx - w.x * qz);
  q.z += 0.5 * (w.z * qw + w.x * qy - w.y * qx);
  q.w += 0.5 * (-w.x * qx - w.y * qy - w.z * qz);
  q.normalize();
};

const bodyWeight = (body: Body, r: THREE.Vector3, normal: THREE.Vector3) => {
  const rn = scratch.c.crossVectors(r, normal);
  return 1 / body.mass + rn.dot(applyInverseInertia(body, rn, scratch.d));
};

const pushBody = (body: Body, r: THREE.Vector3, impulse: THREE.Vector3) => {
  body.position.addScaledVector(impulse, 1 / body.mass);
  rotateBody(body.quaternion, applyInverseInertia(body, scratch.e.crossVectors(r, impulse), scratch.f));
};

const solveSegment = (sim: Simulation, i: number, h: number, physics: Physics) => {
  const { nodes, body } = sim;
  const a = nodes[i];
  const wa = i === 0 ? 0 : NODE_WEIGHT;
  const last = i === JOINTS - 1;
  const r = scratch.g;
  let b = nodes[i + 1];
  if (last) {
    r.copy(body.hang).applyQuaternion(body.quaternion);
    b = scratch.b.copy(body.position).add(r);
  }
  const delta = scratch.a.subVectors(b, a);
  const length = delta.length();
  const stretch = length - sim.rest;
  if (stretch <= 0 || length < 1e-9) return;
  const normal = delta.divideScalar(length);
  const wb = last ? bodyWeight(body, r, normal) : NODE_WEIGHT;
  const rate = (length - sim.lengths[i]) / h;
  const tension =
    physics.hold * Math.tanh((physics.stiffness * stretch) / physics.hold) +
    physics.spring * stretch +
    physics.bandDamping * Math.max(0, rate);
  const room = tension * h * h - sim.impulses[i];
  if (room <= 0) return;
  const lambda = Math.min(stretch / (wa + wb), room);
  sim.impulses[i] += lambda;
  if (wa) a.addScaledVector(normal, lambda * wa);
  if (last) pushBody(body, r, normal.multiplyScalar(-lambda));
  else b.addScaledVector(normal, -lambda * wb);
};

const solvePin = (body: Body, local: THREE.Vector3, target: THREE.Vector3) => {
  const r = scratch.g.copy(local).applyQuaternion(body.quaternion);
  const delta = scratch.a.copy(target).sub(body.position).sub(r);
  const distance = delta.length();
  if (distance < 1e-9) return;
  const normal = delta.divideScalar(distance);
  const lambda = distance / bodyWeight(body, r, normal);
  pushBody(body, r, normal.multiplyScalar(lambda));
};

const held = {
  pivot: new THREE.Vector3(),
  reach: new THREE.Vector3(),
  hook: new THREE.Vector3(),
  q: new THREE.Quaternion(),
};

/** Where a held card behind hangs from, in the world. */
const heldPivot = (body: Body, grab: Grab) =>
  held.pivot.copy(body.hang).add(grab.pivot).applyQuaternion(body.quaternion).add(body.position);

/**
 * A card behind is held like a pendulum by its edge: it turns on the hook
 * towards the hand (swingCards), and once the hand is further from the hook
 * than the held point, it pulls the hook, and the whole lanyard, after it.
 */
const pullHook = (body: Body, grab: Grab, target: THREE.Vector3) => {
  const pivot = heldPivot(body, grab);
  const reach = held.reach.subVectors(target, pivot);
  const distance = reach.length();
  const radius = grab.arm.length();
  if (distance <= radius || distance < 1e-9) return;
  // Move the hole to within the held point's reach of the hand.
  const hook = held.hook
    .copy(target)
    .addScaledVector(reach, -radius / distance)
    .sub(held.reach.copy(grab.pivot).applyQuaternion(body.quaternion));
  solvePin(body, body.hang, hook);
};

/** How quickly a held card behind turns to the hand (seconds). */
const HOLD_FOLLOW = 0.016;

const placeHanging = (
  sim: Simulation,
  layout: Layout,
  intro: boolean,
  from: LanyardSettings["introFrom"] = "right",
) => {
  const { nodes, previous, velocities, body, anchor } = sim;
  const side = from === "left" ? -1 : 1;
  nodes[0].copy(anchor);
  for (let i = 1; i <= JOINTS; i++) {
    nodes[i].copy(nodes[i - 1]);
    if (intro) nodes[i].x += sim.rest * side;
    else nodes[i].y -= sim.rest;
  }
  body.quaternion.identity();
  if (intro) body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (Math.PI / 2) * side);
  body.hang.set(0, layout.hangY, layout.hangZ);
  const offset = scratch.a.copy(body.hang).applyQuaternion(body.quaternion);
  body.position.copy(nodes[JOINTS]).sub(offset);
  body.previous.copy(body.position);
  body.previousQuaternion.copy(body.quaternion);
  body.velocity.set(0, 0, 0);
  body.angular.set(0, 0, 0);
  for (let i = 0; i <= JOINTS; i++) {
    previous[i].copy(nodes[i]);
    velocities[i].set(0, 0, 0);
  }
  sim.lengths.fill(sim.rest);
  sim.turn = 0;
  sim.twist = 0;
  sim.twistRaw = 0;
  sim.calm = 0;
  for (const swing of sim.swings) {
    swing.angle = CARD_LEAN;
    swing.spin = 0;
  }
  sim.hook.velocity.set(0, 0, 0);
  sim.hook.acceleration.set(0, 0, 0);
  sim.hook.spin = 0;
  sim.hook.spinRate = 0;
};

const configureSimulation = (sim: Simulation, layout: Layout, length: number) => {
  sim.rest = length / JOINTS;
  const { width, height } = layout;
  const body = sim.body;
  const t = THICKNESS + BEVEL * 2;
  body.mass = 1;
  body.inverseInertia.set(
    12 / (height * height + t * t),
    12 / (width * width + t * t),
    12 / (width * width + height * height),
  );
  body.hang.set(0, layout.hangY, layout.hangZ);
};

const stepSimulation = (
  sim: Simulation,
  dt: number,
  physics: Physics,
  time: number,
  layout: Layout,
) => {
  const steps = Math.max(1, Math.ceil(dt / MAX_STEP - 1e-6));
  const h = dt / steps;
  const { nodes, previous, velocities, body } = sim;
  const windX = physics.breeze * (Math.sin(time * 0.53) * 0.7 + Math.sin(time * 1.31 + 1.7) * 0.3) * 3;
  const windZ = physics.breeze * Math.sin(time * 0.37 + 0.6) * 2;
  const grab = sim.grab;
  const pin = scratch.pin;
  const nodeDrag = Math.exp(-physics.nodeDrag * h);
  const linearDrag = Math.exp(-physics.linearDrag * h);
  const angularDrag = Math.exp(-physics.angularDrag * h);

  for (let s = 0; s < steps; s++) {
    for (let i = 1; i < JOINTS; i++) {
      const v = velocities[i];
      v.y -= physics.gravity * h;
      v.x += windX * h;
      v.z += windZ * h;
      previous[i].copy(nodes[i]);
      nodes[i].addScaledVector(v, h);
    }

    body.previous.copy(body.position);
    body.previousQuaternion.copy(body.quaternion);
    const q = body.quaternion;
    // Holding the front card keeps it turned as it was taken.
    if (grab && grab.card === 0) {
      const turn = scratch.q.copy(grab.rotation).multiply(scratch.r.copy(q).invert());
      if (turn.w < 0) turn.set(-turn.x, -turn.y, -turn.z, -turn.w);
      const torque = scratch.a.set(turn.x, turn.y, turn.z).multiplyScalar(2 * physics.grip);
      torque.addScaledVector(body.angular, -physics.gripDamping);
      body.angular.addScaledVector(applyInverseInertia(body, torque, scratch.b), h);
    }
    const up = scratch.a.set(0, 1, 0).applyQuaternion(q);
    const front = scratch.b.set(-up.x * up.z, -up.y * up.z, 1 - up.z * up.z);
    if (front.lengthSq() > 1e-3) {
      const facing = scratch.d.set(0, 0, 1).applyQuaternion(q);
      const raw = Math.atan2(scratch.e.crossVectors(front, facing).dot(up), front.dot(facing));
      let turned = raw - sim.twistRaw;
      if (turned > Math.PI) turned -= Math.PI * 2;
      else if (turned < -Math.PI) turned += Math.PI * 2;
      sim.twist += turned;
      sim.twistRaw = raw;
    }
    if (!grab || grab.card > 0) {
      const spin = body.angular.dot(up);
      body.angular.addScaledVector(up, (physics.twist * (sim.turn - sim.twist) - physics.twistDamping * spin) * h);
    }
    body.velocity.y -= physics.gravity * h;
    body.velocity.x += windX * 0.35 * h;
    body.velocity.z += windZ * 0.35 * h;
    body.position.addScaledVector(body.velocity, h);
    rotateBody(body.quaternion, scratch.f.copy(body.angular).multiplyScalar(h));

    sim.impulses.fill(0);
    if (grab) pin.lerpVectors(grab.from, grab.target, (s + 1) / steps);
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      for (let i = 0; i < JOINTS; i++) solveSegment(sim, i, h, physics);
      if (grab?.card === 0) solvePin(body, grab.local, pin);
      else if (grab) pullHook(body, grab, pin);
    }

    for (let i = 1; i < JOINTS; i++) {
      const v = velocities[i].subVectors(nodes[i], previous[i]).divideScalar(h).multiplyScalar(nodeDrag);
      v.multiplyScalar(1 / (1 + physics.nodeAir * v.length() * h));
    }
    body.velocity.subVectors(body.position, body.previous).divideScalar(h);
    const dq = scratch.q.copy(body.previousQuaternion).invert().premultiply(body.quaternion);
    body.angular.set(dq.x, dq.y, dq.z).multiplyScalar((2 / h) * (dq.w < 0 ? -1 : 1));

    const normal = scratch.a.set(0, 0, 1).applyQuaternion(body.quaternion);
    const across = body.velocity.dot(normal);
    const along = scratch.b.copy(body.velocity).addScaledVector(normal, -across);
    along.multiplyScalar(1 / (1 + physics.air * along.length() * h));
    body.velocity
      .copy(along)
      .addScaledVector(normal, across / (1 + physics.broadside * Math.abs(across) * h))
      .multiplyScalar(linearDrag);
    body.angular.multiplyScalar(angularDrag / (1 + physics.spinAir * body.angular.length() * h));
    if (body.velocity.lengthSq() > 3600) body.velocity.setLength(60);
    if (body.angular.lengthSq() > 1600) body.angular.setLength(40);

    nodes[JOINTS].copy(body.hang).applyQuaternion(body.quaternion).add(body.position);
    for (let i = 0; i < JOINTS; i++) sim.lengths[i] = nodes[i].distanceTo(nodes[i + 1]);

    if (sim.swings.length) swingCards(sim, h, physics, layout, angularDrag, pin);
  }

  if (grab) grab.from.copy(grab.target);

  let energy = body.velocity.lengthSq() + body.angular.lengthSq() * 0.3;
  for (let i = 1; i < JOINTS; i++) energy += velocities[i].lengthSq() * 0.05;
  for (const swing of sim.swings) energy += swing.spin * swing.spin * 0.3;
  sim.calm = energy < 2e-4 ? sim.calm + dt : 0;
};

/** How quickly the hook's measured motion is followed (seconds). */
const HOOK_SMOOTHING = 0.012;

/**
 * Cards behind the front one hang from the same hook and swing in the front
 * card's plane: a pendulum about the hook that feels gravity, the hook's
 * acceleration and the front card turning in its plane.
 */
const swingCards = (
  sim: Simulation,
  h: number,
  physics: Physics,
  layout: Layout,
  angularDrag: number,
  pin: THREE.Vector3,
) => {
  const { body, hook, grab } = sim;
  const follow = 1 - Math.exp(-h / HOOK_SMOOTHING);
  // Velocity of the hook point; its change is the acceleration it imparts.
  const r = scratch.a.copy(body.hang).applyQuaternion(body.quaternion);
  const velocity = scratch.b.crossVectors(body.angular, r).add(body.velocity);
  const acceleration = scratch.c.subVectors(velocity, hook.velocity).divideScalar(h);
  hook.velocity.copy(velocity);
  hook.acceleration.lerp(acceleration, follow);
  const normal = scratch.d.set(0, 0, 1).applyQuaternion(body.quaternion);
  const spin = body.angular.dot(normal);
  hook.spinRate += ((spin - hook.spin) / h - hook.spinRate) * follow;
  hook.spin = spin;
  // Gravity as the hook feels it, in the front card's frame.
  const felt = scratch.e
    .set(0, -physics.gravity, 0)
    .sub(hook.acceleration)
    .applyQuaternion(scratch.r.copy(body.quaternion).invert());
  const d = layout.hangY;
  const inertia = d * d + (layout.width * layout.width + layout.height * layout.height) / 12;
  const holding = grab && grab.card > 0 ? sim.swings[grab.card - 1] : null;
  for (const swing of sim.swings) {
    if (swing === holding) continue;
    const lean = swing.angle - CARD_LEAN;
    const torque = d * (Math.sin(lean) * felt.y + Math.cos(lean) * felt.x);
    swing.spin += (torque / inertia - hook.spinRate) * h;
    swing.spin *= angularDrag;
    swing.angle = clamp(swing.angle + swing.spin * h, -Math.PI / 2, Math.PI / 2);
  }
  if (!holding || !grab) return;
  // The held card turns on the hook so the held point heads for the hand;
  // its turning rate carries on as a swing once it is let go.
  const toward = held.reach
    .subVectors(pin, heldPivot(body, grab))
    .applyQuaternion(held.q.copy(body.quaternion).invert());
  let turn = Math.atan2(toward.y, toward.x) - Math.atan2(grab.arm.y, grab.arm.x) - holding.angle;
  turn -= Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
  const next = clamp(holding.angle + turn * (1 - Math.exp(-h / HOLD_FOLLOW)), -Math.PI / 2, Math.PI / 2);
  holding.spin = (next - holding.angle) / h;
  holding.angle = next;
};

const settingsPhysics = (s: LanyardSettings, reducedMotion: boolean): Physics => {
  const gravity = 40 * clamp(s.gravity, 0, 3);
  const weight = Math.max(gravity, 20);
  const springy = clamp(s.elasticity, 0, 1);
  const settle = clamp(s.damping, 0, 1);
  return {
    gravity,
    hold: weight * mix(2.2, 5.5, springy),
    stiffness: weight * 10 * JOINTS,
    spring: weight * mix(0.1, 0.4, springy) * JOINTS,
    bandDamping: weight * mix(0.3, 0.08, springy) * JOINTS,
    linearDrag: 0.25 * Math.pow(16, settle),
    angularDrag: 0.5 * Math.pow(12, settle),
    air: 0.15,
    broadside: 0.5,
    spinAir: 0.03,
    nodeDrag: 2,
    nodeAir: 0.2,
    twist: 30,
    twistDamping: 3,
    grip: 40,
    gripDamping: 6,
    breeze: reducedMotion ? 0 : clamp(s.breeze, 0, 1),
  };
};

type CardParts = {
  group: THREE.Group;
  body: THREE.Mesh;
  front: THREE.Mesh;
  back: THREE.Mesh;
  frontCanvas: HTMLCanvasElement;
  backCanvas: HTMLCanvasElement;
  frontTexture: THREE.CanvasTexture;
  backTexture: THREE.CanvasTexture;
  frontMaterial: THREE.MeshPhysicalMaterial;
  backMaterial: THREE.MeshPhysicalMaterial;
  edgeMaterial: THREE.MeshPhysicalMaterial;
  images: {
    front: HTMLImageElement | null;
    back: HTMLImageElement | null;
    logo: HTMLImageElement | null;
  };
  imageKey: string;
  faceKey: string;
};

/**
 * Mount the scene in `container` (which it fills). `read` returns the
 * current settings; call `apply` after they change. `onMiss` hears taps
 * beside the cards. Returns null where WebGL is unavailable.
 */
export function mountLanyard(
  container: HTMLElement,
  read: () => LanyardSettings,
  canvasClass: string,
  onMiss?: () => void,
): LanyardScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  const canvas = renderer.domElement;
  canvas.className = canvasClass;
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const environment = buildEnvironment(renderer);
  scene.environment = environment.texture;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(-2.5, 4, 6);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
  fillLight.position.set(3, -1, 4);
  scene.add(keyLight, fillLight);

  const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
  const strapCanvas = document.createElement("canvas");
  const strapTexture = makeCanvasTexture(strapCanvas, anisotropy);
  strapTexture.wrapS = THREE.ClampToEdgeWrapping;
  strapTexture.wrapT = THREE.RepeatWrapping;
  let strapImage: HTMLImageElement | null = null;
  const grain = buildGrainTexture();
  const weave = buildWeaveTexture();
  const foilUniforms = {
    foilStrength: { value: 0 },
    foilAspect: { value: 1.4 },
    foilKey: { value: new THREE.Vector3() },
    foilFill: { value: new THREE.Vector3() },
    foilTop: { value: new THREE.Vector3() },
  };
  // Each card has its own finish, so its own foil strength; the lights are
  // shared.
  const injectFoil = (strength: { value: number }) => (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, foilUniforms, { foilStrength: strength });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${FOIL_VERTEX_HEAD}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${FOIL_VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FOIL_FRAGMENT_HEAD}`)
      .replace("#include <opaque_fragment>", `${FOIL_FRAGMENT_BODY}\n#include <opaque_fragment>`);
  };

  const metalMaterial = new THREE.MeshStandardMaterial({ metalness: 1 });
  const sleeveMaterial = new THREE.MeshPhysicalMaterial({ metalness: 1, anisotropy: 0.8 });
  const sleeveTint = new THREE.Color(SLEEVE_TINT.color);
  const claspMaterial = new THREE.MeshStandardMaterial({ metalness: 1 });
  const bandMaterial = new THREE.MeshPhysicalMaterial({
    map: strapTexture,
    normalMap: weave,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.68,
    sheen: 1,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color(0.32, 0.32, 0.34),
    side: THREE.DoubleSide,
  });

  const cards: CardParts[] = [];
  const foilStrengths: { value: number }[] = [];
  const createCard = (): CardParts => {
    const strength = { value: 0 };
    foilStrengths.push(strength);
    const frontCanvas = document.createElement("canvas");
    const backCanvas = document.createElement("canvas");
    const frontTexture = makeCanvasTexture(frontCanvas, anisotropy);
    const backTexture = makeCanvasTexture(backCanvas, anisotropy);
    const frontMaterial = new THREE.MeshPhysicalMaterial({
      map: frontTexture,
      normalMap: grain,
      normalScale: new THREE.Vector2(0.06, 0.06),
    });
    const backMaterial = new THREE.MeshPhysicalMaterial({
      map: backTexture,
      normalMap: grain,
      normalScale: new THREE.Vector2(0.06, 0.06),
    });
    frontMaterial.onBeforeCompile = injectFoil(strength);
    backMaterial.onBeforeCompile = injectFoil(strength);
    // Printed faces keep their whites, as on the reference; tone mapping
    // would grey them. The band and metal stay tone mapped.
    frontMaterial.toneMapped = false;
    backMaterial.toneMapped = false;
    const edgeMaterial = new THREE.MeshPhysicalMaterial();
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BufferGeometry(), edgeMaterial);
    const front = new THREE.Mesh(new THREE.BufferGeometry(), frontMaterial);
    const back = new THREE.Mesh(new THREE.BufferGeometry(), backMaterial);
    group.add(body, front, back);
    scene.add(group);
    return {
      group,
      body,
      front,
      back,
      frontCanvas,
      backCanvas,
      frontTexture,
      backTexture,
      frontMaterial,
      backMaterial,
      edgeMaterial,
      images: { front: null, back: null, logo: null },
      imageKey: "",
      faceKey: "",
    };
  };
  const disposeCard = (card: CardParts) => {
    scene.remove(card.group);
    [card.body, card.front, card.back].forEach((mesh) => mesh.geometry.dispose());
    [card.frontMaterial, card.backMaterial, card.edgeMaterial].forEach((material) => material.dispose());
    [card.frontTexture, card.backTexture].forEach((texture) => texture.dispose());
  };

  // Hardware riding on the front card: the ring of the clamp style, or the
  // lobster clasp.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 18, 72), metalMaterial);
  ring.rotation.y = Math.PI / 2 - 0.7;
  const claspGroup = new THREE.Group();

  const bands = [buildBandGeometry(SAMPLES), buildBandGeometry(SAMPLES)].map((geometry) => {
    const mesh = new THREE.Mesh(geometry, bandMaterial);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });

  // Hardware riding on the band's end, aligned with it.
  const clampGroup = new THREE.Group();
  const clampMesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(
    buildClampGeometry(STRAP_WIDTH),
    metalMaterial,
  );
  const eyelet = new THREE.Mesh(new THREE.TorusGeometry(EYELET_RADIUS, 0.0105, 14, 40), metalMaterial);
  const dRing = new THREE.Mesh(buildDRingGeometry(), claspMaterial);
  dRing.position.y = D_RING.y;
  // The band below the sleeve, folded round the D-ring's bar.
  const loopGroup = new THREE.Group();
  clampGroup.add(clampMesh, eyelet, dRing, loopGroup);
  scene.add(clampGroup);

  const sim = createSimulation();
  const controls: THREE.Vector3[] = [];
  const mouth = new THREE.Vector3();
  const tuck = new THREE.Vector3();
  const curve = new THREE.CatmullRomCurve3(controls, false, "centripetal");
  const view = { width: 1, height: 1 };
  let layout = cardLayout("portrait", 0.3, "clasp");
  let applied: Partial<{
    layoutKey: string;
    framingKey: string;
    strapImage: string;
    strapColor: string;
    strapScale: number;
    hardwareKey: string;
  }> = {};
  let strapScale = STRAP_WIDTH;
  let tileRatio = 2;
  let pixelsPerUnit = 1;
  let raf = 0;
  let last = performance.now();
  let time = 0;
  let visible = true;
  let alive = true;
  let placed = false;
  let hovering = false;
  let press: { x: number; y: number; time: number; point: THREE.Vector3 } | null = null;
  /** A press that hit no card, to report a tap beside the cards. */
  let miss: { x: number; y: number } | null = null;
  let strapToken = 0;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const start = () => {
    if (raf || !visible || !alive) return;
    sim.calm = 0;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const paintCard = (card: CardParts, face: LanyardCard) => {
    const color = parseColor(face.cardColor, [1, 1, 1]);
    const width = FACE_WIDTH;
    const height = Math.round((FACE_WIDTH * layout.height) / layout.width);
    if (card.frontCanvas.width !== width || card.frontCanvas.height !== height) {
      card.frontCanvas.width = width;
      card.frontCanvas.height = height;
      card.backCanvas.width = width;
      card.backCanvas.height = height;
      card.frontTexture.dispose();
      card.backTexture.dispose();
    }
    if (drawnFace(face)) {
      const drawn = { ...face, logo: card.images.logo };
      paintCardFace(card.frontCanvas, drawn, siteFont());
      if (card.images.back) paintFace(card.backCanvas, card.images.back, color, face.imageFit);
      else paintCardBack(card.backCanvas, drawn);
    } else {
      paintFace(card.frontCanvas, card.images.front, color, face.imageFit);
      paintFace(card.backCanvas, card.images.back || card.images.front, color, face.imageFit);
    }
    card.frontTexture.needsUpdate = true;
    card.backTexture.needsUpdate = true;
    start();
  };

  const repaintStrap = () => {
    const s = read();
    tileRatio = paintStrap(strapCanvas, strapImage, parseColor(s.strapColor, [0.07, 0.07, 0.07]));
    weave.repeat.set(2, 2 * tileRatio);
    strapTexture.dispose();
    strapTexture.needsUpdate = true;
    start();
  };

  const frameView = () => {
    const s = read();
    const aspect = view.width / view.height;
    let viewHeight = layout.height / clamp(s.size, 0.15, 0.9);
    const minimumWidth = layout.width / 0.72;
    if (viewHeight * aspect < minimumWidth) viewHeight = minimumWidth / aspect;
    const viewWidth = viewHeight * aspect;
    pixelsPerUnit = view.height / viewHeight;
    camera.aspect = aspect;
    camera.position.set(0, 0, viewHeight / 2 / Math.tan((FOV * Math.PI) / 360));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    foilUniforms.foilKey.value.set(-2.5, 4, 6).normalize().transformDirection(camera.matrixWorldInverse);
    foilUniforms.foilFill.value.set(3, -1, 4).normalize().transformDirection(camera.matrixWorldInverse);
    foilUniforms.foilTop.value.set(0.5, 4.5, 8).normalize().transformDirection(camera.matrixWorldInverse);
    const anchorX = ((ANCHORS[s.anchor] ?? 0.5) - 0.5) * viewWidth;
    const anchorY = viewHeight / 2 + 0.2;
    const cardTop = viewHeight / 2 - viewHeight * mix(0.12, 0.42, clamp(s.strapLength, 0, 1));
    const hangTop = cardTop + (layout.hangY - layout.height / 2);
    sim.anchor.set(anchorX, anchorY, 0);
    configureSimulation(sim, layout, anchorY - hangTop);
    sim.nodes[0].copy(sim.anchor);
    sim.previous[0].copy(sim.anchor);
  };

  const depthOf = (index: number) => index * (THICKNESS + BEVEL * 2 + CARD_GAP);

  const buildHardware = (s: LanyardSettings, count: number) => {
    claspGroup.children.forEach((child) => (child as THREE.Mesh).geometry.dispose());
    claspGroup.clear();
    loopGroup.children.forEach((child) => (child as THREE.Mesh).geometry.dispose());
    loopGroup.clear();
    const clasp = s.hardware === "clasp";
    ring.visible = !clasp;
    eyelet.visible = !clasp;
    dRing.visible = clasp;
    clampMesh.geometry.dispose();
    clampMesh.geometry = clasp ? buildSleeveGeometry(strapScale) : buildClampGeometry(strapScale);
    clampMesh.material = clasp ? sleeveMaterial : metalMaterial;
    clampMesh.position.y = clasp
      ? SLEEVE_BOTTOM + SLEEVE_HEIGHT / 2
      : EYELET_RADIUS + CLAMP_BODY / 2 - 0.004;
    if (!clasp) return;
    for (const geometry of buildClaspGeometry(layout, depthOf(count - 1)))
      claspGroup.add(new THREE.Mesh(geometry, claspMaterial));
    // Two plies of band from the sleeve down round the D-ring's top bar.
    const bar = D_RING.y + D_RING.height / 2 - D_RING.tube;
    const ply = 0.008;
    const length = SLEEVE_BOTTOM + 0.02 - bar;
    for (const side of [1, -1]) {
      const plane = new THREE.PlaneGeometry(strapScale, length);
      plane.translate(0, bar + length / 2, side * (D_RING.tube + ply));
      if (side < 0) plane.rotateY(Math.PI);
      loopGroup.add(new THREE.Mesh(plane, bandMaterial));
    }
    // Under the bar: the half of the cylinder facing down.
    const fold = new THREE.CylinderGeometry(D_RING.tube + ply, D_RING.tube + ply, strapScale, 16, 1, true, 0, Math.PI);
    fold.rotateZ(-Math.PI / 2);
    fold.translate(0, bar, 0);
    loopGroup.add(new THREE.Mesh(fold, bandMaterial));
  };

  const syncCards = (s: LanyardSettings, layoutChanged: boolean) => {
    const wanted = Math.max(1, s.cards.length);
    while (cards.length > wanted) {
      disposeCard(cards.pop()!);
      foilStrengths.pop();
    }
    while (cards.length < wanted) {
      cards.push(createCard());
      layoutChanged = true;
    }
    while (sim.swings.length < wanted - 1) sim.swings.push({ angle: CARD_LEAN, spin: 0 });
    sim.swings.length = wanted - 1;
    if (layoutChanged) {
      const geometry = buildCardGeometry(layout);
      cards.forEach((card, index) => {
        card.body.geometry.dispose();
        card.front.geometry.dispose();
        card.back.geometry.dispose();
        card.body.geometry = index ? geometry.body.clone() : geometry.body;
        card.front.geometry = index ? geometry.face.clone() : geometry.face;
        card.back.geometry = geometry.face.clone();
        card.front.position.z = THICKNESS / 2 + BEVEL + 0.0006;
        card.back.rotation.y = Math.PI;
        card.back.position.z = -(THICKNESS / 2 + BEVEL + 0.0006);
        card.faceKey = "";
      });
      cards[0].group.add(ring, claspGroup);
      ring.position.set(0, layout.ringY, 0);
      claspGroup.position.set(0, layout.hangY, layout.hangZ);
    }
    cards.forEach((card, index) => {
      const face = s.cards[index] ?? s.cards[0];
      const finish = FINISHES[face.finish] ?? FINISHES.glossy;
      const color = parseColor(face.cardColor, [1, 1, 1]);
      [card.frontMaterial, card.backMaterial].forEach((material) => {
        material.roughness = finish.roughness;
        material.metalness = finish.metalness;
        material.clearcoat = finish.clearcoat;
        material.clearcoatRoughness = finish.clearcoatRoughness;
        material.anisotropy = finish.anisotropy;
      });
      foilStrengths[index].value = finish.foil;
      card.edgeMaterial.color.setRGB(color[0] * 0.92, color[1] * 0.92, color[2] * 0.92, THREE.SRGBColorSpace);
      card.edgeMaterial.roughness = Math.min(finish.roughness, 0.35);
      card.edgeMaterial.metalness = finish.metalness;
      card.edgeMaterial.clearcoat = 1;
      card.edgeMaterial.clearcoatRoughness = 0.08;
      const imageKey = `${face.frontImage}|${face.backImage}|${face.logo}`;
      if (imageKey !== card.imageKey) {
        card.imageKey = imageKey;
        void Promise.all([
          loadImage(imageCache, face.frontImage),
          loadImage(imageCache, face.backImage),
          loadImage(imageCache, face.logo),
        ]).then(([front, back, logo]) => {
          if (!alive || card.imageKey !== imageKey) return;
          card.images.front = front;
          card.images.back = back;
          card.images.logo = logo;
          paintCard(card, read().cards[cards.indexOf(card)] ?? face);
        });
      }
      const faceKey = [
        layout.width,
        layout.height,
        face.cardColor,
        face.imageFit,
        face.theme,
        face.title,
        face.kicker,
        face.description,
      ].join("|");
      if (faceKey !== card.faceKey) {
        card.faceKey = faceKey;
        paintCard(card, face);
      }
    });
  };

  const apply = () => {
    const s = read();
    const layoutKey = `${s.orientation}|${s.cornerRadius}|${s.hardware}`;
    const layoutChanged = layoutKey !== applied.layoutKey;
    if (layoutChanged) {
      layout = cardLayout(s.orientation, s.cornerRadius, s.hardware);
      applied.framingKey = "";
    }
    syncCards(s, layoutChanged);
    foilUniforms.foilAspect.value = layout.height / layout.width;

    const framingKey = `${layoutKey}|${s.size}|${s.anchor}|${s.strapLength}|${view.width}|${view.height}`;
    if (framingKey !== applied.framingKey) {
      frameView();
      if (!placed) {
        placeHanging(sim, layout, s.intro && !reducedMotion, s.introFrom);
        placed = true;
      } else if (layoutChanged) {
        placeHanging(sim, layout, false);
      }
    }

    if (s.strapImage !== applied.strapImage) {
      const token = ++strapToken;
      void loadImage(imageCache, s.strapImage).then((image) => {
        if (!alive || token !== strapToken) return;
        strapImage = image;
        repaintStrap();
      });
    }
    if (s.strapColor !== applied.strapColor) repaintStrap();

    const metalLook = METALS[s.metal] ?? METALS.silver;
    metalMaterial.color.set(metalLook.color);
    metalMaterial.roughness = metalLook.roughness;
    claspMaterial.color.set(metalLook.color).multiplyScalar(CLASP_SHADE);
    claspMaterial.roughness = metalLook.roughness;
    sleeveMaterial.color.set(metalLook.color).lerp(sleeveTint, SLEEVE_TINT.amount);
    sleeveMaterial.roughness = Math.max(metalLook.roughness, SLEEVE_ROUGHNESS);
    strapScale = STRAP_WIDTH * clamp(s.strapWidth, 0.4, 2);
    const hardwareKey = `${s.hardware}|${strapScale}|${layoutKey}|${cards.length}`;
    if (hardwareKey !== applied.hardwareKey) buildHardware(s, cards.length);
    bands[1].visible = s.strapStyle === "v";
    canvas.style.touchAction = s.interactive ? "pan-y" : "auto";
    canvas.style.filter = s.shadow
      ? `drop-shadow(${SHADOW.x * pixelsPerUnit}px ${SHADOW.y * pixelsPerUnit}px ${SHADOW.blur * pixelsPerUnit}px rgba(0, 0, 0, ${SHADOW.alpha}))`
      : "";

    applied = {
      layoutKey,
      framingKey,
      strapImage: s.strapImage,
      strapColor: s.strapColor,
      strapScale,
      hardwareKey,
    };
    start();
  };

  const points = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  const strand = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  const taper = new Float32Array(SAMPLES);
  const sides = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  const bends = BAND_BEND.map((angle) => [Math.cos(angle), Math.sin(angle)] as const);
  const work = {
    tangent: new THREE.Vector3(),
    toCamera: new THREE.Vector3(),
    basis: new THREE.Matrix4(),
    up: new THREE.Vector3(),
    across: new THREE.Vector3(),
    facing: new THREE.Vector3(),
    end: new THREE.Vector3(),
    spread: new THREE.Vector3(),
  };

  /** Lay one band along `path`, twisting towards the card near its end. */
  const layBand = (
    geometry: THREE.BufferGeometry,
    path: THREE.Vector3[],
    held: number,
    repeats: number,
    width: number,
    taper?: Float32Array,
  ) => {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;
    const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
    const columns = BAND_COLUMNS.length;
    const { tangent, toCamera, across, facing } = work;
    for (let i = 0; i < SAMPLES; i++) {
      tangent.subVectors(path[Math.min(SAMPLES - 1, i + 1)], path[Math.max(0, i - 1)]);
      if (tangent.lengthSq() < 1e-12) tangent.set(0, -1, 0);
      tangent.normalize();
      toCamera.subVectors(camera.position, path[i]).normalize();
      const side = sides[i].crossVectors(toCamera, tangent);
      if (side.lengthSq() < 1e-10) side.copy(i > 0 ? sides[i - 1] : scratch.a.set(1, 0, 0));
      side.normalize();
      if (i > 0 && side.dot(sides[i - 1]) < 0) side.negate();
      const angle = -sim.twist * Math.pow(Math.min(1, i / (SAMPLES - 1) / held), 1.3);
      facing.crossVectors(tangent, side);
      across.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(facing, Math.sin(angle));
      facing.crossVectors(tangent, across);
      const p = path[i];
      const v = (1 - i / (SAMPLES - 1)) * repeats;
      for (let c = 0; c < columns; c++) {
        const k = i * columns + c;
        const offset = (BAND_COLUMNS[c] - 0.5) * width * (taper ? taper[i] : 1);
        const [bendCos, bendSin] = bends[c];
        position.setXYZ(k, p.x + across.x * offset, p.y + across.y * offset, p.z + across.z * offset);
        normal.setXYZ(
          k,
          facing.x * bendCos + across.x * bendSin,
          facing.y * bendCos + across.y * bendSin,
          facing.z * bendCos + across.z * bendSin,
        );
        uv.setXY(k, BAND_COLUMNS[c], v);
      }
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    uv.needsUpdate = true;
  };

  const updateBand = () => {
    const s = read();
    const hang = sim.nodes[JOINTS];
    const reach = layout.reach;
    let guide = JOINTS - 1;
    while (guide > 0 && sim.nodes[guide].distanceTo(hang) < reach * 1.1) guide--;
    const axis = work.up.subVectors(sim.nodes[guide], hang);
    if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0).applyQuaternion(sim.body.quaternion);
    axis.normalize();
    mouth.copy(hang).addScaledVector(axis, reach);
    tuck.copy(hang).addScaledVector(axis, layout.tuck);
    controls.length = 0;
    for (let i = 0; i <= guide; i++) controls.push(sim.nodes[i]);
    controls.push(mouth, tuck);
    curve.updateArcLengths();
    for (let i = 0; i < SAMPLES; i++) curve.getPointAt(i / (SAMPLES - 1), points[i]);
    const length = curve.getLength();
    const held = 1 - mouth.distanceTo(tuck) / Math.max(length, 0.001);
    const restLength = sim.rest * JOINTS;
    const repeats = restLength / (strapScale * tileRatio);
    const width = strapScale / Math.pow(Math.max(1, length / Math.max(restLength, 0.001)), 0.35);

    if (s.strapStyle === "v") {
      // Two bands parting above the sleeve in the view's plane: each sample
      // moves sideways in proportion to its distance up the band from the
      // sleeve's mouth. Into the mouth they narrow, gathered side by side.
      const mouthAt = (length - mouth.distanceTo(tuck)) / Math.max(length, 0.001);
      const spread = work.spread;
      for (const [index, sign] of [
        [0, -1],
        [1, 1],
      ] as const) {
        for (let i = 0; i < SAMPLES; i++) {
          const t = i / (SAMPLES - 1);
          const above = Math.max(0, mouthAt - t) * length;
          const gather = smooth(clamp(above / V_GATHER, 0, 1));
          taper[i] = mix(V_NARROW, 1, gather);
          const apart = (width * taper[i]) / 2 + s.strapSpread * above;
          spread.subVectors(points[Math.min(SAMPLES - 1, i + 1)], points[Math.max(0, i - 1)]);
          const toCamera = work.toCamera.subVectors(camera.position, points[i]).normalize();
          spread.crossVectors(spread, toCamera).normalize();
          if (spread.x < 0) spread.negate();
          // A hair apart in depth where they overlap at the sleeve's mouth.
          strand[i]
            .copy(points[i])
            .addScaledVector(spread, sign * apart * (t < mouthAt ? 1 : 0.5))
            .addScaledVector(toCamera, sign * 0.002);
        }
        layBand(bands[index].geometry, strand, held, repeats, width, taper);
      }
    } else layBand(bands[0].geometry, points, held, repeats, width);

    const { across, facing } = work;
    // The last frame across the band, as laid for the single band or the
    // second strand (both end in the same place).
    work.end.copy(across);
    across.copy(work.end).addScaledVector(axis, -work.end.dot(axis)).normalize();
    facing.crossVectors(across, axis).normalize();
    work.basis.makeBasis(across, axis, facing);
    clampGroup.quaternion.setFromRotationMatrix(work.basis);
    clampGroup.position.copy(hang);
  };

  const swingQuaternion = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const render = () => {
    const body = sim.body;
    cards[0].group.position.copy(body.position);
    cards[0].group.quaternion.copy(body.quaternion);
    const hook = sim.nodes[JOINTS];
    for (let index = 1; index < cards.length; index++) {
      const swing = sim.swings[index - 1];
      const group = cards[index].group;
      swingQuaternion.setFromAxisAngle(zAxis, swing.angle);
      group.quaternion.copy(body.quaternion).multiply(swingQuaternion);
      // Its hole sits a little further along the hook, behind the cards
      // in front of it.
      const pivot = scratch.a
        .set(CARD_SHIFT.x * index, CARD_SHIFT.y * index, -depthOf(index))
        .applyQuaternion(body.quaternion)
        .add(hook);
      group.position
        .copy(pivot)
        .sub(scratch.b.set(0, layout.hangY, layout.hangZ).applyQuaternion(group.quaternion));
    }
    updateBand();
    renderer.render(scene, camera);
  };

  const tick = (now: number) => {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(1 / 30, Math.max(1 / 240, (now - last) / 1000));
    last = now;
    time += dt;
    const current = settingsPhysics(read(), reducedMotion);
    stepSimulation(sim, dt, current, time, layout);
    const body = sim.body;
    if (!Number.isFinite(body.position.x + body.position.y + body.position.z + body.quaternion.w)) {
      sim.grab = null;
      placeHanging(sim, layout, false);
    }
    render();
    const resting = sim.calm > 1.2 && !sim.grab && current.breeze === 0;
    if (visible && !resting) raf = requestAnimationFrame(tick);
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const toPointer = (event: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  };

  /** The nearest card under the pointer, and which one it is. */
  const pickCard = () => {
    const meshes: THREE.Object3D[] = [];
    for (const card of cards) {
      card.group.updateMatrixWorld();
      meshes.push(card.body, card.front, card.back);
    }
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const index = cards.findIndex((card) => card.group === hit.object.parent);
    return { hit, index: Math.max(0, index) };
  };

  const setCursor = (value: string) => {
    if (canvas.style.cursor !== value) canvas.style.cursor = value;
  };

  /** Turn the cards over; a tap's point picks the way they spin. */
  const flip = (point?: THREE.Vector3) => {
    const body = sim.body;
    const up = scratch.a.set(0, 1, 0).applyQuaternion(body.quaternion);
    let direction = sim.turn > 0 ? -1 : 1;
    if (sim.turn === 0 && point) {
      const away = scratch.c.subVectors(point, camera.position).normalize();
      direction = scratch.b.subVectors(point, body.position).cross(away).dot(up) < 0 ? -1 : 1;
    }
    sim.turn = sim.turn === 0 ? Math.PI * direction : 0;
    body.angular.addScaledVector(up, FLIP_SPIN * direction);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button > 0) return;
    toPointer(event);
    const picked = pickCard();
    miss = picked ? null : { x: event.clientX, y: event.clientY };
    if (!read().interactive || !picked) return;
    const { hit, index } = picked;
    const body = sim.body;
    // A card behind is held by the point taken, measured from its hole.
    const arm = new THREE.Vector3();
    if (index > 0)
      cards[index].group
        .worldToLocal(arm.copy(hit.point))
        .sub(scratch.a.set(0, layout.hangY, layout.hangZ));
    sim.grab = {
      card: index,
      local: hit.point.clone().sub(body.position).applyQuaternion(body.quaternion.clone().invert()),
      rotation: body.quaternion.clone(),
      reach: hit.distance,
      from: hit.point.clone(),
      target: hit.point.clone(),
      pivot: new THREE.Vector3(CARD_SHIFT.x * index, CARD_SHIFT.y * index, -depthOf(index)),
      arm,
    };
    press = { x: event.clientX, y: event.clientY, time: performance.now(), point: hit.point.clone() };
    canvas.setPointerCapture?.(event.pointerId);
    setCursor("grabbing");
    event.preventDefault();
    start();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!read().interactive) return;
    toPointer(event);
    if (sim.grab) {
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press = null;
      raycaster.ray.at(sim.grab.reach, sim.grab.target);
      start();
      return;
    }
    if (event.pointerType === "touch") return;
    hovering = !!pickCard();
    setCursor(hovering ? "grab" : "");
  };

  const onPointerUp = (event: PointerEvent) => {
    if (miss && event.type === "pointerup") {
      const tapped = Math.hypot(event.clientX - miss.x, event.clientY - miss.y) <= 6;
      miss = null;
      if (tapped) onMiss?.();
    }
    if (!sim.grab) return;
    sim.grab = null;
    if (press && event.type === "pointerup" && performance.now() - press.time < 450) flip(press.point);
    press = null;
    canvas.releasePointerCapture?.(event.pointerId);
    setCursor(hovering && event.pointerType !== "touch" ? "grab" : "");
    start();
  };

  const onTouchStart = (event: TouchEvent) => {
    if (!read().interactive || event.touches.length !== 1) return;
    toPointer(event.touches[0]);
    if (pickCard()) event.preventDefault();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("lostpointercapture", onPointerUp);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });

  const resize = () => {
    view.width = Math.max(1, container.clientWidth);
    view.height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(view.width, view.height, false);
    apply();
    render();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  });
  intersectionObserver.observe(container);
  const onVisibility = () => {
    if (!document.hidden) start();
  };
  document.addEventListener("visibilitychange", onVisibility);

  resize();
  // Faces drawn from text use the page's fonts; paint again once they load.
  void document.fonts?.ready.then(() => {
    if (!alive) return;
    const s = read();
    cards.forEach((card, index) => {
      const face = s.cards[index] ?? s.cards[0];
      if (drawnFace(face)) paintCard(card, face);
    });
  });

  return {
    apply,
    flip: () => {
      if (!read().interactive) return;
      flip();
      start();
    },
    dispose: () => {
      alive = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("lostpointercapture", onPointerUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      cards.forEach(disposeCard);
      [ring, clampMesh, eyelet, dRing, ...bands].forEach((mesh) => mesh.geometry.dispose());
      [...claspGroup.children, ...loopGroup.children].forEach((child) => (child as THREE.Mesh).geometry.dispose());
      [metalMaterial, claspMaterial, sleeveMaterial, bandMaterial].forEach((material) => material.dispose());
      [strapTexture, grain, weave].forEach((texture) => texture.dispose());
      environment.dispose();
      renderer.dispose();
      // Give the context back now: browsers keep only a few, and each
      // opening of the badge creates one.
      renderer.forceContextLoss();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
