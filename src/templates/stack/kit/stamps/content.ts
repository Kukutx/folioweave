// Default content for <Stamps>: the owner's six specimen stamps (recordings 338 / 339).
// Positions are stamp centres on a design stage of STAGE.w × STAGE.h units; rot in degrees.
// A stamp is drawn in code (`art`, see specimens.tsx) or is a picture (`src`); `paper` is its
// paper colour. `aged` is the worn print it dissolves into while hovered; `label` is its name pill.

import type { StampArt } from "./paper";
import { craft, gaoHan, kensho, marble, night, specimen } from "./specimens";

/** One slow swing of the drift: amplitude (px, or degrees for the turn), period (s), and the
 *  moment of the period it starts at (s). It reads amplitude · −cos(2π (t + start) / period). */
export type Swing = [amplitude: number, period: number, start: number];

export type Stamp = {
  id: string;
  /** artwork drawn in code on the perforated paper */
  art?: StampArt;
  /** or a picture of the whole stamp (used when there is no `art`) */
  src?: string;
  paper?: string;
  aged?: string;
  label?: string;
  x: number;
  y: number;
  rot: number;
  /** how it drifts across the page (x, y in px) and turns (r in degrees); one is made up if left out */
  drift?: { x: Swing; y: Swing; r: Swing };
  alt?: string;
};

const A = "/templates/stack/stamps/";

export const STAGE = { w: 1110, h: 840 };
/** Stamp size on the stage. */
export const BOX = { w: 190, h: 237 };

// poses and drift as recorded (338): each stamp's centre, turn and swings, measured frame by frame
export const STAMPS: Stamp[] = [
  {
    id: "spec", art: specimen(), paper: "#f8f7f6", aged: A + "sepia.webp", label: "SPECIMEN",
    x: 166.3, y: 382.2, rot: -42.87,
    drift: { x: [2.54, 6.8, 6.74], y: [2.75, 7.65, 4.7], r: [0.347, 8.2, 1.87] },
  },
  {
    id: "kensho", art: kensho(), paper: "#f6f6f5", alt: "KENSHO TECHNOLGIES",
    x: 218.6, y: 249.5, rot: -16.17,
    drift: { x: [1.85, 7.2, 5.03], y: [1.09, 7.75, 1.65], r: [0.996, 6.85, 1.27] },
  },
  {
    id: "green", art: craft(), paper: "#eeefee", aged: A + "craft.webp", label: "NEW CRAFT SOCIETY",
    x: 381.56, y: 173.6, rot: 16.29,
    drift: { x: [3.98, 6.9, 1.64], y: [2.78, 6.4, 0.53], r: [0.713, 6.75, 4.39] },
  },
  {
    id: "sea", art: marble(), paper: "#eeeee9", alt: "motion",
    x: 947.9, y: 256.57, rot: -25.59,
    drift: { x: [2.91, 4.65, 1.67], y: [2.48, 10.25, 4.67], r: [0.245, 5.0, 0.66] },
  },
  {
    id: "dark", art: night(), paper: "#f3f1f0", alt: "Halftone night photograph",
    x: 533.1, y: 652.8, rot: 5.73,
    drift: { x: [4.67, 7.35, 4.74], y: [1.73, 6.4, 2.8], r: [0.107, 5.5, 5.44] },
  },
  {
    id: "gao", art: gaoHan(), paper: "#f1f1f1", alt: "高晗 GAO HAN",
    x: 666.3, y: 568.9, rot: -16.0,
    drift: { x: [1.46, 8.65, 5.14], y: [6.48, 7.8, 1.0], r: [0.76, 10.0, 7.65] },
  },
];

export const CLOSE_HINT = "CLICK ANYWHERE OR PRESS ESC.";
