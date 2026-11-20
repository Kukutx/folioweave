// Default content for <Pocket>: the "digital art" pocket of recording 343 and its three prints.
// Print positions are centres on the design stage (STAGE units); fan / spread say how far each
// print turns and slides while the pocket is held; open = side of the enlarged print (px).

export type PocketPrint = {
  id: string;
  src: string;
  alt?: string;
  x: number;
  y: number;
  rot: number;
  fan: number;
  spread: number;
  open: number;
};

const A = "/templates/stack/pocket/";

export const STAGE = { w: 440, h: 292 };
export const POCKET = { x: 29.5, y: 99, w: 380, h: 181.5 };
/** The perforated edge: holes of radius r whose centres sit `inset` px inside the edge, from x0 / y0 every dx / dy. */
export const PERF = { r: 9.3, inset: 1.7, x0: 24, dx: 33.8, nx: 11, y0: 21.5, dy: 34.5, ny: 5 };
export const PRINT = 106.25;

export const PRINTS: PocketPrint[] = [
  { id: "bee", src: A + "bee.webp", x: 154.73, y: 94.74, rot: -11.99, fan: -1, spread: -1, open: 269.9 },
  { id: "butterfly", src: A + "butterfly.webp", x: 220.0, y: 94.8, rot: 0, fan: 0.288, spread: 0.329, open: 329.3 },
  { id: "peach", src: A + "peach.webp", x: 289.44, y: 95.56, rot: 11.9, fan: 1, spread: 1.123, open: 300 },
];

export const LABEL = { title: "digital art", tool: "tool: procreate", date: "sep 2024" };

// Measured on the 343 recording (30 fps), one value per frame. Fan: extra rotation (deg) of the outer
// prints while held; lift: vertical shift of the prints (px, + = down); release: decay of the fan.
export const FAN_FPS = 30;
export const FAN = {
  press: [0.15, 0.1, 0.43, 1.33, 1.97, 2.88, 4.18, 5.24, 5.76, 6.43, 7.23, 8.24, 8.54, 9.09, 9.16, 8.51, 8.64, 8.56, 8.75, 9.09, 8.89, 8.79, 8.59, 8.82, 9.11, 9.31],
  lift: [-0.02, 0.08, 0.19, 0.28, 0.24, 0.18, 0.22, 0.25, 0.31, 0.34, 0.27, 0.33, 0.61, 0.76, 0.7, 0.79, 1.09, 1.3, 1.22, 1.05, 1.0, 0.77, 0.45, 0.12, -0.24],
  release: [9.63, 9.31, 8.75, 7.65, 6.81, 5.9, 5.62, 4.83, 4.15, 3.55, 2.97, 2.48, 2.23, 1.89, 1.53, 1.24, 1.22, 0.98, 0.97, 0.76, 0.76, 0.72, 0.73, 0.58, 0.46, 0.42, 0.39, 0.3, 0.15, 0],
};
