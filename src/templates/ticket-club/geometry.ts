// Ticket Club — measurements of the original (replicas `ticket-club`, data.ts), kept as measured. Geometry
// comes from the recording (3000 × 1614 at DPR 2 → a 1500 × 807 CSS px design stage, 60 fps).
// Ticket-local coordinates (u, v) have their origin at the card's top-left corner.

// ---------- stage ----------
export const STAGE = { w: 1500, h: 807 };

// ---------- tickets ----------
export const TW = 302.4; // card width
export const TH = 477.4; // card + stub height
export const VP = 377.9; // perforation line (hole centres)
export const HOLES = { r: 2.5, pitch: 12.1, u0: 0.2 }; // round holes along the perforation
export const PIVOT = { u: 151, v: -12 }; // transform-origin (the clip on the string)
export const CLIP = { u: 141.9, v: -20.7, w: 18.5, h: 49, tilt: 4 }; // metal clip, tilted against the card
/** rest pose of each ticket: pivot position (stage px) and angle (deg) */
export const POSE: { P: [number, number]; a: number }[] = [
  { P: [433.16, 126.07], a: -6.9995 },
  { P: [786.7, 135.85], a: 1.5208 },
  { P: [1140.4, 123.89], a: 7.0003 },
];
// the QR card that covers the corner icon on hover: dark square, code inside, a dashed caption below
export const QR_BOX = { u: 242, v: 178.75, s: 45, code: { u: 250.4, v: 186.8, s: 28.3 }, dash: { u: 264.5, v: 219.4, w: 16 } };

// the barcode under the link: bar centres (u) and thin / wide bars, measured from the recording
export const BARCODE = {
  v: 451.6, h: 11, thin: 0.9, wide: 1.75,
  bars: [[21.45, 0], [26.95, 1], [29.03, 0], [34.53, 1], [36.65, 0], [42.13, 1], [44.35, 0], [49.73, 1], [54.45, 0], [57.38, 1],
    [62.05, 0], [65.03, 1], [69.65, 0], [72.65, 1], [77.3, 0], [82.38, 0], [84.93, 0], [89.98, 0], [92.55, 0], [97.6, 0],
    [100.2, 0], [105.25, 0], [110.65, 1], [112.88, 0], [118.25, 1], [120.48, 0], [125.9, 1], [128.08, 0]] as [number, number][],
};

// card colours (measured)
export const CARD_C = {
  dark: { card: "rgb(20, 22, 19)", stub: "rgb(17, 18, 15)" },
  light: { card: "rgb(19, 28, 25)", stub: "rgb(157, 227, 223)" },
};

// text: [x, y, size, letter-spacing] (div top-left, line-height normal)
export type T4 = [number, number, number, number];
export const CARD_TXT = {
  tc: [20.39, 19.47, 7.859, 0.75] as T4,
  pass: [211.55, 19.5, 8.12, 0.542] as T4,
  club: [20.48, 42.43, 19.031, 2.45] as T4,
  kind: [20.48, 212.88, 7.559, 1.0] as T4,
  t1: [20.41, 229.4, 47.222, 0.071] as T4,
  t2: [20.5, 271.4, 47.222, 0.071] as T4,
  sub: [20.56, 331.86, 7.732, 0.5] as T4,
  name: [20.56, 361.06, 8.0, 0.286] as T4,
  year: [241.44, 360.91, 8.0, 0.214] as T4,
  take: [17.95, 395.38, 11.959, 1.045] as T4,
  url: [18.48, 421.12, 10.05, 0.034] as T4,
  pull: [148.02, 453.43, 7.76, 0.679] as T4,
  taken: [102.96, 395.45, 8.927, 0.833] as T4,
  again: [110.12, 430.26, 8.93, 0.3] as T4,
  pct: [318.02, 377.98, 8.927, 0] as T4,
};
export const AGAIN_BOX = { u: 98.7, v: 421, w: 105.3, h: 26.7 };

// ---------- page ----------
export const PAGE_TXT = {
  little: [74.42, 34.5, 8.927, 0.95] as T4,
  coll: [74.04, 47.99, 8.927, 1.0] as T4,
};
export const LOGO = { x: 35, y: 33, s: 28 };
export const EDITION = { x: 1322, y: 33.5, w: 148, h: 28 }; // underline at the bottom edge

// hint row, centred on x = 799.75
export const HINT = { cx: 799.75, y: 688.5 };

// clipboard panel (rotate(2deg) about its centre)
export const PANEL = { x: 1160.51, y: 629.97, w: 292.6, h: 164, rot: 2 };
export const PANEL_TXT = {
  head: [140.41, 11.01, 9.026, 0.188] as T4,
  r1t: [52.05, 52.66, 10.3, 0] as T4,
  r1s: [52.47, 68.55, 7.16, -0.1] as T4,
  r2t: [52.51, 94.56, 10.3, 0] as T4,
  r2s: [52.49, 110.54, 7.16, -0.1] as T4,
  foot: [21.13, 146.07, 7.292, -0.152] as T4,
  keys: [262, 145.5, 8, 0.4] as T4,
};
export const ROW_ICON = { u: 13, v1: 50, v2: 92.25, s: 30 };

// toast, centred on x = 753.2
export const TOAST = { cx: 753.2, y: 776, h: 44 };

// phone (and portrait screens): the line at a readable scale inside a sideways track that snaps to each ticket
export const PHONE = { below: 760, refW: 450, y0: 84, y1: 668, centres: [463.6, 780, 1109.9], start: 1 };

// the card's pixel-art diamond (47 × 37 cells, R = red, C = cyan), sampled cell by cell from the recording
export const DIAMOND = {
  u: 66.5, v: 74.2, w: 170.1, h: 133.2,
  dark: { red: "rgb(202, 54, 49)", cyan: "rgb(152, 248, 240)" },
  light: { red: "rgb(228, 51, 44)", cyan: "rgb(146, 253, 254)" }, // the ticket with the cyan stub
  rows: [
    "..................CCCRRRRRCCC..................",
    ".................CCCRRRCRRRCCC.................",
    "................CCCRRRCCCRRRCCC................",
    "...............CCCRRRCCRCCRRRCCC...............",
    "..............CCCRRRCCRCRCCRRRCCC..............",
    ".............CCCRRRCCRCCCRCCRRRCCC.............",
    "............CCCRRRRRCCRCRCCRRRRRCCC............",
    "...........CCCRRRRRRRCCRCCRRRRRRRCCC...........",
    "..........CCCRCRRRRRRRCCCRRRRRRRCRCCC..........",
    ".........CCCRCCCRRRRRRRCRRRRRRRCCCRCCC.........",
    "........CCCRRRCRRRRRRRRRRRRRRRRRCRRRCCC........",
    ".......CCCRRRRCRRRRRRRRRRRRRRRRRCRRRRCCC.......",
    "......CCCRRRRRCCCCCRRRRRRRRRCCCCCRRRRRCCC......",
    ".....CCCRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRCCC.....",
    "....CCCRRRCRRRRRRRRCCCCCCCCCRRRRRRRRCRRRCCC....",
    "...CCCRRRCCCRRRRRRRCCCCCCCCCRRRRRRRCCCRRRCCC...",
    "..CCCRRRCCRCCRRRRRRCCRRRRRCCRRRRRRCCRCCRRRCCC..",
    ".CCCRRRCCRCRCCRRRRRCCRCCRRCCRRRRRCCRCRCCRRRCCC.",
    "CCCRRRCCRCCCRCCRRRRCCRCCRRCCRRRRCCRCCCRCCRRRCCC",
    ".CCCRRRCCRCRCCRRRRRCCRRRCRCCRRRRRCCRCRCCRRRCCC.",
    "..CCCRRRCCRCCRRRRRRCCRRRRRCCRRRRRRCCRCCRRRCCC..",
    "...CCCRRRCCCRRRRRRRCCCCCCCCCRRRRRRRCCCRRRCCC...",
    "....CCCRRRCRRRRRRRRCCCCCCCCCRRRRRRRRCRRRCCC....",
    ".....CCCRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRCCC.....",
    "......CCCRRRRRCCCCCRRRRRRRRRCCCCCRRRRRCCC......",
    ".......CCCRRRRCRRRRRRRRRRRRRRRRRCRRRRCCC.......",
    "........CCCRRRCRRRRRRRRRRRRRRRRRCRRRCCC........",
    ".........CCCRCCCRRRRRRRCRRRRRRRCCCRCCC.........",
    "..........CCCRCRRRRRRRCCCRRRRRRRCRCCC..........",
    "...........CCCRRRRRRRCCRCCRRRRRRRCCC...........",
    "............CCCRRRRRCCRCRCCRRRRRCCC............",
    ".............CCCRRRCCRCCCRCCRRRCCC.............",
    "..............CCCRRRCCRCRCCRRRCCC..............",
    "...............CCCRRRCCRCCRRRCCC...............",
    "................CCCRRRCCCRRRCCC................",
    ".................CCCRRRCRRRCCC.................",
    "..................CCCRRRRRCCC..................",
  ],
};

// ---------- one to three tickets ----------
// The recording hangs three tickets. With fewer, the measured outer poses move in towards the middle of
// the line (each keeps its own tilt, hanging just under the line as measured); one ticket takes the
// middle pose. Drop angles and staggers follow the same roles (first, middle, last).
export type Pose = { P: [number, number]; a: number };
/** the line's curve (y at x), as STRING_D draws it between the stage edges */
const lineY = (x: number) => {
  const t = x / STAGE.w;
  return (1 - t) * (1 - t) * 104.446 + 2 * t * (1 - t) * 153.36 + t * t * 103.246;
};
const near = (from: Pose, x: number): Pose => ({ P: [x, lineY(x) + (from.P[1] - lineY(from.P[0]))], a: from.a });
const MID = (POSE[0].P[0] + POSE[2].P[0]) / 2;
const HALF2 = (POSE[2].P[0] - POSE[0].P[0]) * 0.28; // two tickets: a little wider apart than three
export const posesFor = (n: number): Pose[] =>
  n >= 3 ? POSE.slice(0, 3) : n === 2 ? [near(POSE[0], MID - HALF2), near(POSE[2], MID + HALF2)] : [POSE[1]];
/** the role of the i-th of n tickets in the measured entrance (0 first, 1 middle, 2 last) */
export const roleOf = (i: number, n: number) => (n >= 3 ? i : n === 2 ? (i === 0 ? 0 : 2) : 1);
/** the visual centre of a hanging ticket (the card turns about its clip), in stage px */
export const centreOf = (p: Pose) => p.P[0] - Math.sin((p.a * Math.PI) / 180) * (TH / 2 - PIVOT.v);
/** phone: the sideways track's snap centres (the recording's for three tickets) */
export const phoneCentres = (n: number) => (n >= 3 ? PHONE.centres : posesFor(n).map(centreOf));
export const phoneStart = (n: number) => (n >= 3 ? PHONE.start : 0);
