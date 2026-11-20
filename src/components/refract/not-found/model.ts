// The carrier as the 547 recording shows it, in ship units. Frame: x toward the bow, y toward the
// side that faces the viewer (the island stands on the far side, y < 0), z up from the waterline.
// The flight deck is at z = HD. Every number was measured from the recording (camera fitted to the
// deck outline: yaw 135.9°, pitch 29.6°, 9.71 stage px per unit on the 1194 × 1140 stage).

export type V2 = readonly [number, number];
export type V3 = readonly [number, number, number];

export const HD = 4.6; // flight deck height
export const BAND = 0.55; // deck-edge band below the deck

export const CAMERA = {
  yaw: (135.9 * Math.PI) / 180,
  pitch: (29.6 * Math.PI) / 180,
  scale: 9.71, // stage px per unit
  pivot: [0, 6] as V2, // ship point the drag turns about
  pivotAt: [599.5, 790.7] as V2, // where that point sits on the stage (at deck height)
};

// shadows fall toward the bow and a little to the far side: ground offset per unit of height
export const SUN: V2 = [0.53, -0.05];

// flight deck outline (z = HD)
export const DECK: V2[] = [
  [48.5, 2.5], [47.5, 1.0], [46, 0.0], [24.5, 0.0], [24.0, -3.6], [-48.0, -3.6], [-48.8, -2.8],
  [-48.8, 8.5], [-46.5, 11.5], [-30, 14.5], [-20.6, 15.3], [-12, 15.3], [-4, 16.0], [0, 16.45], [3.8, 16.8],
  [8.2, 16.7], [13.3, 15.9], [17.5, 13.3], [21.7, 12.35], [24.8, 11.5], [28.2, 10.46], [31, 9.98], [35, 9.3],
  [40, 8.0], [45, 6.0], [47.5, 4.2],
];

// hull: rings round the ship, stern near corner first, toward the bow and back along the far side.
// Each station: [deck edge, bottom of the deck-edge band, knuckle, waterline]. Forward the bow
// flares out from a knuckle up to a deep deck-edge band; amidships the angled deck overhangs the
// hull; aft the side and the flat transom drop straight from the deck edge.
export const WL = -3.4; // the sea, below the model's z = 0 (the plane the wake and wave marks lie on)
const B = HD - BAND;
export const HULL: [V3, V3, V3, V3][] = [
  [[-48.8, 8.5, HD], [-48.8, 8.5, B], [-48.8, 8.5, 0.3], [-47.5, 7.8, 0]],
  [[-46.5, 11.5, HD], [-46.5, 11.5, B], [-46.5, 11.5, 0.3], [-45.5, 10.0, 0]],
  [[-36, 13.41, HD], [-36, 13.41, B], [-36, 13.41, 0.3], [-36, 11.0, 0]],
  [[-30, 14.5, HD], [-30, 14.5, B], [-30, 11.6, 3.7], [-30, 10.5, WL]],
  [[-20.6, 15.3, HD], [-20.6, 15.3, B], [-20.6, 11.3, 3.7], [-20.6, 10.8, WL]],
  [[-12, 15.3, HD], [-12, 15.3, B], [-12, 11.3, 3.7], [-12, 10.8, WL]],
  [[-4, 16.0, HD], [-4, 16.0, B], [-4, 11.4, 3.7], [-4, 10.9, WL]],
  [[0, 16.45, HD], [0, 16.45, B], [0, 11.5, 3.7], [0, 11.0, WL]],
  [[3.8, 16.8, HD], [3.8, 16.8, B], [3.8, 11.6, 3.7], [3.8, 11.1, WL]],
  [[8.2, 16.7, HD], [8.2, 16.7, B], [8.2, 12.0, 3.7], [8.2, 11.4, WL]],
  [[13.3, 15.9, HD], [13.3, 15.9, B], [13.6, 12.6, 2.0], [14, 11.9, WL]],
  [[17.5, 13.3, HD], [17.5, 13.3, B], [17.8, 12.1, 1.9], [17.8, 12.0, WL]],
  [[21.7, 12.35, HD], [21.7, 12.35, B], [21.8, 11.9, 1.85], [21.8, 11.9, WL]],
  [[24.8, 11.5, HD], [24.8, 11.5, B], [25.9, 10.4, 0.3], [25.9, 10.4, WL]],
  [[28.2, 10.46, HD], [28.2, 10.46, 3.18], [29.1, 9.47, -0.45], [29.1, 9.47, WL]],
  [[31, 9.98, HD], [31, 9.98, 3.3], [31.9, 9.0, -0.35], [31.9, 9.0, WL]],
  [[34, 9.47, HD], [34, 9.47, 2.85], [35, 8.2, -0.9], [35, 8.2, WL]],
  [[36.5, 8.91, HD], [36.5, 8.91, 2.95], [38.5, 6.9, -0.9], [38.5, 6.9, WL]],
  [[40, 8.0, HD], [40, 8.0, 3.0], [41.2, 6.0, -0.9], [41.2, 6.0, WL]],
  [[45, 6.0, HD], [45, 6.0, 3.0], [45.3, 4.3, -0.9], [45.3, 4.3, WL]],
  [[47.5, 4.2, HD], [47.5, 4.2, 3.1], [46.9, 3.2, -0.9], [46.9, 3.2, WL]],
  [[48.5, 2.5, HD], [48.5, 2.5, 3.2], [47.6, 2.5, -0.9], [47.6, 2.5, WL]],
  [[47.5, 1.0, HD], [47.5, 1.0, 3.1], [46.9, 1.7, -0.9], [46.9, 1.7, WL]],
  [[46, 0, HD], [46, 0, 3.0], [44.5, 0.6, -0.9], [44.5, 0.6, WL]],
  [[24.5, 0, HD], [24.5, 0, B], [24.5, -0.2, 0.3], [26, -0.3, WL]],
  [[24, -3.6, HD], [24, -3.6, B], [24, -0.3, 3.7], [24, -0.4, WL]],
  [[-48, -3.6, HD], [-48, -3.6, B], [-48, -0.6, 3.7], [-47, -0.5, WL]],
  [[-48.8, -2.8, HD], [-48.8, -2.8, B], [-48.8, -1.0, 0.3], [-47.5, -0.6, 0]],
];
// stations from here on (by x) get the bow's lit strip and knuckle line
export const BOW_FROM = 16.5;

// platforms at deck level beside the deck (far side sponsons, near-side lift)
export const SPONSONS: V2[][] = [
  [[21.8, -3.6], [21.8, -8.8], [15.4, -8.8], [15.4, -3.6]],
  [[13.2, -3.6], [13.2, -8.8], [6.4, -8.8], [6.4, -3.6]],
];
export const NEAR_LIFT: V2[] = [[-29.2, 14.2], [-29.2, 17.0], [-36.0, 17.0], [-36.0, 14.0]];
// the far lift aft of the island goes down and up on its own timer
export const FAR_LIFT: V2[] = [[-20.7, -3.6], [-20.7, -9.0], [-27.9, -9.0], [-27.9, -3.6]];
export const LIFT_DROP = 2.7;

// island: boxes [x0, x1, y0, y1, z0, z1]
export type Box = readonly [number, number, number, number, number, number];
export const ISLAND: Box[] = [
  [-15.0, -6.8, -3.9, -1.0, HD, HD + 2.2],
  [-14.2, -7.3, -4.2, -1.5, HD + 2.2, HD + 3.6],
  [-12.2, -8.0, -3.9, -2.0, HD + 3.6, HD + 4.2],
];
export const RADOMES: [V3, number][] = [
  [[-12.0, -3.5, HD + 4.25], 0.55],
  [[-13.4, -3.7, HD + 4.25], 0.55],
  [[-7.4, -1.9, HD + 3.9], 0.5],
];
export const MAST = { at: [-10.5, -3.0] as V2, z0: HD + 4.2, z1: HD + 11.8, pole: HD + 14.1, w0: 0.9, w1: 0.24 };
// a flat panel on the island top (radar face)
export const PANEL: V3[] = [[-7.7, -1.9, HD + 3.6], [-7.7, -3.3, HD + 3.6], [-7.7, -3.3, HD + 5.3], [-7.7, -1.9, HD + 5.3]];

// whip antennas on the near deck edge: [x, y]
export const WHIPS: V2[] = [[-0.7, 16.4], [-16.2, 15.3], [-28.8, 14.6]];

// markings on the deck: solid lines, dashed lines, ovals (deck lights)
export const MARK_LINES: [V2, V2][] = [
  [[21.6, 5.5], [46.2, 5.5]], // bow catapult
  [[-48.2, 0.3], [9.5, 8.8]], // angled deck, far edge line
  [[-46.0, 9.6], [10.5, 14.4]], // angled deck, near edge line
  [[-40, 2.6], [4, 9.1]],
  [[-38, 6.6], [5, 12.9]],
  [[-30, 3.0], [-2, 7.1]],
  [[-26, 7.9], [2, 12.0]],
  [[-46.6, 6.2], [-34, 8.1]],
  [[44.5, 3.0], [26.5, 3.3]], // bow, second line
];
export const MARK_DASHES: [V2, V2][] = [[[-48.6, 3.0], [8.5, 11.4]]];
export const LIGHTS: V2[] = [
  [36.5, 6.7], [31.5, 6.9], [26.5, 7.1], [12.5, 2.4], [6.5, 3.2], [2.0, 4.0], [-4, 4.8], [-12, 6.0],
  [-20, 2.0], [-28, 3.2], [-36, 11.3], [-37.2, 11.8], [-38.4, 12.3], [14.2, 8.7], [-24, 7.6],
];
// blast deflectors behind the bow catapults (flat on the deck): [x0, x1, y0, y1]
export const DEFLECTORS: [number, number, number, number][] = [
  [16.1, 17.6, 2.1, 7.2],
  [15.8, 17.7, -1.8, 1.8],
];
// the painted hull number on the deck: centre, height
export const NUMBER = { text: "68", at: [33.2, 3.9] as V2, size: 2.7 };
// arresting wire: its two deck ends
export const WIRE: [V2, V2] = [[-34.11, 9.05], [-32.98, 1.14]];

// parked jets: [x, y, heading°] (heading measured from +x toward +y)
export const PARKED: V3[] = [
  [44.3, 0.2, 155], [39.3, 0.2, 155], [34.3, 0.2, 155], [29.3, 0.2, 155],
  [19.1, -6.4, 82], [11.6, -6.4, 82],
  [2.8, -1.2, 80], [-1.3, -1.2, 80],
  [-16.8, -0.9, 80],
  [-32.6, -0.9, 80], [-37.8, -0.9, 80], [-44.9, -2.0, 80],
  [-32.75, 15.4, -90],
];
export const LIFT_JET: V3 = [-24.2, -5.6, 82];

// ---------------------------------------------------------------------------------------------
// the jet, in its own frame: u forward (nose +), v to the side, w up
export const JET_LEN = 6.1;
const half = (pts: number[][]) => [...pts, ...pts.slice(1, -1).reverse().map(([u, v]) => [u, -v])];
// fuselage planform, extruded from the belly up to its back
export const JET_BODY: number[][] = half([
  [3.0, 0], [2.3, 0.2], [1.5, 0.36], [0.9, 0.48], [0.6, 0.7], [-1.6, 0.7], [-2.6, 0.55], [-3.0, 0.45], [-3.0, 0],
]);
export const JET_WING: number[][] = [[0.7, 0.7], [-1.0, 2.15], [-1.65, 2.15], [-1.9, 0.7]];
export const JET_STAB: number[][] = [[-2.0, 0.55], [-2.6, 1.45], [-3.05, 1.45], [-3.0, 0.5]];
export const JET_CANOPY: number[][] = half([[2.15, 0], [1.75, 0.2], [1.0, 0.24], [0.6, 0]]);
// twin fins, canted out: base fore, base aft, tip aft, tip fore ([u, v, w]; v mirrored)
export const JET_FIN: number[][] = [[-1.3, 0.42, 0.9], [-2.5, 0.42, 0.9], [-2.75, 1.0, 2.0], [-2.15, 1.0, 2.0]];
export const JET_W = { belly: 0.35, wing: 0.5, body: 0.9, canopy: 1.1 };

// ---------------------------------------------------------------------------------------------
// the flight cycle: one jet lands, taxies forward, waits on the catapult and launches; it is in the
// air for the second half of its life. Two jets share the deck, half a life apart.
export const CYCLE = 1270; // frames (60 fps)
export const LIFE = 2 * CYCLE;

// readout: [deck, air, launch seconds] at frame f of the cycle, as the recording shows it
export function readout(f: number): [number, number, number] {
  const air = f < 13 || f >= 409 ? 1 : 0;
  let launch: number;
  if (f < 13) launch = 6;
  else if (f < 313) launch = 5 - Math.floor((f - 13) / 60);
  else if (f < 320) launch = 22;
  else if (f < 381) launch = 21;
  else launch = 20 - Math.floor((f - 381) / 60);
  return [16 - air, air, launch];
}

const ANGLE = Math.atan2(3.34, 22.58); // the angled deck, 8.4°
const TOUCH: V3 = [-34.97, 5.0, HD + 0.6];
const ROLL_END: V2 = [-12.39, 8.34];
const CAT0: V2 = [21.2, 5.5];
const CAT_LEN = 24.3; // catapult stroke
const CAT_START = CYCLE + 318; // life frame the stroke starts
const CAT_T = 92; // stroke frames
export type JetPose = {
  p: V3; // position (jet origin, z = gear on the deck)
  h: number; // heading (rad)
  bank: number; // roll (rad)
  air: boolean;
  flame: number; // afterburner 0..1
  hook: V3 | null; // tail hook while the wire holds it
  wire: number; // 0..1 how far a released wire has sprung back
};

// taxi path after the trap: [life frame, x, y]
const TAXI: [number, number, number][] = [
  [318, -12.39, 8.34], [349, -10.9, 8.2], [424, -7.2, 8.8], [476, -3.1, 9.3], [508, -0.5, 9.8],
  [550, 2.75, 9.45], [592, 5.6, 7.85], [634, 8.0, 6.4], [686, 9.8, 5.4], [738, 10.8, 5.5],
];
// in the air: [life frame, x, y, z, vx, vy, vz]
const AIR: number[][] = [
  [CAT_START + CAT_T, CAT0[0] + CAT_LEN, 5.5, HD + 0.6, 0.528, 0, 0],
  [CAT_START + CAT_T + 77, 84, 5.5, 10.5, 0.5, 0, 0.069],
  [1860, 122, 20, 14, -0.05, 0.5, -0.02],
  [1956, 56, 30.4, 8, -0.53, 0, 0],
  [2186, -66, 30.4, 8, -0.53, 0, 0],
  [2280, -118, 14, 10, 0, -0.5, 0],
  [2370, -91.7, -3.3, 9.0, 0.31, 0.0456, -0.0209],
  [LIFE + 13, TOUCH[0], TOUCH[1], TOUCH[2], 0.31, 0.0456, -0.0209],
];

// extra height along the flight [life frame, units], from the jet's shadow on the water
const CLIMB: number[][] = [
  [CAT_START + CAT_T, 0], [1700, 4], [1757, 8], [1860, 14], [1956, 20], [2186, 20], [2280, 14], [2370, 6], [LIFE + 13, 0],
];
function lerpKeys(k: number[][], g: number) {
  if (g <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++)
    if (g <= k[i][0]) {
      const t = (g - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * t * t * (3 - 2 * t);
    }
  return k[k.length - 1][1];
}

function hermite(k: number[][], g: number, out: number[]) {
  let i = 0;
  while (i < k.length - 2 && g > k[i + 1][0]) i++;
  const a = k[i], b = k[i + 1];
  const T = b[0] - a[0];
  const t = Math.min(1, Math.max(0, (g - a[0]) / T));
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  const d00 = 6 * t2 - 6 * t, d10 = 3 * t2 - 4 * t + 1, d01 = -6 * t2 + 6 * t, d11 = 3 * t2 - 2 * t;
  for (let j = 0; j < 3; j++) {
    out[j] = h00 * a[j + 1] + h10 * T * a[j + 4] + h01 * b[j + 1] + h11 * T * b[j + 4];
    out[j + 3] = (d00 * a[j + 1] + d10 * T * a[j + 4] + d01 * b[j + 1] + d11 * T * b[j + 4]) / T;
  }
}

// Catmull-Rom through [t, x, y] keys, position and velocity
function spline2(k: [number, number, number][], g: number): [number, number, number, number] {
  let i = 0;
  while (i < k.length - 2 && g > k[i + 1][0]) i++;
  const p0 = k[Math.max(0, i - 1)], p1 = k[i], p2 = k[i + 1], p3 = k[Math.min(k.length - 1, i + 2)];
  const T = p2[0] - p1[0];
  const t = Math.min(1, Math.max(0, (g - p1[0]) / T));
  const m = (a: [number, number, number], b: [number, number, number], j: number) => ((b[j] - a[j]) / Math.max(1, b[0] - a[0])) * T;
  const res: number[] = [];
  const t2 = t * t, t3 = t2 * t;
  for (let j = 1; j <= 2; j++) {
    const m1 = i === 0 ? 0 : m(p0, p2, j), m2 = i + 2 >= k.length ? 0 : m(p1, p3, j);
    res.push((2 * t3 - 3 * t2 + 1) * p1[j] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[j] + (t3 - t2) * m2);
    res.push(((6 * t2 - 6 * t) * p1[j] + (3 * t2 - 4 * t + 1) * m1 + (-6 * t2 + 6 * t) * p2[j] + (3 * t2 - 2 * t) * m2) / T);
  }
  return [res[0], res[2], res[1], res[3]];
}

const tmp = [0, 0, 0, 0, 0, 0];

// pose of a jet at frame g of its life (0 ≤ g < LIFE)
export function jetAt(g: number): JetPose {
  const deckZ = HD;
  if (g >= 13 && g < 318) {
    // the trap: rolls on, the wire stretches and stops it, then lets go
    let s: number;
    const v0 = 0.3;
    if (g < 30) s = v0 * (g - 13);
    else if (g < 148) {
      const d = g - 30;
      s = v0 * 17 + v0 * d - (0.5 * v0 * d * d) / 118;
    } else s = v0 * 17 + 0.5 * v0 * 118;
    const k = s / (v0 * 17 + 0.5 * v0 * 118);
    const x = TOUCH[0] + (ROLL_END[0] - TOUCH[0]) * k, y = TOUCH[1] + (ROLL_END[1] - TOUCH[1]) * k;
    const hx = x - Math.cos(ANGLE) * 2.5, hy = y - Math.sin(ANGLE) * 2.5;
    const held = g < 225 && caught(hx, hy);
    return {
      p: [x, y, deckZ], h: ANGLE, bank: 0, air: false, flame: 0,
      hook: held ? [hx, hy, deckZ + 0.15] : null,
      wire: g < 225 ? 0 : Math.min(1, (g - 225) / 16),
    };
  }
  if (g >= 318 && g < 738) {
    const [x, y] = spline2(TAXI, g);
    const a = spline2(TAXI, Math.max(318, g - 6)), b = spline2(TAXI, Math.min(738, g + 6));
    let h = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const s0 = Math.min(1, (g - 318) / 40), s1 = Math.min(1, (738 - g) / 40);
    h = ANGLE + (h - ANGLE) * s0 * s0 * (3 - 2 * s0);
    h = h * s1 * s1 * (3 - 2 * s1);
    return { p: [x, y, deckZ], h, bank: 0, air: false, flame: 0, hook: null, wire: 1 };
  }
  if (g >= 738 && g < 1030) return { p: [10.8, 5.5, deckZ], h: 0, bank: 0, air: false, flame: 0, hook: null, wire: 1 };
  if (g >= 1030 && g < CAT_START) {
    const t = Math.min(1, (g - 1030) / 74);
    const e = t * t * (3 - 2 * t);
    const x = 10.8 + (CAT0[0] - 10.8) * e;
    const flame = g < CYCLE + 245 ? 0 : Math.min(1, (g - CYCLE - 245) / 30);
    return { p: [x, CAT0[1], deckZ], h: 0, bank: 0, air: false, flame, hook: null, wire: 1 };
  }
  if (g >= CAT_START && g < CAT_START + CAT_T) {
    const t = g - CAT_START;
    const x = CAT0[0] + (CAT_LEN * t * t) / (CAT_T * CAT_T);
    return { p: [x, CAT0[1], deckZ], h: 0, bank: 0, air: true, flame: 1, hook: null, wire: 1 };
  }
  // in the air: climb out, circle, a low pass down the near side, circle, approach and land
  const gg = g < 13 ? g + LIFE : g;
  hermite(AIR, gg, tmp);
  const h = Math.atan2(tmp[4], tmp[3]);
  // bank into the turns (heading rate)
  hermite(AIR, gg + 2, tmp2);
  const turn = Math.atan2(tmp2[4], tmp2[3]) - h;
  const bank = Math.max(-0.7, Math.min(0.7, -Math.atan2(Math.sin(turn), Math.cos(turn)) * 18));
  const flame = gg < CAT_START + CAT_T + 110 ? 1 : 0;
  // the recorded shadows put the jet higher than the path above reads: lift it along the line of
  // sight, so it stays on the same spot of the screen while its shadow falls where it was recorded
  const dz = lerpKeys(CLIMB, gg);
  const k = Math.cos(CAMERA.pitch) / Math.sin(CAMERA.pitch);
  const x = tmp[0] - k * Math.sin(CAMERA.yaw) * dz, y = tmp[1] - k * Math.cos(CAMERA.yaw) * dz;
  return { p: [x, y, Math.max(deckZ, tmp[2] - 0.6 + dz)], h, bank, air: true, flame, hook: null, wire: 1 };
}
const tmp2 = [0, 0, 0, 0, 0, 0];

// is the hook past the wire (on the bow side of the line between its two ends)?
function caught(hx: number, hy: number) {
  const [[ax, ay], [bx, by]] = WIRE;
  return (bx - ax) * (hy - ay) - (by - ay) * (hx - ax) < 0;
}

// puffs: tyre smoke at the trap and steam along the catapult. [x, y, z, radius, alpha]
export function puffs(gA: number, gB: number, out: number[][]) {
  out.length = 0;
  // tyre smoke: a few dim discs left where the wheels touch and slide (gA = life frame of the landing jet)
  for (let i = 0; i < 9; i++) {
    const born = 14 + i * 4.5;
    const age = gA - born;
    if (age < 0 || age > 170) continue;
    const s = jetAt(born);
    const k = age / 170;
    const side = (i % 2 ? 1 : -1) * 0.55;
    const x = s.p[0] - Math.cos(ANGLE) * 1.2 - Math.sin(ANGLE) * side + age * 0.006;
    const y = s.p[1] - Math.sin(ANGLE) * 1.2 + Math.cos(ANGLE) * side;
    out.push([x, y, HD + 0.3 + k * 0.4, 0.5 + 0.45 * Math.sqrt(k), 0.26 * (k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45)]);
  }
  // catapult steam: separate discs left behind along the stroke (gB = life frame of the launching jet)
  for (let i = 0; i < 15; i++) {
    const born = CAT_START + 3 + i * 6.2;
    const age = gB - born;
    if (age < 0 || age > 200) continue;
    const u = (born - CAT_START) / CAT_T;
    const x = CAT0[0] + 0.6 + (CAT_LEN - 5) * u * u;
    const k = age / 200;
    const fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
    out.push([x + age * 0.003, CAT0[1] + ((i % 3) - 1) * 0.3, HD + 0.3 + k * 0.4, 0.7 + 0.55 * Math.sqrt(k), 0.28 * fade * Math.min(1, age / 5)]);
  }
}

// the blast deflector behind the bow catapult (DEFLECTORS[0]) stands up once the next jet is on the
// catapult and lies flat again after the launch: its angle (rad) at cycle frame c
export const JBD_UP = (52 * Math.PI) / 180;
export function jbdAt(c: number) {
  const p = ((c % CYCLE) + CYCLE) % CYCLE;
  const ease = (u: number) => u * u * (3 - 2 * u);
  if (p >= 1160 && p < 1195) return JBD_UP * ease((p - 1160) / 35);
  if (p >= 478 && p < 500) return JBD_UP * (1 - ease((p - 478) / 22));
  return p >= 1195 || p < 478 ? JBD_UP : 0;
}

// far lift height (0 = deck level, -LIFT_DROP = down) at absolute frame t; its own 26 s timer
const LIFT_T = 1560;
export function liftAt(t: number) {
  const p = (((t + 114) % LIFT_T) + LIFT_T) % LIFT_T;
  const ease = (u: number) => u * u * (3 - 2 * u);
  let up: number;
  if (p < 254) up = ease(p / 254);
  else if (p < 906) up = 1;
  else if (p < 1160) up = 1 - ease((p - 906) / 254);
  else up = 0;
  return -LIFT_DROP * (1 - up);
}

// the helicopter circles the ship once a minute: [frame, x, y, heading°]
const HELI_T = 3600;
const HELI: [number, number, number][] = [
  [0, 30.7, -9.5], [212, 33.9, -14.5], [487, 26.6, -18.6], [634, 20.6, -21.3], [833, 10.1, -24.5],
  [1052, -6.4, -24.2], [1262, -20.2, -25.1], [1537, -38.4, -21.8], [1800, -56, -12], [2060, -62, 6],
  [2320, -50, 24], [2600, -22, 34], [2880, 8, 32], [3150, 30, 20], [3400, 38, 2], [3600, 30.7, -9.5],
  [3812, 33.9, -14.5],
];
const HELI_H: [number, number][] = [
  [0, 134], [200, 172], [1052, 180], [1262, 181], [1537, 200], [1800, 240], [2060, 280], [2320, 315],
  [2600, 350], [2880, 372], [3150, 400], [3400, 440], [3600, 494],
];
export const HELI_Z = 15.5;
export function heliAt(t: number): { p: V3; h: number; rotor: number } {
  const f = ((t % HELI_T) + HELI_T) % HELI_T;
  const keys: [number, number, number][] = [[-263, -24, 4], ...HELI];
  // wrap: the key before 0 continues the loop
  keys[0] = [HELI[HELI.length - 3][0] - HELI_T, HELI[HELI.length - 3][1], HELI[HELI.length - 3][2]];
  const [x, y] = spline2(keys, f);
  let i = 0;
  while (i < HELI_H.length - 2 && f > HELI_H[i + 1][0]) i++;
  const a = HELI_H[i], b = HELI_H[i + 1];
  const u = Math.min(1, Math.max(0, (f - a[0]) / (b[0] - a[0])));
  const e = u * u * (3 - 2 * u);
  const h = ((a[1] + (b[1] - a[1]) * e) * Math.PI) / 180;
  return { p: [x, y, HELI_Z], h, rotor: t * 0.14 };
}
