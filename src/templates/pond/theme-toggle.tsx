"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY, type PondTheme } from "./theme";

const site = () => document.querySelector<HTMLElement>("[data-pond-site]");

function subscribe(change: () => void) {
  const element = site();
  if (!element) return () => {};
  const observer = new MutationObserver(change);
  observer.observe(element, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const snapshot = (): PondTheme => (site()?.getAttribute("data-theme") === "light" ? "light" : "dark");
const serverSnapshot = (): PondTheme => "dark";

/** The current theme; follows the switch wherever it is pressed. */
export function usePondTheme() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

function setTheme(next: PondTheme) {
  site()?.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
}

/** "light" while dark, "dark" while light. Both words are in the markup and CSS shows the right one, so the
 *  label is right before hydration too. */
export function ThemeToggle({ light, dark, className }: { light: string; dark: string; className: string }) {
  const theme = usePondTheme();
  return (
    <button
      type="button"
      className={className}
      aria-pressed={theme === "light"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <span data-show="dark">{light}</span>
      <span data-show="light">{dark}</span>
    </button>
  );
}
