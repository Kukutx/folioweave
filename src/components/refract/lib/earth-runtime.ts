import type { EarthRenderer, EarthRendererOptions } from "./earth-renderer";
import { sceneLayout } from "./scene-progress";
import type { ReadingBounds } from "./scene-camera";

export type SceneState = {
  width: number;
  height: number;
  pixelRatio: number;
  progress: number;
  spin: number;
  intro: number;
  paused: boolean;
  suspended: boolean;
  reduced: boolean;
  layout: { centerY: number; radius: number } | null;
  toolsBounds: ReadingBounds | null;
  exactTime?: number;
};
export type SceneWorkerInput =
  | { type: "init"; options: EarthRendererOptions; state: SceneState }
  | { type: "state"; state: SceneState }
  | { type: "presented" };
export type SceneWorkerOutput =
  | { type: "ready" }
  | { type: "frame"; bitmap: ImageBitmap; duration: number }
  | { type: "error"; message: string };

/** Keep scene drawing off the scroll/UI thread. A bounded one-frame mailbox
 * prevents stale bitmap queues; Canvas2D stays available for an exact fallback. */
export async function createEarthRuntime(
  canvas: HTMLCanvasElement,
  options: EarthRendererOptions,
): Promise<EarthRenderer> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    const { createEarthRenderer } = await import("./earth-renderer");
    canvas.dataset.renderThread = "main";
    return createEarthRenderer(canvas, options);
  }
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    const { createEarthRenderer } = await import("./earth-renderer");
    return createEarthRenderer(canvas, options);
  }
  let destroyed = false,
    pending = false,
    worker: Worker | undefined,
    fallback: EarthRenderer | undefined;
  let visible = true,
    explicitlySuspended = false;
  const state: SceneState = {
    width: 1,
    height: 1,
    pixelRatio: 1,
    progress: 0,
    spin: 0,
    intro: options.introProgress ?? 1,
    paused: false,
    suspended: false,
    reduced: !!options.reducedMotion,
    layout: null,
    toolsBounds: options.toolsBounds ?? null,
  };
  const measure = () => {
    const rect = canvas.getBoundingClientRect();
    state.width = Math.max(1, options.width ?? rect.width);
    state.height = Math.max(1, options.height ?? rect.height);
    state.pixelRatio = Math.min(
      options.pixelRatio ?? (window.devicePixelRatio || 1),
      state.width < sceneLayout.mobile ? 1.5 : 1.8,
    );
  };
  measure();
  const send = () => {
    pending = false;
    if (destroyed) return;
    state.suspended = explicitlySuspended || !visible || document.hidden;
    if (fallback) {
      fallback.setSuspended(true);
      fallback.setReducedMotion(state.reduced);
      fallback.setIntroProgress(state.intro);
      fallback.setMobileLayout(state.layout);
      fallback.setToolsBounds(state.toolsBounds);
      fallback.setProgress(state.progress);
      fallback.setSpin(state.spin);
      fallback.setPaused(state.paused);
      fallback.setSuspended(state.suspended);
      if (state.exactTime !== undefined)
        fallback.drawAtProgress(state.progress, state.exactTime);
    } else
      worker?.postMessage({ type: "state", state } satisfies SceneWorkerInput);
    delete state.exactTime;
  };
  // Scroll is already sampled once per animation frame by the controller.
  // Batch its synchronous setters without waiting a second frame to send them.
  const schedule = () => {
    if (destroyed || pending) return;
    pending = true;
    queueMicrotask(() => {
      if (pending) send();
    });
  };
  const stopWorker = () => {
    worker?.terminate();
    worker = undefined;
  };
  let recovery: Promise<void> | undefined;
  const recover = () =>
    (recovery ??= (async () => {
      if (destroyed) return;
      stopWorker();
      const { createEarthRenderer } = await import("./earth-renderer");
      if (destroyed) return;
      fallback = createEarthRenderer(canvas, options);
      canvas.dataset.renderThread = "main";
      send();
    })());
  try {
    worker = new Worker(new URL("./earth-worker.ts", import.meta.url), {
      type: "module",
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Scene worker initialization timed out")),
        5000,
      );
      const fail = (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
        void recover();
      };
      worker!.onerror = fail;
      worker!.onmessage = ({ data }: MessageEvent<SceneWorkerOutput>) => {
        if (data.type === "ready") {
          window.clearTimeout(timeout);
          canvas.dataset.renderThread = "worker";
          resolve();
          return;
        }
        if (data.type === "error") {
          fail(new Error(data.message));
          return;
        }
        const bitmap = data.bitmap;
        if (!destroyed && !state.suspended) {
          if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
          if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
        if (!destroyed)
          worker?.postMessage({ type: "presented" } satisfies SceneWorkerInput);
      };
      worker!.postMessage({
        type: "init",
        options,
        state,
      } satisfies SceneWorkerInput);
    });
  } catch {
    await recover();
  }
  const resize = () => {
    measure();
    fallback?.resize();
    schedule();
  };
  const visibility = () => {
    send();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      send();
    },
    { rootMargin: "60px" },
  );
  intersection.observe(canvas);
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  return {
    setToolsBounds(bounds) {
      state.toolsBounds = bounds;
      schedule();
    },
    setIntroProgress(value) {
      if (Number.isFinite(value)) {
        state.intro = value;
        schedule();
      }
    },
    setProgress(value) {
      if (Number.isFinite(value) && state.progress !== value) {
        state.progress = value;
        schedule();
      }
    },
    setSpin(value) {
      if (Number.isFinite(value) && state.spin !== value) {
        state.spin = value;
        schedule();
      }
    },
    setMobileLayout(value) {
      if (
        state.layout?.centerY === value?.centerY &&
        state.layout?.radius === value?.radius
      )
        return;
      state.layout = value;
      schedule();
    },
    setPaused(value) {
      if (state.paused !== value) {
        state.paused = value;
        schedule();
      }
    },
    setSuspended(value) {
      if (explicitlySuspended !== value) {
        explicitlySuspended = value;
        schedule();
      }
    },
    setReducedMotion(value) {
      if (state.reduced !== value) {
        state.reduced = value;
        schedule();
      }
    },
    drawAtProgress(value, time = 0) {
      if (!Number.isFinite(value) || !Number.isFinite(time)) return;
      state.progress = value;
      state.exactTime = time;
      send();
    },
    resize,
    destroy(clear = true) {
      if (destroyed) return;
      destroyed = true;
      pending = false;
      stopWorker();
      fallback?.destroy(clear);
      observer.disconnect();
      intersection.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      if (clear) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
  };
}
