"use client";

import { useSyncExternalStore } from "react";
import styles from "./bottega.module.css";
import { statusAt, type Entry, type StatusLabels } from "./status";

export type { StatusLabels } from "./status";

// The clock as a store: one snapshot per minute, refreshed every minute and
// whenever the page becomes visible again. The server has no snapshot, so
// the static HTML never carries a status that could already be out of date.
const minuteNow = () => Math.floor(Date.now() / 60000);
function subscribe(update: () => void) {
  const timer = window.setInterval(update, 60000);
  const onVisible = () => {
    if (document.visibilityState === "visible") update();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** "Open now · closes at 13:00": worked out in the visitor's browser against
 * the shop's own time zone, and shown only once the page is interactive. */
export function OpenNow({
  entries,
  timeZone,
  locale,
  country,
  labels,
}: {
  entries: Entry[];
  timeZone: string;
  locale: string;
  country?: string;
  labels: StatusLabels;
}) {
  const minute = useSyncExternalStore(subscribe, minuteNow, () => null);
  const status =
    minute === null
      ? null
      : statusAt(minute, entries, timeZone, locale, country, labels);
  if (!status) return null;
  return (
    <p className={styles.status}>
      <span
        aria-hidden="true"
        className={status.open ? styles.statusOpen : styles.statusClosed}
      />
      {status.text}
    </p>
  );
}
