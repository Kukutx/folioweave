import {
  createEarthRenderer,
  type EarthRenderer,
  type EarthRendererOptions,
} from "./earth-renderer";
import type {
  SceneState,
  SceneWorkerInput,
  SceneWorkerOutput,
} from "./earth-runtime";

const host = self as unknown as {
  fonts: { add(font: FontFace): void };
  postMessage(message: SceneWorkerOutput, transfer?: Transferable[]): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
  onmessage: ((event: MessageEvent<SceneWorkerInput>) => void) | null;
};
let renderer: EarthRenderer | undefined, surface: OffscreenCanvas | undefined;
let options: EarthRendererOptions;
let state: SceneState, pending: SceneState | undefined;
let frame = 0,
  last = 0,
  clock = 0,
  awaitingPresentation = false;

function wake() {
  if (!frame && !awaitingPresentation && state && !state.suspended)
    frame = host.requestAnimationFrame(paint);
}
function paint(time: number) {
  frame = 0;
  if (!renderer || !surface || state.suspended) {
    last = 0;
    return;
  }
  const delta = last ? Math.min(50, time - last) : 16.7;
  last = time;
  if (!state.paused && !state.reduced) clock += delta / 1000;
  const start = performance.now();
  const snapshot = pending?.exactTime !== undefined;
  // The core remains suspended while applying state so a resize + scroll +
  // preference change yields one coherent frame, not several intermediate ones.
  renderer.setSuspended(true);
  if (pending) {
    if (pending.exactTime !== undefined) {
      clock = Math.max(0, pending.exactTime);
    }
    pending = undefined;
    options.width = state.width;
    options.height = state.height;
    options.pixelRatio = state.pixelRatio;
    renderer.resize();
    renderer.setReducedMotion(state.reduced);
    renderer.setIntroProgress(state.intro);
    renderer.setMobileLayout(state.layout);
    renderer.setToolsBounds(state.toolsBounds);
  }
  // Apply while suspended, then draw once with the correct playback mode.
  renderer.drawAtProgress(
    state.progress,
    state.reduced ? 0 : clock,
    snapshot ? "snapshot" : "live",
  );
  renderer.setSuspended(false);
  const bitmap = surface.transferToImageBitmap();
  awaitingPresentation = true;
  host.postMessage(
    { type: "frame", bitmap, duration: performance.now() - start },
    [bitmap],
  );
}

host.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      state = data.state;
      pending = state;
      surface = new OffscreenCanvas(1, 1);
      options = {
        ...data.options,
        width: state.width,
        height: state.height,
        pixelRatio: state.pixelRatio,
        autoStart: false,
      };
      // Canvas2D operations are shared verbatim with the main-thread fallback.
      renderer = createEarthRenderer(
        surface as unknown as HTMLCanvasElement,
        options,
      );
      host.postMessage({ type: "ready" });
      wake();
    } else if (data.type === "state") {
      const wasStopped = state?.suspended || state?.paused || state?.reduced;
      state = data.state;
      pending = state;
      // Observe chapter exits even while mobile reading phases hide the canvas.
      renderer?.setSuspended(true);
      renderer?.setProgress(state.progress);
      if (state.suspended) {
        if (frame) host.cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
      } else {
        if (wasStopped) last = 0;
        wake();
      }
    } else if (data.type === "presented") {
      awaitingPresentation = false;
      if (pending || (!state.paused && !state.reduced && state.progress < 1))
        wake();
    }
  } catch (error) {
    host.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
