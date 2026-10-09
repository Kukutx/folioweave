import {
  claimFloatingPanel,
  registerFloatingSurface,
} from "@/core/floating-surfaces";

/** Loaded on demand only by the isolated QA plugin, never by a published site. */
export function install() {
  let cleanups: (() => void)[] = [];
  let widgets: HTMLElement[] = [];
  let release: (() => void) | undefined;
  const remove = () => {
    release?.();
    cleanups.forEach((cleanup) => cleanup());
    widgets.forEach((widget) => widget.remove());
    cleanups = [];
    widgets = [];
  };
  const api = {
    mount() {
      remove();
      const music = document
        .querySelector('[data-plugin="music"]')!
        .getBoundingClientRect();
      for (let index = 0; index < 2; index++) {
        const widget = document.createElement("button");
        widget.textContent = `QA widget ${index}`;
        widget.dataset.qaFloat = String(index);
        widget.dataset.plugin = "fixture-floating";
        Object.assign(widget.style, {
          position: "fixed",
          left: `${music.right - 60}px`,
          top: `${music.bottom - 60}px`,
          width: "56px",
          height: "56px",
          zIndex: "18000",
          translate: "var(--fw-float-x, 0px) var(--fw-float-y, 0px)",
        });
        document.body.append(widget);
        widgets.push(widget);
        cleanups.push(registerFloatingSurface(widget, 5 - index));
      }
    },
    claim() {
      widgets[0].dataset.open = "true";
      release = claimFloatingPanel(widgets[0], () => {
        widgets[0].dataset.open = "false";
      });
    },
    remove,
  };
  (window as Window & { musicQA?: typeof api }).musicQA = api;
}
