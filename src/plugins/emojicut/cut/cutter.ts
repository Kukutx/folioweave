import {
  cropSheet,
  cutSheet,
  type CutProgress,
  type CutResult,
  type Pause,
} from "./engine.ts";
import type { CutErrorCode, CutRequest, CutResponse } from "./protocol.ts";
import type { Pixels, Rect } from "./segment.ts";

export type { CutProgress, CutResult };

export class CutError extends Error {
  readonly code: CutErrorCode | "cancelled";
  constructor(code: CutErrorCode | "cancelled", message: string = code) {
    super(message);
    this.name = "CutError";
    this.code = code;
  }
}

/**
 * One sheet's cutting: `cut` it, then `crop` more stickers from it by hand.
 * `dispose` stops whatever is running (pending calls reject as cancelled)
 * and frees the sheet.
 */
export interface CutSession {
  cut(sheet: Blob, onProgress: (progress: CutProgress) => void): Promise<CutResult[]>;
  crop(rect: Rect): Promise<CutResult | null>;
  dispose(): void;
}

/** Work runs in a module worker where the browser can paint off-screen there. */
export function createCutSession(): CutSession {
  const workerReady =
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function" &&
    "convertToBlob" in OffscreenCanvas.prototype;
  return workerReady ? new WorkerSession() : new MainThreadSession();
}

type Deferred<T> = { resolve: (value: T) => void; reject: (error: unknown) => void };

class WorkerSession implements CutSession {
  private worker: Worker | null = null;
  /** Takes over when the worker cannot start or dies. */
  private fallback: MainThreadSession | null = null;
  private sheet: Blob | null = null;
  private cutCall: (Deferred<CutResult[]> & { onProgress: (p: CutProgress) => void }) | null = null;
  private crops = new Map<number, Deferred<CutResult | null> & { rect: Rect }>();
  private nextId = 1;
  private disposed = false;

  constructor() {
    try {
      this.worker = new Worker(new URL("./cut.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (event: MessageEvent<CutResponse>) =>
        this.receive(event.data);
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.failOver();
      };
    } catch {
      this.failOver();
    }
  }

  private send(request: CutRequest) {
    this.worker?.postMessage(request);
  }

  cut(sheet: Blob, onProgress: (progress: CutProgress) => void) {
    if (this.disposed) return Promise.reject(new CutError("cancelled"));
    this.sheet = sheet;
    if (this.fallback) return this.fallback.cut(sheet, onProgress);
    return new Promise<CutResult[]>((resolve, reject) => {
      this.cutCall?.reject(new CutError("cancelled"));
      this.cutCall = { resolve, reject, onProgress };
      this.send({ type: "cut", sheet });
    });
  }

  crop(rect: Rect) {
    if (this.disposed) return Promise.reject(new CutError("cancelled"));
    if (this.fallback) return this.fallback.crop(rect);
    return new Promise<CutResult | null>((resolve, reject) => {
      const id = this.nextId++;
      this.crops.set(id, { resolve, reject, rect });
      this.send({ type: "crop", id, rect });
    });
  }

  private receive(message: CutResponse) {
    switch (message.type) {
      case "progress":
        this.cutCall?.onProgress(message.progress);
        break;
      case "cut":
        this.cutCall?.resolve(message.stickers);
        this.cutCall = null;
        break;
      case "crop":
        this.crops.get(message.id)?.resolve(message.sticker);
        this.crops.delete(message.id);
        break;
      case "error":
        this.cutCall?.reject(new CutError(message.code, message.message));
        this.cutCall = null;
        break;
    }
  }

  /** Replays whatever was waiting on the main thread. */
  private failOver() {
    this.worker?.terminate();
    this.worker = null;
    if (this.disposed || this.fallback) return;
    const fallback = new MainThreadSession(this.sheet);
    this.fallback = fallback;
    const call = this.cutCall;
    this.cutCall = null;
    if (call && this.sheet)
      fallback.cut(this.sheet, call.onProgress).then(call.resolve, call.reject);
    for (const crop of this.crops.values())
      fallback.crop(crop.rect).then(crop.resolve, crop.reject);
    this.crops.clear();
  }

  dispose() {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
    this.fallback?.dispose();
    this.sheet = null;
    const cancelled = new CutError("cancelled");
    this.cutCall?.reject(cancelled);
    this.cutCall = null;
    for (const crop of this.crops.values()) crop.reject(cancelled);
    this.crops.clear();
  }
}

/** Main-thread work is cut into slices this long, so the page keeps painting. */
const SLICE_MS = 12;

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function decodeOnPage(blob: Blob): Promise<Pixels> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let release = () => {};
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    ({ width, height } = bitmap);
    source = bitmap;
    release = () => bitmap.close();
  } else {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    width = image.naturalWidth;
    height = image.naturalHeight;
    source = image;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No 2D context");
  context.drawImage(source, 0, 0);
  release();
  const { data } = context.getImageData(0, 0, width, height);
  canvas.width = canvas.height = 0;
  return { width, height, data };
}

function encodeOnPage({ width, height, data }: Pixels): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.putImageData(new ImageData(data, width, height), 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
      "image/png",
    ),
  );
}

/** The same cutter on the page itself, in short slices. */
class MainThreadSession implements CutSession {
  private pixels: Pixels | null = null;
  private disposed = false;

  constructor(private sheet: Blob | null = null) {}

  private pause: Pause = (() => {
    let sliceStart = performance.now();
    return () => {
      if (this.disposed) throw new CutError("cancelled");
      if (performance.now() - sliceStart < SLICE_MS) return;
      return nextTask().then(() => {
        if (this.disposed) throw new CutError("cancelled");
        sliceStart = performance.now();
      });
    };
  })();

  private async load(sheet: Blob) {
    try {
      const pixels = await decodeOnPage(sheet);
      if (this.disposed) throw new CutError("cancelled");
      return pixels;
    } catch (error) {
      throw error instanceof CutError ? error : new CutError("decode", String(error));
    }
  }

  async cut(sheet: Blob, onProgress: (progress: CutProgress) => void) {
    this.sheet = sheet;
    this.pixels = await this.load(sheet);
    try {
      return await cutSheet(this.pixels, encodeOnPage, onProgress, this.pause);
    } catch (error) {
      throw error instanceof CutError ? error : new CutError("process", String(error));
    }
  }

  async crop(rect: Rect) {
    if (!this.pixels && this.sheet) this.pixels = await this.load(this.sheet);
    return this.pixels ? cropSheet(this.pixels, rect, encodeOnPage) : null;
  }

  dispose() {
    this.disposed = true;
    this.pixels = null;
    this.sheet = null;
  }
}
