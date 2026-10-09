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
  duration?: number;
  repeatDelay?: number;
  leadIn?: number;
};
export type ChapterSize = { start: number; end: number };

/** Each chapter turns a different face of the globe towards the reader. The
 * yaws follow the globe's own convention; chapters past the fourth repeat them. */
const continentalFocus = [-0.38, 1.58, -1.57, -2.25] as const;
export const continentalYaw = (chapter: number) =>
  continentalFocus[Math.max(0, chapter) % continentalFocus.length];

/** The chapter whose continents separate at this position, or -1. */
export function continentalChapter(
  progress: number,
  options?: ContinentalDriftOptions | false,
) {
  if (!options) return -1;
  return options.ranges.findIndex(
    ([start, end]) =>
      end > start &&
      progress >= start - (options.leadIn ?? 0) &&
      progress < end,
  );
}

/** Playback time never adds scroll distance or prevents leaving a chapter. */
export function continentalPhase(
  progress: number,
  options?: ContinentalDriftOptions | false,
  reduced = false,
  elapsed = 0,
) {
  if (!options || reduced || continentalChapter(progress, options) < 0)
    return -1;
  const duration =
    options.duration &&
    Number.isFinite(options.duration) &&
    options.duration > 0
      ? options.duration
      : 8;
  const repeat = options.repeatDelay;
  const time =
    repeat !== undefined && Number.isFinite(repeat) && repeat >= 0
      ? Math.max(0, elapsed) % (duration + repeat)
      : elapsed;
  return clamp(time / duration);
}

/** The renderer's active clock already pauses for hidden stages and reduced motion. */
export function createContinentalPlayback(
  options?: ContinentalDriftOptions | false,
) {
  let active = -1,
    elapsed = 0,
    previousClock = 0;
  return {
    sample(progress: number, clock: number, reduced = false) {
      const chapter = reduced ? -1 : continentalChapter(progress, options);
      const eligible = chapter >= 0;
      // Scrolling straight into the next chapter starts its own sequence.
      if (!eligible || chapter !== active) elapsed = 0;
      else elapsed += clamp(clock - previousClock, 0, 0.05);
      active = chapter;
      previousClock = clock;
      return eligible
        ? continentalPhase(progress, options, reduced, elapsed)
        : -1;
    },
  };
}

/** Data order, scroll seeking and the stage use the same chapter partition. */
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
