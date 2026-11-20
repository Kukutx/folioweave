// The "open now" status, worked out from the shop's hours, its time zone and
// its country's public holidays. Pure, so the client component and the tests
// share it.
import { DAYS, dayName, fill, type Day } from "./hours";

export type Entry = { days: Day[]; opens: string; closes: string };
export type StatusLabels = {
  statusOpen: string;
  statusOpensLater: string;
  statusReopens: string;
  statusClosedToday: string;
  tomorrow: string;
};

const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Public holidays on a fixed date (MM-DD). */
const FIXED_HOLIDAYS: Record<string, string[]> = {
  IT: [
    "01-01",
    "01-06",
    "04-25",
    "05-01",
    "06-02",
    "08-15",
    "11-01",
    "12-08",
    "12-25",
    "12-26",
  ],
};
/** Countries whose Easter Monday is a public holiday. */
const EASTER_MONDAY = new Set(["IT"]);

/** Easter Sunday in the Gregorian calendar (anonymous Gregorian algorithm). */
export function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Whether the shop's country rests on this calendar date. */
export function isHoliday(
  country: string | undefined,
  year: number,
  month: number,
  day: number,
) {
  if (!country) return false;
  if (FIXED_HOLIDAYS[country]?.includes(`${pad(month)}-${pad(day)}`))
    return true;
  if (EASTER_MONDAY.has(country)) {
    const easter = easterSunday(year);
    const monday = new Date(Date.UTC(year, easter.month - 1, easter.day + 1));
    if (monday.getUTCMonth() + 1 === month && monday.getUTCDate() === day)
      return true;
  }
  return false;
}

const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};

/** The status at a given minute; null when there is nothing to say (a public
 * holiday, as the original shows, or no opening in the next two weeks). */
export function statusAt(
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
      year: "numeric",
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
  const year = Number(parts.year);
  const month = Number(parts.month);
  const date = Number(parts.day);
  // The calendar date a number of days from today, in the shop's time zone.
  const restsOn = (ahead: number) => {
    const day = new Date(Date.UTC(year, month - 1, date + ahead));
    return isHoliday(
      country,
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
    );
  };
  if (restsOn(0)) return null;
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
  // The next day the shop opens, skipping public holidays.
  const nextDay = () => {
    for (let ahead = 1; ahead <= 14; ahead++) {
      if (restsOn(ahead)) continue;
      const first = slots(today + ahead)[0];
      if (first)
        return { ahead, index: (today + ahead) % 7, opens: first.entry.opens };
    }
    return null;
  };
  const name = (index: number) => dayName(DAYS[index], locale);
  const todays = slots(today);
  if (!todays.length) {
    const next = nextDay();
    return next
      ? {
          open: false,
          text: fill(labels.statusClosedToday, {
            day: name(next.index),
            time: next.opens,
          }),
        }
      : null;
  }
  const current = todays.find((slot) => now >= slot.opens && now < slot.closes);
  if (current)
    return {
      open: true,
      text: fill(labels.statusOpen, { time: current.entry.closes }),
    };
  const later = todays.find((slot) => now < slot.opens);
  if (later)
    return {
      open: false,
      text: fill(labels.statusOpensLater, { time: later.entry.opens }),
    };
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
