/*
 * The cutter, off the main thread: decodes the sheet, finds and cuts the
 * stickers and encodes them, posting progress on the way. It keeps the
 * decoded sheet for stickers added by hand until it is terminated, which is
 * also how a run is cancelled.
 */
import { cropSheet, cutSheet, type CutProgress } from "./engine.ts";
import type { CutRequest, CutResponse } from "./protocol.ts";
import type { Pixels } from "./segment.ts";

type WorkerScope = {
  postMessage(message: CutResponse): void;
  onmessage: ((event: MessageEvent<CutRequest>) => void) | null;
};
const scope = self as unknown as WorkerScope;

/** Progress is posted at most this often. */
const PROGRESS_MS = 50;

let sheet: Pixels | null = null;

async function decode(blob: Blob): Promise<Pixels> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No 2D context");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = context.getImageData(0, 0, width, height);
  canvas.width = canvas.height = 0;
  return { width, height, data };
}

async function encode({ width, height, data }: Pixels): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D context");
  context.putImageData(new ImageData(data, width, height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

async function handle(request: CutRequest) {
  if (request.type === "crop") {
    const sticker = sheet ? await cropSheet(sheet, request.rect, encode) : null;
    scope.postMessage({ type: "crop", id: request.id, sticker });
    return;
  }
  sheet = null;
  try {
    sheet = await decode(request.sheet);
  } catch (error) {
    scope.postMessage({ type: "error", code: "decode", message: String(error) });
    return;
  }
  let posted = 0;
  let stage = "";
  const onProgress = (progress: CutProgress) => {
    const now = performance.now();
    const news =
      progress.stage !== stage ||
      (progress.stage === "cut" && progress.done === progress.total);
    if (!news && now - posted < PROGRESS_MS) return;
    posted = now;
    stage = progress.stage;
    scope.postMessage({ type: "progress", progress });
  };
  const stickers = await cutSheet(sheet, encode, onProgress);
  scope.postMessage({ type: "cut", stickers });
}

scope.onmessage = (event) => {
  handle(event.data).catch((error: unknown) =>
    scope.postMessage({ type: "error", code: "process", message: String(error) }),
  );
};
