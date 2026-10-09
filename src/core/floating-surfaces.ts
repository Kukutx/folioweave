"use client";

import { useCallback } from "react";
import { layoutFloating } from "./floating-layout.ts";

type Entry = { element: HTMLElement; priority: number; x: number; y: number };
const entries = new Map<HTMLElement, Entry>();
let observer: ResizeObserver | undefined;
let frame = 0;
let panel: { element: HTMLElement; close: () => void } | undefined;

function layout() {
  frame = 0;
  const members = [...entries.values()];
  // Read all geometry before writing styles, including during capsule expansion.
  const anchors = members.map(({ element, priority, x, y }) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x - x,
      y: rect.y - y,
      width: rect.width,
      height: rect.height,
      priority,
    };
  });
  const viewport = window.visualViewport;
  const positions = layoutFloating(anchors, {
    x: (viewport?.offsetLeft ?? 0) + 8,
    y: (viewport?.offsetTop ?? 0) + 8,
    width: Math.max(0, (viewport?.width ?? innerWidth) - 16),
    height: Math.max(0, (viewport?.height ?? innerHeight) - 16),
  });
  members.forEach((entry, index) => {
    const position = positions[index],
      anchor = anchors[index];
    const x = Math.round((position.x - anchor.x) * 100) / 100;
    const y = Math.round((position.y - anchor.y) * 100) / 100;
    entry.element.dataset.floatingCrowded = String(position.crowded);
    if (entry.x === x && entry.y === y) return;
    entry.x = x;
    entry.y = y;
    entry.element.style.setProperty("--fw-float-x", `${x}px`);
    entry.element.style.setProperty("--fw-float-y", `${y}px`);
    entry.element.dispatchEvent(new Event("floatinglayout"));
  });
}

/** Coalesced, event-driven; no idle animation loop or React progress updates. */
export function refreshFloatingLayout() {
  if (entries.size && !frame) frame = requestAnimationFrame(layout);
}

export function registerFloatingSurface(element: HTMLElement, priority = 0) {
  if (!element.dataset.plugin)
    throw new Error(
      "Floating coordination accepts only plugin-owned roots with data-plugin; native site controls must not be registered.",
    );
  if (entries.has(element))
    throw new Error("Floating surface is already registered");
  const entry = { element, priority, x: 0, y: 0 };
  entries.set(element, entry);
  if (!observer) {
    observer = new ResizeObserver(refreshFloatingLayout);
    window.addEventListener("resize", refreshFloatingLayout);
    window.visualViewport?.addEventListener("resize", refreshFloatingLayout);
    window.visualViewport?.addEventListener("scroll", refreshFloatingLayout);
  }
  observer.observe(element);
  refreshFloatingLayout();
  return () => {
    if (entries.get(element) !== entry) return;
    entries.delete(element);
    observer?.unobserve(element);
    if (panel?.element === element) panel = undefined;
    element.style.removeProperty("--fw-float-x");
    element.style.removeProperty("--fw-float-y");
    delete element.dataset.floatingCrowded;
    if (entries.size) refreshFloatingLayout();
    else {
      observer?.disconnect();
      observer = undefined;
      window.removeEventListener("resize", refreshFloatingLayout);
      window.visualViewport?.removeEventListener(
        "resize",
        refreshFloatingLayout,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        refreshFloatingLayout,
      );
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

/** React 19 callback-ref cleanup also handles conditional mounts and Strict Mode. */
export function useFloatingSurface(priority = 0) {
  return useCallback(
    (element: HTMLElement | null) => {
      if (element) return registerFloatingSurface(element, priority);
    },
    [priority],
  );
}

/** Acquiring one nonmodal panel closes the previous panel without stealing focus. */
export function claimFloatingPanel(element: HTMLElement, close: () => void) {
  const previous = panel;
  const owner = { element, close };
  panel = owner;
  if (previous?.element !== element) previous?.close();
  return () => {
    if (panel === owner) panel = undefined;
  };
}
