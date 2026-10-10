"use client";

import { useEffect, type RefObject } from "react";

/** What the visitor does that the warm-up must never compete with, and how
 * long it stays away afterwards. A moving pointer drives the cursor decoration,
 * so it counts, but it is over as soon as the pointer rests. */
const activity = {
  scroll: 1000,
  wheel: 1000,
  touchstart: 1000,
  pointerdown: 1000,
  keydown: 1000,
  pointermove: 250,
} as const;
/** The programs stay compiled for as long as the document lives, so one pass
 * serves every later return to this page. */
let warmed = false;
/** Inside the stage everything starts unpainted and is painted piece by piece.
 * Opacity and deferred rendering are lifted so a part that the page reveals
 * later is painted here as well, and nothing moves: an animation would paint
 * the same element again on every frame. */
const stageRules =
  "[data-warm],[data-warm] *{visibility:hidden!important;opacity:1!important;content-visibility:visible!important;animation-play-state:paused!important;transition:none!important}" +
  "[data-warm][data-drawn],[data-warm] [data-drawn]{visibility:visible!important}";
/** A frame the GPU could not present in time: paint one element at a time. */
const strained = 34;
/** A frame with room to spare: paint one element more next time, up to this
 * many. Measured cold on integrated graphics, growing faster turned the 150 ms
 * pauses of this pace into 400 to 600 ms ones. */
const eased = 16;
const most = 4;
/** Batches that stay painted. Older ones are unpainted again, so the copy
 * never holds more than a band of tiles in graphics memory. */
const kept = 8;
/** The copy is painted at full resolution and shown at this fraction of it.
 * Paint and layout metrics measure what is shown, so at a hundredth of its
 * area nothing here can pass for the page's largest paint or for a layout
 * shift; `will-change: transform` is what keeps the painting at full size.
 * Shown at full size, the copy of the hero was reported as the largest paint,
 * eleven seconds in on a slow device. */
const shown = 0.1;

const nextFrame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** Only Chromium compiles its GPU programs on first use while rasterizing. */
const compilesOnFirstUse = () =>
  typeof CSSStyleSheet === "function" &&
  "replaceSync" in CSSStyleSheet.prototype &&
  "requestIdleCallback" in window &&
  Boolean(
    (
      navigator as Navigator & {
        userAgentData?: { brands?: { brand: string }[] };
      }
    ).userAgentData?.brands?.some((item) => item.brand === "Chromium"),
  );

/** The page's rules, for a tree the page's own style sheets cannot reach. */
function copyStyleSheets() {
  const copies: CSSStyleSheet[] = [];
  for (const sheet of document.styleSheets) {
    if (sheet.disabled) continue;
    try {
      const copy = new CSSStyleSheet({ media: sheet.media.mediaText });
      copy.replaceSync(
        Array.from(sheet.cssRules)
          .filter(
            (rule) =>
              !(rule instanceof CSSImportRule) &&
              !(rule instanceof CSSFontFaceRule),
          )
          .map((rule) => rule.cssText)
          .join("\n"),
      );
      copies.push(copy);
    } catch {
      // A sheet from another origin keeps its rules to itself.
    }
  }
  const stage = new CSSStyleSheet();
  stage.replaceSync(stageRules);
  return [...copies, stage];
}

/** A copy of one section that paints like it: the same ancestors, ids and
 * attributes for selectors and inheritance, the same width, and no frame,
 * media, script or image element the page has not loaded. The closed shadow
 * root it goes into is what keeps its ids and classes out of the document's
 * reach.
 *
 * Two things it does not reproduce. A background image named in CSS is
 * fetched when its element is styled here, which for a deferred section is
 * earlier than the page would have. And a reference by fragment (`url(#id)`,
 * `<use href="#id">`) to something outside the section finds nothing in the
 * shadow tree, so that shape or clip is not painted. */
function copyOf(section: HTMLElement) {
  const box = section.getBoundingClientRect();
  const unit = section.cloneNode(true) as HTMLElement;
  unit.setAttribute("data-warm", "");
  for (const node of unit.querySelectorAll(
    "iframe,video,audio,object,embed,script",
  ))
    node.remove();
  // An image the page has not loaded yet stays unloaded: this is no reason to
  // fetch it early.
  const originals = section.querySelectorAll("img");
  unit.querySelectorAll("img").forEach((image, index) => {
    const original = originals[index];
    if (original?.complete && original.naturalWidth) return;
    image.removeAttribute("src");
    image.removeAttribute("srcset");
    for (const source of image.closest("picture")?.querySelectorAll("source") ??
      [])
      source.remove();
  });
  unit.style.cssText += `;position:absolute!important;top:0;left:${box.left}px;width:${box.width}px;margin:0!important`;
  let tree = unit;
  for (
    let ancestor = section.parentElement;
    ancestor && ancestor !== document.body;
    ancestor = ancestor.parentElement
  ) {
    const mirror = ancestor.cloneNode(false) as HTMLElement;
    // Without a box of its own, but with whatever it hands down inline.
    mirror.style.setProperty("display", "contents", "important");
    mirror.append(tree);
    tree = mirror;
  }
  return { tree, unit };
}

/**
 * Chromium compiles a GPU program the first time a paint effect is
 * rasterized, and it rasterizes only what is near the viewport. A first visit
 * therefore stopped mid-scroll for as long as the About camera's gradients and
 * shadows took to compile, 0.4 to 1.6 s on integrated graphics, and again
 * more briefly at each later section.
 *
 * While the page is idle this paints every section once, a few elements per
 * frame, where no one can see or reach it: a copy inside a closed shadow root,
 * shown at a tenth of its size and blended one step above nothing. The
 * programs are then compiled before the scroll needs them, a few per frame
 * instead of all in one. It waits for as long as the visitor is doing
 * anything, and leaves nothing behind.
 */
export function useRasterWarmUp(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = root.current;
    if (!container || warmed || !compilesOnFirstUse()) return;
    let disposed = false;
    let busyUntil = 0;
    let host: HTMLElement | undefined;
    const busy = (event: Event) => {
      busyUntil = Math.max(
        busyUntil,
        performance.now() + activity[event.type as keyof typeof activity],
      );
    };
    const listening = { passive: true, capture: true };
    for (const name in activity) addEventListener(name, busy, listening);
    /** The next frame in which the visitor is not using the page. */
    const quietFrame = async () => {
      for (;;) {
        const time = await nextFrame();
        if (disposed) return null;
        const wait = busyUntil - performance.now();
        if (wait <= 0) {
          if (!host?.style.display) return time;
          host.style.display = "";
          continue;
        }
        // Out of the compositor's way until the visitor has finished.
        if (host) host.style.display = "none";
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    };
    const paint = async (section: HTMLElement, into: ShadowRoot) => {
      // Copying and measuring a section is the one long step: not while the
      // visitor is using the page.
      if ((await quietFrame()) === null) return;
      const { tree, unit } = copyOf(section);
      const sheet = document.createElement("div");
      sheet.style.cssText = `position:absolute;left:0;top:0;width:${innerWidth}px;transform-origin:0 0;will-change:transform;transform:scale(${Math.min(shown, innerHeight / section.offsetHeight)})`;
      sheet.append(tree);
      into.append(sheet);
      try {
        // From the top down: what the visitor reaches first is ready first.
        const parts = [unit, ...unit.querySelectorAll<HTMLElement>("*")]
          .map((element) => ({
            element,
            top: element.getBoundingClientRect().top,
          }))
          .sort((a, b) => a.top - b.top)
          .map((part) => part.element);
        const painted: HTMLElement[][] = [];
        let size = 2;
        let last = await quietFrame();
        for (let index = 0; last !== null && index < parts.length;) {
          const batch = parts.slice(index, index + size);
          index += batch.length;
          for (const element of batch) element.setAttribute("data-drawn", "");
          painted.push(batch);
          if (painted.length > kept)
            for (const element of painted.shift()!)
              element.removeAttribute("data-drawn");
          const time = await quietFrame();
          if (time === null) return;
          const took = time - last;
          last = time;
          size =
            took > strained
              ? 1
              : took < eased
                ? Math.min(most, size + 1)
                : size;
        }
        await quietFrame();
      } finally {
        sheet.remove();
      }
    };
    const run = async () => {
      if (disposed) return;
      await document.fonts.ready;
      if ((await quietFrame()) === null) return;
      host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.inert = true;
      host.dataset.rasterWarmUpStage = "";
      // Not transparent: a layer at zero opacity is never rasterized.
      host.style.cssText =
        "position:fixed;inset:0;overflow:hidden;contain:strict;pointer-events:none;z-index:2147483647;opacity:.004";
      const stage = host.attachShadow({ mode: "closed" });
      stage.adoptedStyleSheets = copyStyleSheets();
      document.body.append(host);
      container.dataset.rasterWarmUp = "running";
      for (const section of container.querySelectorAll<HTMLElement>(
        "[data-theme-scope]",
      )) {
        if (disposed) return;
        if (section.offsetHeight) await paint(section, stage);
      }
      if (disposed) return;
      warmed = true;
      container.dataset.rasterWarmUp = "done";
    };
    const finish = () => {
      host?.remove();
      host = undefined;
    };
    const start = () =>
      requestIdleCallback(
        () =>
          void run()
            .catch(() => {})
            .finally(finish),
        {
          timeout: 3000,
        },
      );
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });
    return () => {
      disposed = true;
      removeEventListener("load", start);
      for (const name in activity) removeEventListener(name, busy, listening);
      finish();
      delete container.dataset.rasterWarmUp;
    };
  }, [root]);
}
