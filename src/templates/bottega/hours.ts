// Days and the wording helper, shared by the server views (through shop.ts) and
// the open-now status. The status is a client component, so it imports this
// file rather than shop.ts, which carries the manifest and the copy tables.
export const DAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const;
export type Day = (typeof DAYS)[number];

/** A weekday's name in the site language; Monday 1 January 2024 anchors the week. */
export function dayName(day: Day, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 1 + DAYS.indexOf(day))),
  );
}

export function fill(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
