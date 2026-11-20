"use client";

import { useSyncExternalStore } from "react";
import styles from "./bottega.module.css";

type Day = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";
type Entry = { days: Day[]; opens: string; closes: string };
export type StatusLabels = {
  statusOpen: string;
  statusOpensLater: string;
  statusReopens: string;
  statusClosedToday: string;
  tomorrow: string;
};

const DAYS: Day[] = ["mo", "tu", "we", "th", "fr", "sa", "su"];
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Fixed-date national holidays: the original shows no status on these days. */
const HOLIDAYS: Record<string, string[]> = {
  IT: ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"],
};

const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};
const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

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

function statusAt(
  minute: number,
  entries: Entry[],
  timeZone: string,
  locale: string,
  country: string | undefined,
  labels: StatusLabels,
) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(minute * 60000))
      .map((part) => [part.type, part.value]),
  );
  const today = SHORT.indexOf(parts.weekday);
  if (today < 0) return null;
  if (country && HOLIDAYS[country]?.includes(`${parts.month}-${parts.day}`)) return null;
  const now = Number(parts.hour) * 60 + Number(parts.minute);
  const slots = (index: number) =>
    entries
      .filter((entry) => entry.days.includes(DAYS[index % 7]))
      .map((entry) => {
        const opens = minutes(entry.opens);
        const closes = minutes(entry.closes);
        return { entry, opens, closes: closes > opens ? closes : 24 * 60 };
      })
      .sort((a, b) => a.opens - b.opens);
  const nextDay = () => {
    for (let ahead = 1; ahead <= 7; ahead++) {
      const first = slots(today + ahead)[0];
      if (first) return { ahead, index: (today + ahead) % 7, opens: first.entry.opens };
    }
    return null;
  };
  const name = (index: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 1 + index)),
    );
  const todays = slots(today);
  if (!todays.length) {
    const next = nextDay();
    return next
      ? {
          open: false,
          text: fill(labels.statusClosedToday, { day: name(next.index), time: next.opens }),
        }
      : null;
  }
  const current = todays.find((slot) => now >= slot.opens && now < slot.closes);
  if (current)
    return { open: true, text: fill(labels.statusOpen, { time: current.entry.closes }) };
  const later = todays.find((slot) => now < slot.opens);
  if (later)
    return { open: false, text: fill(labels.statusOpensLater, { time: later.entry.opens }) };
  const next = nextDay();
  if (!next) return null;
  return {
    open: false,
    text: fill(labels.statusReopens, {
      day: next.ahead === 1 ? labels.tomorrow : name(next.index),
      time: next.opens,
    }),
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
    minute === null ? null : statusAt(minute, entries, timeZone, locale, country, labels);
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
