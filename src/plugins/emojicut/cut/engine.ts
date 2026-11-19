import {
  extractSticker,
  findStickers,
  type Pixels,
  type Rect,
} from "./segment.ts";

/** What the cutter is doing; `fraction` covers the whole run (0..1). */
export type CutProgress = {
  stage: "scan" | "cut";
  done: number;
  total: number;
  fraction: number;
};

/** One cut sticker as a PNG, and where it was on the sheet. */
export type CutResult = {
  blob: Blob;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Turns pixels into a PNG (OffscreenCanvas in a worker, canvas otherwise). */
export type Encode = (pixels: Pixels) => Promise<Blob>;
/**
 * Called between chunks of work. A worker passes nothing; the main thread
 * returns a promise when it is time to let the page paint, and throws to
 * cancel.
 */
export type Pause = () => Promise<void> | void;

/** Finding stickers is the first quarter of a run; cutting them the rest. */
const SCAN_SHARE = 0.25;
/** PNG encodes that may run while the next sticker is cut. */
const ENCODE_WINDOW = 4;

async function encodeSticker(
  sheet: Pixels,
  rect: Rect,
  encode: Encode,
): Promise<CutResult | null> {
  const cut = extractSticker(sheet, rect);
  if (!cut) return null;
  return {
    blob: await encode(cut.pixels),
    x: cut.x,
    y: cut.y,
    width: cut.pixels.width,
    height: cut.pixels.height,
  };
}

/** Finds and cuts every sticker on a sheet, in the sheet's order. */
export async function cutSheet(
  sheet: Pixels,
  encode: Encode,
  onProgress: (progress: CutProgress) => void,
  pause?: Pause,
): Promise<CutResult[]> {
  const scan = findStickers(sheet);
  let rects: Rect[];
  for (;;) {
    const step = scan.next();
    if (step.done) {
      rects = step.value;
      break;
    }
    onProgress({ stage: "scan", done: 0, total: 0, fraction: step.value * SCAN_SHARE });
    await pause?.();
  }

  const total = rects.length;
  const pending: Promise<CutResult | null>[] = [];
  const results: Array<CutResult | null> = [];
  let done = 0;
  const settle = async () => {
    results.push(await pending.shift()!);
    done++;
    onProgress({
      stage: "cut",
      done,
      total,
      fraction: SCAN_SHARE + (1 - SCAN_SHARE) * (done / total),
    });
  };
  onProgress({ stage: "cut", done: 0, total, fraction: SCAN_SHARE });
  for (const rect of rects) {
    pending.push(encodeSticker(sheet, rect, encode));
    if (pending.length >= ENCODE_WINDOW) await settle();
    await pause?.();
  }
  while (pending.length) await settle();
  return results.filter((result): result is CutResult => result !== null);
}

/** Cuts one more sticker from a box the visitor drew. */
export function cropSheet(sheet: Pixels, rect: Rect, encode: Encode) {
  return encodeSticker(sheet, rect, encode);
}
