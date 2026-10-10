import type { EarthRenderer, EarthRendererOptions } from "./earth-renderer";
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
};
export type SceneWorkerInput =
  | { type: "init"; options: EarthRendererOptions; state: SceneState }
  /** Draw exactly this pose at this time, and return it under this number. */
  | { type: "frame"; id: number; clock: number; state: SceneState };
export type SceneWorkerOutput =
  | { type: "ready" }
  | { type: "frame"; id: number; bitmap: ImageBitmap; duration: number }
  | { type: "error"; message: string };

type Lane = { worker: Worker; ready: boolean; busy: boolean };

/** Lanes of the scene a device can afford beside the page itself. Measured on a
 * 16-thread laptop, a fourth lane only slows the other three. */
export const sceneLanes = (threads: number) =>
  Math.max(1, Math.min(3, Math.floor(threads / 4)));

/** Keep scene drawing off the scroll/UI thread, at full resolution.
 *
 * A frame of this scene is thousands of small anti-aliased paths, and drawing it
 * costs more than one display interval. Each lane is a worker that rasterizes a
 * complete frame on the processor, where that work cannot starve the page's own
 * compositing. This thread owns the clock: it hands consecutive frames to
 * consecutive lanes, spaced so that lanes finish in turn, and shows each frame
 * as it returns unless a later one is already on screen. Canvas2D on this thread
 * remains the exact fallback. */
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
    fallback: EarthRenderer | undefined;
  let visible = true,
    explicitlySuspended = false;
  const lanes: Lane[] = [];
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
    // Every device pixel up to a 2x display; beyond that the eye gains nothing.
    state.pixelRatio = Math.min(
      options.pixelRatio ?? (window.devicePixelRatio || 1),
      2,
    );
  };
  measure();

  // The clock and the frame numbers live here, so every lane draws from the
  // same timeline and a frame is a pure function of what it is sent.
  let clock = 0,
    lastTick = 0,
    raf = 0;
  let nextId = 0,
    shownId = -1,
    lastDispatch = -Infinity;
  /** The clock was set to an exact time; the next frame is drawn at it. */
  let exact = false;
  /** The state changed since a frame was last sent. */
  let stale = true;
  /** When the scroll position last moved; a still page needs one lane only. */
  let movedAt = -Infinity;
  /** A lane's time for one frame, smoothed; the spacing between frames follows it. */
  let cost = 24;
  const animating = () => !state.paused && !state.reduced && state.progress < 1;
  const dispatch = (time: number) => {
    if (state.suspended || (!stale && !animating())) return;
    const lane = lanes.find((item) => item.ready && !item.busy);
    if (!lane) return;
    const working = lanes.filter((item) => item.ready).length;
    const active = time - movedAt < 600 ? working : 1;
    // Start frames as far apart as the lanes finish them, so they also arrive
    // evenly. A changed pose never waits behind an idle lane.
    const busy = lanes.some((item) => item.busy);
    if (busy && time - lastDispatch < cost / active - 0.5) return;
    lane.busy = true;
    lastDispatch = time;
    stale = false;
    lane.worker.postMessage({
      type: "frame",
      id: nextId++,
      clock,
      state,
    } satisfies SceneWorkerInput);
  };
  const tick = (time: number) => {
    raf = 0;
    if (destroyed || fallback) return;
    const delta = lastTick ? Math.min(50, time - lastTick) : 16.7;
    lastTick = time;
    if (exact) exact = false;
    else if (animating() && !state.suspended) clock += delta / 1000;
    dispatch(time);
    if (
      !state.suspended &&
      (animating() || stale || lanes.some((item) => item.busy))
    )
      raf = requestAnimationFrame(tick);
    else lastTick = 0;
  };
  const wake = () => {
    if (!raf && !destroyed && !fallback) raf = requestAnimationFrame(tick);
  };
  const refresh = () => {
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
      return;
    }
    stale = true;
    wake();
  };
  const stopLanes = () => {
    for (const lane of lanes) lane.worker.terminate();
    lanes.length = 0;
  };
  let recovery: Promise<void> | undefined;
  const recover = () =>
    (recovery ??= (async () => {
      if (destroyed) return;
      stopLanes();
      const { createEarthRenderer } = await import("./earth-renderer");
      if (destroyed) return;
      fallback = createEarthRenderer(canvas, options);
      canvas.dataset.renderThread = "main";
      delete canvas.dataset.sceneLanes;
      refresh();
    })());
  const openLane = () =>
    new Promise<void>((resolve, reject) => {
      const lane: Lane = {
        worker: new Worker(new URL("./earth-worker.ts", import.meta.url), {
          type: "module",
        }),
        ready: false,
        busy: false,
      };
      lanes.push(lane);
      const timeout = window.setTimeout(
        () => fail(new Error("Scene worker initialization timed out")),
        5000,
      );
      const fail = (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
        // A lane that fails leaves the others to carry on; with none left,
        // this thread draws.
        const index = lanes.indexOf(lane);
        if (index >= 0) lanes.splice(index, 1);
        lane.worker.terminate();
        if (!lanes.some((item) => item.ready)) void recover();
      };
      lane.worker.onerror = fail;
      lane.worker.onmessage = ({ data }: MessageEvent<SceneWorkerOutput>) => {
        if (data.type === "ready") {
          window.clearTimeout(timeout);
          lane.ready = true;
          canvas.dataset.renderThread = "worker";
          canvas.dataset.sceneLanes = String(
            lanes.filter((item) => item.ready).length,
          );
          resolve();
          wake();
          return;
        }
        if (data.type === "error") {
          fail(new Error(data.message));
          return;
        }
        lane.busy = false;
        cost = cost * 0.8 + data.duration * 0.2;
        const { bitmap } = data;
        // Lanes finish out of turn now and then; time never runs backwards.
        if (!destroyed && !state.suspended && data.id > shownId) {
          shownId = data.id;
          if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
          if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
        wake();
      };
      lane.worker.postMessage({
        type: "init",
        options,
        state,
      } satisfies SceneWorkerInput);
    });
  try {
    await openLane();
    // The first lane shows the scene; the others join without holding it up.
    for (
      let extra = sceneLanes(navigator.hardwareConcurrency || 4) - 1;
      extra > 0;
      extra--
    )
      void openLane().catch(() => {});
  } catch {
    await recover();
  }
  const resize = () => {
    measure();
    fallback?.resize();
    refresh();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(
    (entries) => {
      visible = entries.at(-1)?.isIntersecting ?? false;
      refresh();
    },
    { rootMargin: "60px" },
  );
  intersection.observe(canvas);
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", refresh);
  return {
    setToolsBounds(bounds) {
      state.toolsBounds = bounds;
      refresh();
    },
    setIntroProgress(value) {
      if (Number.isFinite(value)) {
        state.intro = value;
        refresh();
      }
    },
    setProgress(value) {
      if (Number.isFinite(value) && state.progress !== value) {
        state.progress = value;
        movedAt = performance.now();
        refresh();
      }
    },
    setSpin(value) {
      if (Number.isFinite(value) && state.spin !== value) {
        state.spin = value;
        movedAt = performance.now();
        refresh();
      }
    },
    setMobileLayout(value) {
      if (
        state.layout?.centerY === value?.centerY &&
        state.layout?.radius === value?.radius
      )
        return;
      state.layout = value;
      refresh();
    },
    setPaused(value) {
      if (state.paused !== value) {
        state.paused = value;
        refresh();
      }
    },
    setSuspended(value) {
      if (explicitlySuspended !== value) {
        explicitlySuspended = value;
        refresh();
      }
    },
    setReducedMotion(value) {
      if (state.reduced !== value) {
        state.reduced = value;
        refresh();
      }
    },
    drawAtProgress(value, time = 0) {
      if (!Number.isFinite(value) || !Number.isFinite(time)) return;
      state.progress = value;
      clock = Math.max(0, time);
      exact = true;
      if (fallback) fallback.drawAtProgress(value, time);
      refresh();
    },
    resize,
    destroy(clear = true) {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      stopLanes();
      fallback?.destroy(clear);
      observer.disconnect();
      intersection.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", refresh);
      if (clear) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
  };
}
