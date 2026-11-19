import type { CutProgress, CutResult } from "./engine.ts";
import type { Rect } from "./segment.ts";

/** Messages to the cut worker. */
export type CutRequest =
  | { type: "cut"; sheet: Blob }
  | { type: "crop"; id: number; rect: Rect };

/** Messages from the cut worker. */
export type CutResponse =
  | { type: "progress"; progress: CutProgress }
  | { type: "cut"; stickers: CutResult[] }
  | { type: "crop"; id: number; sticker: CutResult | null }
  | { type: "error"; code: CutErrorCode; message: string };

/** `decode`: the file is not an image the browser can read. */
export type CutErrorCode = "decode" | "process";
