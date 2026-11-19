import type { StoreView, TemplateContext } from "@/core/contracts";
import manifest from "./manifest.json";
import {
  bottegaCopy,
  defaultQuickActions,
  defaultSteps,
  type BottegaCopy,
  type BottegaOptions,
} from "./copy";

export type Location = StoreView["locations"][number];
export type NavItem = { href: string; label: string };

const defaultPath = (id: string) =>
  manifest.pages.find((page) => page.id === id)?.path ?? id;

/** Everything a view needs, read once from the published profile. */
export function shopOf(context: TemplateContext) {
  const options = context.options as BottegaOptions;
  const store = context.store;
  const locale = context.site.identity.locale;
  const copy: BottegaCopy = bottegaCopy(locale, options.labels);
  const contact = store.contact ?? {};
  const whatsappBase = contact.whatsapp
    ? `https://wa.me/${contact.whatsapp.slice(1)}`
    : undefined;
  const whatsapp = (message?: string) =>
    whatsappBase &&
    (message ? `${whatsappBase}?text=${encodeURIComponent(message)}` : whatsappBase);
  const phone = contact.phone;
  const displayPhone = contact.displayPhone || phone;
  const email = contact.email;
  const catalogHref = store.catalog
    ? `/${options.catalogPath || defaultPath("catalog")}`
    : undefined;
  const servicesHref = store.services
    ? `/${options.servicesPath || defaultPath("services")}`
    : undefined;
  const locations = store.locations;
  const hasOffer = Boolean(store.catalog || store.services);

  const nav: NavItem[] = [
    ...(hasOffer ? [{ href: "/#services", label: copy.navServices }] : []),
    ...(locations.length ? [{ href: "/#stores", label: copy.navStores }] : []),
    ...(servicesHref ? [{ href: servicesHref, label: copy.navServicesPage }] : []),
    ...(catalogHref ? [{ href: catalogHref, label: copy.navCatalogPage }] : []),
    { href: "/#contact", label: copy.navContact },
  ];

  return {
    copy,
    locale,
    name: context.site.identity.name,
    wordmark: options.wordmark ?? "split",
    store,
    locations,
    whatsapp,
    phone,
    displayPhone,
    email,
    links: contact.links ?? [],
    catalogHref,
    servicesHref,
    nav,
    quickActions:
      options.quickActions ?? defaultQuickActions(locale, Boolean(store.services)),
    steps: options.steps ?? defaultSteps(locale),
    /** The one-line label for the main number in footers. */
    phoneLabel:
      phone && contact.whatsapp
        ? contact.whatsapp === phone
          ? copy.phoneAndWhatsapp
          : copy.phoneOnly
        : phone
          ? copy.phoneOnly
          : copy.whatsappOnly,
  };
}

export type Shop = ReturnType<typeof shopOf>;

/** "Street, 00000 City (XX)"; empty while the street is unknown. */
export function fullAddress(location: Location): string {
  if (!location.street) return "";
  const place = [location.postalCode, location.city].filter(Boolean).join(" ");
  return `${location.street}, ${place}${location.region ? ` (${location.region})` : ""}`;
}

/** A map search for a location, only once its street is known. The name it
 * goes by on maps finds the shop itself, so it leads the search when set. */
export function mapsUrl(location: Location): string | undefined {
  if (!location.street) return undefined;
  const query = location.mapName
    ? [location.mapName, location.city]
    : [
        location.street,
        [location.postalCode, location.city].filter(Boolean).join(" "),
        location.region,
      ].filter(Boolean);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.join(", "))}`;
}

export const DAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const;
export type Day = (typeof DAYS)[number];

/** A weekday's name in the site language; Monday 1 January 2024 anchors the week. */
export function dayName(day: Day, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 1 + DAYS.indexOf(day))),
  );
}

/** Hours as written, or, without that, as the machine-readable hours read:
 * one line for each set of days, then its time ranges. */
export function hoursText(location: Location, locale: string): string {
  if (location.hours) return location.hours;
  const groups = new Map<string, string[]>();
  for (const entry of location.openingHours ?? []) {
    const days = DAYS.filter((day) => entry.days.includes(day));
    const key = days.join(",");
    groups.set(key, [...(groups.get(key) ?? []), `${entry.opens}–${entry.closes}`]);
  }
  const lines: string[] = [];
  for (const [key, ranges] of groups) {
    const days = key.split(",") as Day[];
    const runs: Day[][] = [];
    for (const day of days) {
      const last = runs.at(-1);
      if (last && DAYS.indexOf(last.at(-1)!) + 1 === DAYS.indexOf(day)) last.push(day);
      else runs.push([day]);
    }
    const label = runs
      .map((run) =>
        run.length > 2
          ? `${dayName(run[0], locale)}–${dayName(run.at(-1)!, locale)}`
          : run.map((day) => dayName(day, locale)).join(", "),
      )
      .join(", ");
    lines.push(label.charAt(0).toLocaleUpperCase(locale) + label.slice(1), ...ranges.sort());
  }
  return lines.join("\n");
}

/** Opening hours, one line per row as written. A row that starts with a digit
 * is a time range and reads large; a closing remark after the last range
 * (such as "Domenica chiuso") is emphasised. */
export function hoursRows(hours: string | undefined) {
  const lines = (hours ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const isTime = (text: string) => /^\d/.test(text);
  return lines.map((text, index) => {
    const kind = isTime(text)
      ? "time"
      : lines.slice(0, index).some(isTime) && !lines.slice(index + 1).some(isTime)
        ? "remark"
        : "text";
    return { text, kind } as const;
  });
}

/** Hours on one line, for footers. */
export function hoursLine(hours: string | undefined) {
  return hoursRows(hours)
    .map((row) => row.text)
    .join(" · ");
}

/**
 * The footer's one line of hours when every location keeps the same ones:
 * the store's own summary, else the shared hours on one line. Empty when
 * the locations differ (each then shows its own).
 */
export function sharedHoursLine(shop: { store: { hoursSummary?: string }; locations: readonly Location[]; locale: string }) {
  const texts = new Set(shop.locations.map((location) => hoursText(location, shop.locale)));
  if (texts.size !== 1) return "";
  return shop.store.hoursSummary || hoursLine([...texts][0]);
}

/** The cities of every location, once each. */
export function cities(locations: readonly Location[]) {
  return [...new Set(locations.map((location) => location.city))];
}

export function fill(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** External links open in a new tab; tel:, mailto: and site paths do not. */
export function external(href: string) {
  return /^https?:\/\//.test(href)
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
}

type Segment = TemplateContext["introduction"]["summary"][number];

/** Rich hero text as plain words: brands keep their names, icons are dropped. */
export function plainText(segments: readonly Segment[]) {
  return segments
    .map((segment) => ("text" in segment ? segment.text : segment.brand.name))
    .join("")
    .trim();
}
