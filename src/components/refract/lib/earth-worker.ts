import {
  createEarthRenderer,
  type EarthRenderer,
  type EarthRendererOptions,
} from "./earth-renderer";
import type { SceneWorkerInput, SceneWorkerOutput } from "./earth-runtime";

const host = self as unknown as {
  postMessage(message: SceneWorkerOutput, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<SceneWorkerInput>) => void) | null;
};
let renderer: EarthRenderer | undefined, surface: OffscreenCanvas | undefined;
let options: EarthRendererOptions;
let size = "";

// One lane of the scene. It holds no clock and no queue: every message is one
// complete frame for the pose and time it names, so any lane can draw any frame
// and several lanes can work on consecutive frames at once.
host.onmessage = ({ data }) => {
  try {
    if (data.type === "init") {
      surface = new OffscreenCanvas(1, 1);
      options = {
        ...data.options,
        width: data.state.width,
        height: data.state.height,
        pixelRatio: data.state.pixelRatio,
        autoStart: false,
      };
      // Canvas2D operations are shared verbatim with the main-thread fallback.
      renderer = createEarthRenderer(
        surface as unknown as HTMLCanvasElement,
        options,
      );
      host.postMessage({ type: "ready" });
      return;
    }
    if (!renderer || !surface) return;
    const { state } = data;
    const start = performance.now();
    // The core stays suspended while the state is applied, so a resize, a
    // scroll and a preference change together yield one coherent frame.
    renderer.setSuspended(true);
    const next = `${state.width}/${state.height}/${state.pixelRatio}`;
    if (size !== next) {
      size = next;
      options.width = state.width;
      options.height = state.height;
      options.pixelRatio = state.pixelRatio;
      renderer.resize();
    }
    renderer.setReducedMotion(state.reduced);
    renderer.setIntroProgress(state.intro);
    renderer.setMobileLayout(state.layout);
    renderer.setToolsBounds(state.toolsBounds);
    renderer.setSpin(state.spin);
    renderer.drawAtProgress(state.progress, state.reduced ? 0 : data.clock);
    renderer.setSuspended(false);
    const bitmap = surface.transferToImageBitmap();
    host.postMessage(
      {
        type: "frame",
        id: data.id,
        bitmap,
        duration: performance.now() - start,
      },
      [bitmap],
    );
  } catch (error) {
    host.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
