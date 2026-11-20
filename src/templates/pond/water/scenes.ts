// Where the koi and the lily pads are when a page opens. Each scene is composed around the text it lies under: the
// koi keep to the open water and the pads gather at an edge. Positions are percentages of the pond, for wide screens
// (x, y) and for tall ones (px, py, when the pond is narrower than 4:5); a fish keeps its heading in both, so its
// shadow falls the same way. The live pond starts from exactly these places.

export type KoiPlacement = {
  /** centre of the fish's box, % of the pond's width and height */
  x: number;
  y: number;
  px?: number;
  py?: number;
  /** heading in degrees, clockwise from facing right */
  angle: number;
  /** curve of the body, radians per segment of the spine (negative curls the other way) */
  bend: number;
  /** a factor of the scene's koi size */
  size: number;
  /** 0 at the surface … 1 near the floor */
  depth: number;
  /** where in its stroke the tail is */
  phase: number;
  /** only on wide or only on tall ponds */
  only?: "wide" | "tall";
};

export type PadPlacement = {
  x: number;
  y: number;
  px?: number;
  py?: number;
  /** a factor of the scene's pad size */
  size: number;
  /** rotation of the notch, degrees */
  notch: number;
  only?: "wide" | "tall";
};

export type Scene = {
  koi: KoiPlacement[];
  pads: PadPlacement[];
  /** the moon's reflection, seen only at night */
  moon: { x: number; y: number; px?: number; py?: number };
};

/** The home page: the whole pond, the introduction at the lower left (on tall screens, the lower half). */
export const HOME: Scene = {
  koi: [
    { x: 63, y: 31, px: 62, py: 21, angle: 196, bend: 0.07, size: 1.08, depth: 0.02, phase: 0.4 },
    { x: 84, y: 60, px: 78, py: 36, angle: 112, bend: -0.09, size: 1, depth: 0.12, phase: 2.1 },
    { x: 41, y: 19, px: 26, py: 20, angle: 344, bend: 0.03, size: 0.94, depth: 0.28, phase: 4.2 },
    { x: 20, y: 36, px: 34, py: 37, angle: 158, bend: -0.1, size: 0.9, depth: 0.5, phase: 1.3 },
    { x: 69, y: 83, angle: 18, bend: 0.09, size: 0.86, depth: 0.22, phase: 3.3, only: "wide" },
    { x: 49, y: 50, angle: 252, bend: 0.05, size: 1.02, depth: 0.08, phase: 5.1, only: "wide" },
    { x: 91, y: 19, angle: 64, bend: -0.05, size: 0.88, depth: 0.62, phase: 0.9, only: "wide" },
    { x: 8, y: 28, angle: 28, bend: 0.06, size: 0.8, depth: 0.4, phase: 2.7, only: "wide" },
  ],
  pads: [
    { x: 97, y: 37, px: 101, py: 31, size: 1.25, notch: 200 },
    { x: 92, y: 46, px: 92, py: 37, size: 0.62, notch: 120 },
    { x: 27, y: 2, px: 4, py: 18, size: 1, notch: 75 },
    { x: 36, y: 6, px: 13, py: 25, size: 0.5, notch: 300 },
    { x: 57, y: 97, size: 0.78, notch: 250, only: "wide" },
  ],
  moon: { x: 74, y: 22, px: 70, py: 14 },
};

/** The band of water at the top of the other pages: a few koi crossing it, a pad at either end. */
export const BAND: Scene = {
  koi: [
    { x: 74, y: 42, px: 66, py: 46, angle: 172, bend: 0.05, size: 1, depth: 0.06, phase: 1.1 },
    { x: 52, y: 22, px: 34, py: 56, angle: 12, bend: -0.06, size: 0.9, depth: 0.42, phase: 3.6 },
    { x: 84, y: 66, angle: 205, bend: 0.08, size: 0.84, depth: 0.25, phase: 5.2, only: "wide" },
    { x: 33, y: 30, angle: 350, bend: 0.04, size: 0.82, depth: 0.6, phase: 0.2, only: "wide" },
  ],
  pads: [
    { x: 99, y: 84, px: 101, py: 88, size: 1.1, notch: 160 },
    { x: 92, y: 97, px: 86, py: 99, size: 0.55, notch: 40 },
    { x: 36, y: 0, size: 0.8, notch: 280, only: "wide" },
  ],
  moon: { x: 62, y: 30, px: 56, py: 26 },
};

/** The page that is not there: open water, one koi that stayed. */
export const LOST: Scene = {
  koi: [{ x: 70, y: 40, px: 62, py: 30, angle: 140, bend: 0.11, size: 1.05, depth: 0.1, phase: 2.4 }],
  pads: [
    { x: 96, y: 70, px: 98, py: 50, size: 1.15, notch: 220 },
    { x: 89, y: 79, px: 86, py: 58, size: 0.55, notch: 20 },
  ],
  moon: { x: 32, y: 26, px: 30, py: 18 },
};

export const SCENES = { home: HOME, band: BAND, lost: LOST };
export type SceneName = keyof typeof SCENES;
