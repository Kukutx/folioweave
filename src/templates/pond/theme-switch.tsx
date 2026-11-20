"use client";

// Day / Night. Both words are always there; CSS lights the one the page is in from the first paint (pond.module.css),
// and once hydrated each is a toggle button that says whether it is pressed.

import { useSyncExternalStore } from "react";
import { THEME_KEY, type Time } from "./theme";

const site = () => document.querySelector<HTMLElement>("[data-pond-site]");
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function subscribe(change: () => void) {
  const element = site();
  const observer = new MutationObserver(change);
  if (element) observer.observe(element, { attributes: true, attributeFilter: ["data-theme"] });
  const query = darkQuery();
  query.addEventListener("change", change);
  return () => {
    observer.disconnect();
    query.removeEventListener("change", change);
  };
}

function snapshot(): Time {
  const element = site();
  const chosen = element?.getAttribute("data-theme") ?? element?.getAttribute("data-default");
  if (chosen === "light" || chosen === "dark") return chosen;
  return darkQuery().matches ? "dark" : "light";
}

function choose(time: Time) {
  site()?.setAttribute("data-theme", time);
  try {
    localStorage.setItem(THEME_KEY, time);
  } catch {}
}

export function ThemeSwitch({
  light,
  dark,
  label,
  className,
  slashClassName,
}: {
  light: string;
  dark: string;
  label: string;
  className: string;
  slashClassName: string;
}) {
  const time = useSyncExternalStore<Time | null>(subscribe, snapshot, () => null);
  return (
    <div className={className} role="group" aria-label={label} data-pond-avoid="">
      <button type="button" data-time="light" aria-pressed={time ? time === "light" : undefined} onClick={() => choose("light")}>
        {light}
      </button>
      <span className={slashClassName} aria-hidden="true">
        /
      </span>
      <button type="button" data-time="dark" aria-pressed={time ? time === "dark" : undefined} onClick={() => choose("dark")}>
        {dark}
      </button>
    </div>
  );
}
