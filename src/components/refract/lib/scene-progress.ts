import { clamp, mix, smooth } from "./motion";

export const sceneLayout = {
  mobile: 900,
  desktop: 1200,
  desktopQuery: "(min-width: 1200px)",
  menuQuery: "(max-width: 1199px)",
  reducedQuery: "(prefers-reduced-motion: reduce)",
} as const;

export const panelMotion = {
  enter: 350,
  leave: 250,
  offset: "120%",
  ease: "inOut(3)",
} as const;
/** One choreography shared by the pose and framing; no elapsed-time scroll lag. */
export const toolsMotion = {
  enter: 0.82,
  open: 0.875,
  close: 0.89,
  assembled: 0.938,
  orbitEnd: 0.938,
  exit: 0.948,
} as const;
export const toolsOpening = (p: number) =>
  smooth(toolsMotion.enter, toolsMotion.open, p) *
  (1 - smooth(toolsMotion.close, toolsMotion.assembled, p));
/** A complete local turn winds the glass into the closing assembly. Its end is
 * an identity rotation, so the normal globe continues without a phase jump. */
export const toolsTurn = (p: number) =>
  smooth(toolsMotion.close, toolsMotion.assembled, p);
/** Whole turns each of the four slices winds through, beyond the one they share,
 * as the assembly closes. The inner slices turn furthest, so the stack is drawn
 * together like a vortex; whole numbers bring every slice home in register, and
 * this many keep the outline as steady as a single turn does. */
const vortexTurns = [0, 1, 2, 1] as const;
export const toolsVortex = (p: number, slice: number) =>
  toolsTurn(p) * vortexTurns[Math.max(0, Math.min(3, slice))];
/** Optical energy peaks as the pieces meet, then settles to the normal glass.
 * Scroll owns this envelope, including reverse seeking and a stopped wheel. */
export const assemblyGlint = (p: number) =>
  smooth(0.375, 0.414, p) * (1 - smooth(0.42, 0.47, p)) +
  smooth(0.903, toolsMotion.assembled, p) * (1 - smooth(0.95, 0.972, p));
export const sceneExit = (p: number) => smooth(toolsMotion.exit, 1, p);
/** How much of a hand-turned yaw remains; none once the opening is left. */
export const heroSpin = (p: number) => 1 - smooth(0.02, 0.1, p);
/** The opening globe can be turned only while it is the whole composition. */
export const heroSpinLimit = 0.02;
/** The scene's readable gutter and the Tools copy enter/leave together. */
export const toolsCopyOpacity = (p: number) =>
  smooth(0.82, 0.845, p) * (1 - smooth(0.922, 0.94, p));
/** Keep the material through the physical fold. Only hand over to the globe
 * once the sheets have gathered into its volume; an early dissolve loses the
 * reassembly and leaves unrelated wire planes floating over the map. */
export function researchBlend(amount: number) {
  const surfaces = smooth(0.16, 0.34, amount);
  return { lines: smooth(0.11, 0.32, amount), globe: 1 - surfaces, surfaces };
}
export type ChapterRange = readonly [number, number];
export type ContinentalDriftOptions = {
  /** One scroll interval per project chapter that separates the continents. */
  ranges: readonly ChapterRange[];
  amplitude: number;
  spread?: number;
};

export type ChapterSize = { start: number; end: number };

/** Where the globe's facing passes from the clock to the scroll position: in
 * the drawing stage, while the globe is folded flat and its facing unseen. */
export const facingAnchor = 0.29;
/** The part of the world each project chapter turns to the reader, as globe
 * yaw: Africa and Europe, Asia, Oceania, the Americas. Always the same way
 * round, so scrolling on never spins the globe back. */
const galleryFaces = [-0.38, -1.57, -2.4, -4.7] as const;
export const galleryFace = (chapter: number) => {
  const index = Math.max(0, chapter);
  return (
    galleryFaces[index % galleryFaces.length] -
    Math.floor(index / galleryFaces.length) * Math.PI * 2
  );
};
const galleryPosition = (p: number, count: number) =>
  ((p - 0.42) / 0.4) * count;
/** Scroll owns the facing through the project chapters. A chapter holds its
 * part of the world while its copy is in place and turns to the next as the
 * page moves between the two, so every chapter shows different land and the
 * way there is as gradual as the scrolling itself. */
export function galleryYaw(p: number, projectCount: number) {
  const count = Math.max(1, projectCount);
  const position = clamp(galleryPosition(p, count), 0, count);
  const chapter = Math.max(0, Math.min(count - 1, Math.floor(position)));
  return mix(
    galleryFace(chapter),
    galleryFace(Math.min(count - 1, chapter + 1)),
    smooth(0.34, 0.74, position - chapter),
  );
}
const ramp = (from: number, to: number, value: number) =>
  clamp((value - from) / (to - from));
/** How far the continents of the chapter in view have left the globe, as the
 * phase `continentalPose` plays: 0 and 1 are the intact globe. The scroll
 * position owns it. The plates lift as a chapter's copy arrives, float while
 * it rests and close again as it leaves, so nothing plays by itself and
 * scrolling back undoes every step. `chapters` limits it to the first few. */
export function continentalScroll(
  p: number,
  projectCount: number,
  chapters = projectCount,
) {
  const count = Math.max(1, projectCount);
  const position = galleryPosition(p, count);
  const chapter = Math.max(0, Math.min(count - 1, Math.round(position)));
  if (chapter >= chapters) return 0;
  const offset = position - chapter;
  // The first chapter waits for the globe to re-form from the drawing stage.
  const [arrive, placed] = chapter === 0 ? [-0.02, 0.2] : [-0.44, -0.1];
  const hold = placed + 0.04;
  return (
    ramp(arrive, placed, offset) * 0.42 +
    ramp(placed, Math.max(hold, 0.22), offset) * 0.2 +
    ramp(Math.max(hold, 0.22), 0.46, offset) * 0.38
  );
}

/** The chapter whose continents separate at this position, or -1. */
export function chapterRanges(researchCount: number): ChapterRange[] {
  return [
    [0, 0.3],
    [0.3, 0.42],
    ...Array.from({ length: researchCount }, (_, index): ChapterRange => [
      0.42 + (0.4 * index) / researchCount,
      0.42 + (0.4 * (index + 1)) / researchCount,
    ]),
    [0.82, 0.94],
    [0.94, 1],
  ];
}

export function locateChapter(
  y: number,
  sizes: readonly ChapterSize[],
  distance: number,
) {
  const last = sizes.length - 1;
  const position = clamp(y, 0, distance);
  const found = sizes.findIndex(
    (size, index) => position < (index === last ? distance + 1 : size.end),
  );
  const index = found < 0 ? last : found;
  const range = sizes[index];
  const end = index === last ? distance : range.end;
  return {
    index,
    local: clamp((position - range.start) / Math.max(1, end - range.start)),
  };
}

export function sceneProgress(
  index: number,
  local: number,
  ranges: readonly ChapterRange[],
  reading: boolean,
  hasFigure: boolean,
) {
  const [start, end] = ranges[index];
  if (reading && index === 1) return mix(start, end, smooth(0.64, 1, local));
  if (reading && index >= 2 && index < ranges.length - 2) {
    return mix(
      start,
      end,
      clamp((local - 0.42) / ((hasFigure ? 0.7 : 0.94) - 0.42)),
    );
  }
  return mix(start, end, local);
}

export function readingPanel(phase: number, figure: boolean, reduced: boolean) {
  const start = figure ? 0.72 : -0.06;
  const end = figure ? 0.9 : 0.42;
  const reading = phase >= start && phase < end;
  const envelope = reading
    ? reduced
      ? 1
      : smooth(start, start + 0.02, phase) *
        (1 - smooth(end - 0.02, end, phase))
    : 0;
  const opacity = reading
    ? reduced
      ? 1
      : smooth(start + 0.025, start + 0.06, phase) *
        (1 - smooth(end - 0.08, end - 0.025, phase))
    : 0;
  return {
    envelope,
    opacity,
    shift: reduced ? 0 : (1 - opacity) * (phase < (start + end) / 2 ? 18 : -18),
  };
}

export function chapterScrollPosition(
  position: number,
  sizes: readonly ChapterSize[],
  distance: number,
) {
  const scaled = clamp(position) * sizes.length;
  const index = Math.min(sizes.length - 1, Math.floor(scaled));
  const end = index === sizes.length - 1 ? distance : sizes[index].end;
  return mix(sizes[index].start, end, scaled - index);
}
