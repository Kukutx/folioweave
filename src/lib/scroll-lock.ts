type LockState = {
  count: number;
  overflow: string;
  gutter: string;
  x: number;
  y: number;
  lenis: Window["__lenis"];
  stopped: boolean | undefined;
};

let state: LockState | null = null;

/** Reference-counted lock shared by menus and modals; releases restore geometry. */
export function lockPageScroll() {
  const root = document.documentElement;
  if (state) state.count += 1;
  else {
    state = {
      count: 1,
      overflow: document.body.style.overflow,
      gutter: root.style.scrollbarGutter,
      x: window.scrollX,
      y: window.scrollY,
      lenis: window.__lenis,
      stopped: window.__lenis?.isStopped,
    };
    if (window.innerWidth > root.clientWidth)
      root.style.scrollbarGutter = "stable";
    state.lenis?.stop();
    document.body.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released || !state) return;
    released = true;
    if (--state.count) return;
    const previous = state;
    state = null;
    document.body.style.overflow = previous.overflow;
    root.style.scrollbarGutter = previous.gutter;
    if (!previous.stopped) previous.lenis?.start();
    if (window.scrollX !== previous.x || window.scrollY !== previous.y)
      window.scrollTo({ left: previous.x, top: previous.y, behavior: "instant" });
  };
}
