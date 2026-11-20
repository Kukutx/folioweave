/**
 * Sticker-sheet segmentation on plain RGBA buffers. No DOM, so it runs in a
 * worker, on the main thread and under Node's test runner alike.
 *
 * The rules are the original EmojiCut's: anything that is neither near-white
 * nor transparent is ink; 4-connected ink forms components; components big
 * enough to be a sticker become boxes; boxes closer than 15px merge; each box
 * is cut with 2px of padding, the paper around it is removed by a flood fill
 * from its edges (so holes inside a sticker stay filled) and a 6px white
 * outline is added.
 *
 * Long loops are generators that yield their progress (0..1) every so often:
 * a worker drains them in one go, the main-thread fallback pauses between
 * yields so the page stays responsive.
 */

/** Row-major RGBA pixels, the shape of ImageData. */
export type Pixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
};
export type Rect = { minX: number; maxX: number; minY: number; maxY: number };
/** A cut sticker and where its cutout started on the sheet. */
export type CutPixels = { x: number; y: number; pixels: Pixels };

export const RULES = {
  /** Smallest component that can be (part of) a sticker, in pixels. */
  minPixels: 50,
  /** Its bounding box must be wider and taller than this. */
  minSide: 5,
  /** Boxes closer than this many pixels belong to the same sticker. */
  mergeDistance: 15,
  padding: 2,
  outline: 6,
} as const;

/** Pixels of work between two yields. */
const STEP = 1 << 18;

/** White paper or transparency. */
export function isBackground(r: number, g: number, b: number, a: number) {
  return a < 20 || (r > 240 && g > 240 && b > 240);
}

/** Sets mask to 1 for ink and 0 for background, for rows [from, to). */
export function markInk(
  { width, data }: Pixels,
  mask: Uint8Array,
  from: number,
  to: number,
) {
  for (let i = from * width, o = i * 4, end = to * width; i < end; i++, o += 4)
    mask[i] = isBackground(data[o], data[o + 1], data[o + 2], data[o + 3])
      ? 0
      : 1;
}

/** A growable stack of pixel indices. */
class IndexStack {
  items = new Int32Array(4096);
  length = 0;
  push(value: number) {
    if (this.length === this.items.length) {
      const next = new Int32Array(this.items.length * 2);
      next.set(this.items);
      this.items = next;
    }
    this.items[this.length++] = value;
  }
  pop() {
    return this.items[--this.length];
  }
}

/**
 * Bounding boxes of the 4-connected ink components that are big enough to be
 * a sticker, in raster order of their first pixel. Consumes `mask`: visited
 * ink is marked 2.
 */
export function* findComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): Generator<number, Rect[], void> {
  const total = width * height;
  const rects: Rect[] = [];
  const stack = new IndexStack();
  let work = 0;
  for (let start = 0; start < total; start++) {
    if (++work >= STEP) {
      work = 0;
      yield start / total;
    }
    if (mask[start] !== 1) continue;
    let minX = start % width;
    let maxX = minX;
    let minY = (start - minX) / width;
    let maxY = minY;
    let count = 0;
    mask[start] = 2;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop();
      const x = i % width;
      const y = (i - x) / width;
      if (x < minX) minX = x;
      else if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      else if (y > maxY) maxY = y;
      count++;
      if (x + 1 < width && mask[i + 1] === 1) {
        mask[i + 1] = 2;
        stack.push(i + 1);
      }
      if (x > 0 && mask[i - 1] === 1) {
        mask[i - 1] = 2;
        stack.push(i - 1);
      }
      if (y + 1 < height && mask[i + width] === 1) {
        mask[i + width] = 2;
        stack.push(i + width);
      }
      if (y > 0 && mask[i - width] === 1) {
        mask[i - width] = 2;
        stack.push(i - width);
      }
      // One component can cover most of a large sheet.
      if (++work >= STEP) {
        work = 0;
        yield start / total;
      }
    }
    if (
      count > RULES.minPixels &&
      maxX - minX > RULES.minSide &&
      maxY - minY > RULES.minSide
    )
      rects.push({ minX, maxX, minY, maxY });
  }
  return rects;
}

/** Gap between two boxes along each axis (0 when they overlap). */
function near(a: Rect, b: Rect, distance: number) {
  return (
    Math.max(0, a.minX - b.maxX, b.minX - a.maxX) < distance &&
    Math.max(0, a.minY - b.maxY, b.minY - a.maxY) < distance
  );
}

/**
 * Merges boxes closer than `distance` until no two are, growing a box can
 * bring it near another. The result does not depend on the order of merges;
 * each box keeps the position of its earliest member.
 */
export function mergeRects(
  rects: readonly Rect[],
  distance: number = RULES.mergeDistance,
): Rect[] {
  const boxes = rects.map((rect) => ({ ...rect }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      for (let j = i + 1; j < boxes.length; ) {
        const b = boxes[j];
        if (!near(a, b, distance)) {
          j++;
          continue;
        }
        a.minX = Math.min(a.minX, b.minX);
        a.minY = Math.min(a.minY, b.minY);
        a.maxX = Math.max(a.maxX, b.maxX);
        a.maxY = Math.max(a.maxY, b.maxY);
        boxes.splice(j, 1);
        changed = true;
        j = i + 1; // `a` grew: look at the rest again.
      }
    }
  }
  return boxes;
}

/** Re-yields an inner generator's progress mapped onto [from, from + span]. */
function* scaled<T>(
  inner: Generator<number, T, void>,
  from: number,
  span: number,
): Generator<number, T, void> {
  for (;;) {
    const step = inner.next();
    if (step.done) return step.value;
    yield from + step.value * span;
  }
}

/** The boxes of every sticker on a sheet. Yields progress 0..1. */
export function* findStickers(sheet: Pixels): Generator<number, Rect[], void> {
  const { width, height } = sheet;
  const mask = new Uint8Array(width * height);
  const rows = Math.max(1, Math.floor(STEP / Math.max(1, width)));
  for (let y = 0; y < height; y += rows) {
    markInk(sheet, mask, y, Math.min(height, y + rows));
    yield (0.25 * y) / height;
  }
  const rects = yield* scaled(findComponents(mask, width, height), 0.25, 0.75);
  return readingOrder(mergeRects(rects));
}

/**
 * Sorts boxes as a sheet is read: rows top to bottom, each left to right.
 * A box joins a row when its vertical middle falls inside the row's band.
 */
export function readingOrder(rects: readonly Rect[]): Rect[] {
  const byTop = [...rects].sort((a, b) => a.minY - b.minY || a.minX - b.minX);
  const rows: { top: number; bottom: number; items: Rect[] }[] = [];
  for (const rect of byTop) {
    const middle = (rect.minY + rect.maxY) / 2;
    const row = rows.find((r) => middle >= r.top && middle <= r.bottom);
    if (row) {
      row.items.push(rect);
      row.top = Math.min(row.top, rect.minY);
      row.bottom = Math.max(row.bottom, rect.maxY);
    } else rows.push({ top: rect.minY, bottom: rect.maxY, items: [rect] });
  }
  return rows.flatMap((row) => row.items.sort((a, b) => a.minX - b.minX));
}

/** Runs a generator to completion and returns its result. */
export function drain<T>(work: Generator<unknown, T, void>): T {
  for (;;) {
    const step = work.next();
    if (step.done) return step.value;
  }
}

/**
 * The outline's brush: every offset within R + 0.5 pixels of a seed, with
 * coverage falling from 255 to 0 over the last pixel, so the edge is
 * anti-aliased.
 */
function brush(radius: number) {
  const dx: number[] = [];
  const dy: number[] = [];
  const level: number[] = [];
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++) {
      const cover = Math.min(1, radius + 0.5 - Math.hypot(x, y));
      if (cover <= 0) continue;
      dx.push(x);
      dy.push(y);
      level.push(Math.round(cover * 255));
    }
  return { dx, dy, level };
}

const BRUSH = brush(RULES.outline);

/** Whether a Uint32 holds RGBA as R in its lowest byte. */
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/**
 * White coverage (0..255) around the seeds: the brush stamped on every seed
 * at the seeds' edge, keeping the highest value. That is the exact
 * anti-aliased disc dilation (the nearest seed to any pixel outside is an
 * edge seed), at a fraction of a full distance transform's cost. Seeds must
 * lie at least the outline's width inside the frame.
 */
export function outlineCoverage(seeds: Uint8Array, width: number, height: number) {
  const cover = new Uint8Array(width * height);
  const { dx, dy, level } = BRUSH;
  const offsets = dx.map((x, k) => dy[k] * width + x);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1, i = y * width + 1; x < width - 1; x++, i++) {
      if (!seeds[i]) continue;
      cover[i] = 255;
      if (seeds[i - 1] && seeds[i + 1] && seeds[i - width] && seeds[i + width]) continue;
      for (let k = 0; k < offsets.length; k++) {
        const j = i + offsets[k];
        if (cover[j] < level[k]) cover[j] = level[k];
      }
    }
  return cover;
}

/**
 * Cuts one sticker: the box with padding, the paper around it made
 * transparent, and a white outline. Null when the box is empty.
 */
export function extractSticker(sheet: Pixels, rect: Rect): CutPixels | null {
  const { padding, outline: R } = RULES;
  const x0 = Math.max(0, Math.floor(rect.minX - padding));
  const y0 = Math.max(0, Math.floor(rect.minY - padding));
  const w = Math.floor(
    Math.min(sheet.width - x0, rect.maxX - rect.minX + padding * 2),
  );
  const h = Math.floor(
    Math.min(sheet.height - y0, rect.maxY - rect.minY + padding * 2),
  );
  if (w <= 0 || h <= 0) return null;

  // 1. The cutout's paper: 1 for background, 2 once reached from an edge.
  const src = sheet.data;
  const stride = sheet.width * 4;
  const paper = new Uint8Array(w * h);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0, o = (y0 + y) * stride + x0 * 4; x < w; x++, i++, o += 4)
      if (isBackground(src[o], src[o + 1], src[o + 2], src[o + 3])) paper[i] = 1;
  }
  const stack = new IndexStack();
  const last = (h - 1) * w;
  for (let x = 0; x < w; x++) {
    stack.push(x);
    stack.push(last + x);
  }
  for (let y = 1; y < h - 1; y++) {
    stack.push(y * w);
    stack.push(y * w + w - 1);
  }
  while (stack.length > 0) {
    const i = stack.pop();
    if (paper[i] !== 1) continue;
    paper[i] = 2;
    const x = i % w;
    if (x > 0 && paper[i - 1] === 1) stack.push(i - 1);
    if (x < w - 1 && paper[i + 1] === 1) stack.push(i + 1);
    if (i >= w && paper[i - w] === 1) stack.push(i - w);
    if (i < last && paper[i + w] === 1) stack.push(i + w);
  }

  // 2. The outline around what stays (where it is mostly opaque), on a
  //    canvas with room for it.
  const W = w + R * 2;
  const H = h + R * 2;
  const seeds = new Uint8Array(W * H);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0, o = (y0 + y) * stride + x0 * 4 + 3, S = (y + R) * W + R; x < w; x++, i++, o += 4, S++)
      if (paper[i] !== 2 && src[o] >= 128) seeds[S] = 1;
  }
  const cover = outlineCoverage(seeds, W, H);

  // 3. The white outline, then the sticker over it, a pixel per 32-bit word
  //    where the byte order allows.
  const out = new Uint8ClampedArray(W * H * 4);
  const words = LITTLE_ENDIAN ? new Uint32Array(out.buffer) : null;
  const sourceWords =
    LITTLE_ENDIAN && src.byteOffset % 4 === 0
      ? new Uint32Array(src.buffer, src.byteOffset, src.length >> 2)
      : null;
  for (let I = 0; I < cover.length; I++) {
    const c = cover[I];
    if (c === 0) continue;
    if (words) words[I] = ((c << 24) | 0xffffff) >>> 0;
    else {
      out.fill(255, I * 4, I * 4 + 3);
      out[I * 4 + 3] = c;
    }
  }
  for (let y = 0, i = 0; y < h; y++) {
    let o = (y0 + y) * stride + x0 * 4;
    let O = ((y + R) * W + R) * 4;
    for (let x = 0; x < w; x++, i++, o += 4, O += 4) {
      if (paper[i] === 2) continue;
      const a = src[o + 3];
      if (a === 255) {
        if (words && sourceWords) words[O >> 2] = sourceWords[o >> 2];
        else out.set(src.subarray(o, o + 4), O);
        continue;
      }
      // Partly transparent ink over the outline's white.
      const alpha = a / 255;
      const under = (out[O + 3] / 255) * (1 - alpha);
      const total = alpha + under;
      if (total === 0) continue;
      out[O] = (src[o] * alpha + 255 * under) / total;
      out[O + 1] = (src[o + 1] * alpha + 255 * under) / total;
      out[O + 2] = (src[o + 2] * alpha + 255 * under) / total;
      out[O + 3] = total * 255 + 0.5;
    }
  }
  return { x: x0, y: y0, pixels: { width: W, height: H, data: out } };
}
