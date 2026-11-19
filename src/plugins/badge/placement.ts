/**
 * Where the small badge can hang without covering anything.
 *
 * Templates differ: navigation sits in a corner, in a floating pill, across
 * the whole width of a phone. Rather than keep a rule per template, the
 * badge looks at what the page draws near the top (text, links, buttons,
 * pictures, headers) and hangs in the first free column from its side's
 * edge, as high as it can; the strap above it must cross nothing either.
 * When no column is free (a phone whose header spans the width), it does
 * not show; #badge links still open the badge.
 */

export type Box = { left: number; top: number; right: number; bottom: number };
export type Spot = {
  /** Distance from the chosen side's edge to the badge's centre line. */
  inset: number;
  /** Strap length from the top edge to the hardware. */
  hang: number;
};

/** The small badge's footprint around its centre line, with a margin for
 * its sway: hardware and card below the strap, the strap's V above. */
export const FOOTPRINT = { half: 38, height: 124, strapHalf: 14 };
export type Footprint = typeof FOOTPRINT;

/** On phones the small badge is drawn smaller (the stylesheet's
 * --badge-scale), so it fits beside a header pill. */
export const COMPACT = { below: 560, scale: 0.72 };

/** The footprint at the badge's size for this viewport width. */
export function footprintFor(width: number): Footprint {
  if (width > COMPACT.below) return FOOTPRINT;
  const k = COMPACT.scale;
  return {
    half: FOOTPRINT.half * k,
    height: FOOTPRINT.height * k,
    strapHalf: FOOTPRINT.strapHalf * k,
  };
}
const EDGE = 8;
const STEP = 4;
const MIN_HANG = 28;
/** Never hang lower than this; the badge belongs to the top of the page. */
export const MAX_HANG = 220;
/** How far in from the edge to look, as a share of the width. */
const REACH = 0.34;

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export function findSpot(
  obstacles: readonly Box[],
  viewport: { width: number; height: number },
  side: "left" | "right",
  extraHang = 0,
  footprint: Footprint = FOOTPRINT,
): Spot | null {
  const lowest = Math.min(
    MAX_HANG + extraHang,
    viewport.height - footprint.height - EDGE,
  );
  const first = Math.max(MIN_HANG, MIN_HANG + extraHang);
  const farthest = Math.max(EDGE + footprint.half, viewport.width * REACH);
  for (
    let inset = EDGE + footprint.half;
    inset <= farthest && inset <= viewport.width - EDGE - footprint.half;
    inset += STEP
  ) {
    const x = side === "right" ? viewport.width - inset : inset;
    for (let hang = first; hang <= lowest; hang += STEP) {
      const strap: Box = {
        left: x - footprint.strapHalf,
        right: x + footprint.strapHalf,
        top: 0,
        bottom: hang,
      };
      // Something above blocks the strap at this column: no lower hang helps.
      if (obstacles.some((box) => overlaps(box, strap))) break;
      const card: Box = {
        left: x - footprint.half,
        right: x + footprint.half,
        top: hang,
        bottom: hang + footprint.height,
      };
      if (!obstacles.some((box) => overlaps(box, card))) return { inset, hang };
    }
  }
  return null;
}

const SOLID =
  "header, nav, [role=banner], [role=navigation], a, button, input, select, textarea, img, picture, video, canvas, iframe, svg, [role=button], [role=img]";
const CONTROLS = "a, button, input, select, textarea, [role=button]";
const BARS = "header, nav, [role=banner], [role=navigation]";

/**
 * Boxes of what the page shows in its top `band` pixels: lines of text,
 * controls, pictures, and headers or navigation bars narrower than most of
 * the width (a full-width bar counts by its contents, so the strap may cross
 * its empty middle). Decorations hidden from assistive technology, very
 * large backgrounds and other plugins are not obstacles.
 */
export function pageObstacles(band: number, side: "left" | "right"): Box[] {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const huge = width * height * 0.4;
  // Only the strip the search covers matters.
  const reach = width * REACH + FOOTPRINT.half + 16;
  const region: Box =
    side === "right"
      ? { left: width - reach, right: width, top: 0, bottom: band }
      : { left: 0, right: reach, top: 0, bottom: band };
  const boxes: Box[] = [];
  const add = (rect: DOMRect, margin: number) => {
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < band &&
      rect.right > 0 &&
      rect.left < width &&
      rect.width * rect.height < huge
    )
      boxes.push({
        left: rect.left - margin,
        top: rect.top - margin,
        right: rect.right + margin,
        bottom: rect.bottom + margin,
      });
  };
  const shown = (element: Element) =>
    typeof element.checkVisibility === "function"
      ? element.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        })
      : true;
  for (const element of document.querySelectorAll(SOLID)) {
    if (element.closest("[data-plugin], dialog")) continue;
    if (element instanceof SVGElement && element.ownerSVGElement) continue;
    if (element.closest('[aria-hidden="true"]') && !element.matches(CONTROLS))
      continue;
    const rect = element.getBoundingClientRect();
    if (rect.top >= band || rect.bottom <= 0 || !shown(element)) continue;
    if (element.matches(BARS) && rect.width > width * 0.7) continue;
    add(rect, 12);
  }
  // Painted surfaces (cards, pills, bars, rules) in the strip, whatever
  // their markup: a background, a border or a shadow.
  for (const element of document.body.querySelectorAll("*")) {
    const rect = element.getBoundingClientRect();
    if (
      !rect.width ||
      !rect.height ||
      rect.width * rect.height >= huge ||
      !overlaps(
        {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        },
        region,
      ) ||
      element.closest("[data-plugin], dialog, svg")
    )
      continue;
    const style = getComputedStyle(element);
    const painted =
      !/^(?:transparent|rgba\(.*,\s*0\)|.*\/\s*0\))$/.test(
        style.backgroundColor,
      ) ||
      style.backgroundImage !== "none" ||
      style.boxShadow !== "none" ||
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) >
        0 ||
      parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) >
        0;
    if (painted && shown(element)) add(rect, 8);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.trim()) continue;
    const parent = node.parentElement;
    if (
      !parent ||
      parent.closest("[data-plugin], dialog, script, style, noscript, template")
    )
      continue;
    const box = parent.getBoundingClientRect();
    if (box.top >= band || box.bottom <= 0 || !box.width || !shown(parent))
      continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) add(rect, 8);
  }
  return boxes;
}
