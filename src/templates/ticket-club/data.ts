// Profile → Ticket Club. Every word and link the page shows is the author's (the profile) or the
// template's interface wording (the `labels` option, with the defaults below). Nothing here is
// written in the author's name.

import type { TemplateContext } from "@/core/contracts";

export const STOCKS = [
  "gold",
  "red",
  "blue",
  "green",
  "pink",
  "cream",
] as const;
export type Stock = (typeof STOCKS)[number];

export type Labels = {
  tickets: string;
  letter: string;
  writing: string;
  programme: string;
  hintIdle: string;
  hintDone: string;
  copyFailed: string;
  admit: string;
  issuedBy: string;
  stub: string;
  pull: string;
  stubAction: string;
  taken: string;
  again: string;
  envelopeTo: string;
  envelopeFrom: string;
  envelopeDate: string;
  envelopeHint: string;
  letterTitle: string;
  letterGreeting: string;
  signOff: string;
  allPosts: string;
  allWriting: string;
  minutes: string;
  tagged: string;
  keepArticle: string;
  void: string;
  backHome: string;
  notFoundKicker: string;
  notFoundTop: string;
  notFoundBottom: string;
  notFoundText: string;
  top: string;
};

/** Interface wording. `writing` and `envelopeDate` are filled from the profile. */
export const DEFAULT_LABELS: Omit<Labels, "writing" | "envelopeDate"> = {
  tickets: "Tickets",
  letter: "Letter",
  programme: "Programme",
  hintIdle: "Click a ticket to go there. Tear off its stub to keep the link.",
  hintDone: "Kept: {link}. Paste it anywhere.",
  copyFailed: "Couldn’t copy. It’s {link}",
  admit: "Admit one to",
  issuedBy: "Issued by {name}",
  stub: "Keep this stub",
  pull: "Tear here",
  stubAction: "Tear off the stub and copy the link to {link}",
  taken: "Copied",
  again: "Print another",
  envelopeTo: "To you",
  envelopeFrom: "From {name}",
  envelopeHint: "Turn it over and break the seal",
  letterTitle: "A letter",
  letterGreeting: "Dear visitor,",
  signOff: "Yours,",
  allPosts: "All",
  allWriting: "All articles",
  minutes: "min",
  tagged: "Tagged",
  keepArticle: "Tear off the stub to keep a link to this article.",
  void: "Void",
  backHome: "Back to the tickets",
  notFoundKicker: "Not found",
  notFoundTop: "Lost",
  notFoundBottom: "ticket.",
  notFoundText: "This page isn’t on the programme.",
  top: "Back to top",
};

export type TicketOption = {
  link: string;
  title?: string[];
  kicker?: string;
  subtitle?: string;
  stub?: string;
  label?: string;
  toast?: string;
};
export type Options = {
  labels?: Partial<Labels>;
  tickets?: TicketOption[];
  stock?: Stock;
  editionPath?: string;
};

/** A ticket as the strip prints it. */
export type Ticket = {
  serial: string;
  kicker: string;
  title: string[];
  /** the link as printed: no protocol, no trailing slash */
  address: string;
  /** what the ticket opens, the stub hands out and the code carries */
  link: string;
  /** the destination's name, for assistive technology */
  label: string;
  stub: string;
  /** the line under the strip once the link is copied */
  toast: string;
  external: boolean;
};

export const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

/** A link as printed: no protocol, no trailing slash, no mail query. */
export const shortLink = (u: string) =>
  u
    .replace(/^(?:https?:\/\/|mailto:|tel:|sms:)/i, "")
    .replace(/^www\./i, "")
    .replace(/[?#]$/, "")
    .replace(/\/$/, "")
    .replace(/^([^/?]+@[^?]+)\?.*$/, "$1");
/** What the clipboard receives: the address for mail and phone links, the full link otherwise. */
export const copyText = (u: string) =>
  /^(?:mailto|tel|sms):/i.test(u) ? shortLink(u) : u;
const absolute = (origin: string, href: string) =>
  href.startsWith("/") ? `${origin}${href}` : href;
/** A stable six-figure serial for a link, so a ticket keeps its number from build to build. */
export const serialOf = (link: string) => {
  let h = 2166136261;
  for (const c of link) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return String((h >>> 0) % 1_000_000).padStart(6, "0");
};

export function labelsOf(context: TemplateContext): Labels {
  const options = context.options as Options;
  const { city } = context.site.location;
  return {
    ...DEFAULT_LABELS,
    writing: context.writing.title,
    envelopeDate: [city, String(context.site.copyrightYear)]
      .filter(Boolean)
      .join(", "),
    ...options.labels,
  };
}

export const stockOf = (context: TemplateContext): Stock =>
  (context.options as Options).stock ?? "gold";

/** The tickets: the option's list, or the author's own links (each profile link, then e-mail). */
export function ticketsOf(context: TemplateContext): Ticket[] {
  const options = context.options as Options;
  const { site } = context;
  const labels = labelsOf(context);
  const origin = site.origin.replace(/\/$/, "");
  const host = (link: string) => {
    try {
      return new URL(link).hostname.replace(/^www\./, "");
    } catch {
      return shortLink(link);
    }
  };
  type Draft = { link: string; label: string; o?: TicketOption };
  let drafts: Draft[];
  if (options.tickets?.length) {
    drafts = options.tickets.map((o) => {
      const link = absolute(origin, o.link.trim());
      return {
        link,
        label: o.label ?? (/^mailto:/i.test(link) ? "Email" : host(link)),
        o,
      };
    });
  } else {
    drafts = site.socialLinks
      // a link to this very site is not a ticket anywhere
      .filter(
        (l) => l.href.trim() && l.href.trim().replace(/\/$/, "") !== origin,
      )
      .map((l) => ({ link: absolute(origin, l.href.trim()), label: l.label }));
    const email = site.contact?.email.trim();
    if (email && !drafts.some((d) => /^mailto:/i.test(d.link)))
      drafts.push({ link: `mailto:${email}`, label: "Email" });
    // an author with no links of their own still has this site to hand out
    if (!drafts.length) drafts.push({ link: origin, label: host(origin) });
  }
  return drafts.slice(0, 6).map(({ link, label, o }) => {
    const address = shortLink(link);
    return {
      serial: serialOf(link),
      kicker: o?.kicker ?? labels.admit,
      title: o?.title?.length ? o.title.slice(0, 2) : [label],
      address: o?.subtitle ?? address,
      link,
      label,
      stub: o?.stub ?? labels.stub,
      toast: o?.toast ?? fill(labels.hintDone, { link: address }),
      external:
        /^https?:/i.test(link) &&
        !link.startsWith(`${origin}/`) &&
        link !== origin,
    };
  });
}

type Segment = { text: string; tone?: "muted" | "strong" | "highlight" };

/** The letter: the biography's story (feature switch respected), signed with the author's name. */
export function letterOf(context: TemplateContext) {
  if (!context.features.about) return null;
  const paragraphs: Segment[][] = context.biography.story
    .map((p) =>
      p
        .filter((s) => s.text.trim())
        .map((s) => ({ text: s.text, tone: s.tone })),
    )
    .filter((p) => p.length);
  if (!paragraphs.length) return null;
  const labels = labelsOf(context);
  const { identity, location, copyrightYear } = context.site;
  return {
    paragraphs,
    greeting: labels.letterGreeting,
    signOff: labels.signOff,
    name: identity.name,
    place: labels.envelopeDate,
    to: labels.envelopeTo,
    from: fill(labels.envelopeFrom, { name: identity.name }),
    returnAddress: [location.city, location.country].filter(Boolean).join(", "),
    hint: labels.envelopeHint,
    initials: identity.initials || identity.name.slice(0, 2),
    stamp: {
      portrait: context.introduction.portraits[0] ?? null,
      city: location.city || location.country || identity.name,
      year: String(copyrightYear),
    },
  };
}
export type LetterData = NonNullable<ReturnType<typeof letterOf>>;

/** Plain text of a rich line (brands by name). */
export const plain = (
  parts: readonly ({ text: string } | { brand: { name: string } })[],
) =>
  parts
    .map((p) => ("text" in p ? p.text : p.brand.name))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

/** The bill's lines: who, what and where. */
export function billOf(context: TemplateContext) {
  const { identity, location } = context.site;
  const role =
    plain(context.introduction.roleLine) ||
    [identity.role, identity.company].filter(Boolean).join(" · ");
  return {
    name: identity.name,
    role,
    place: [location.city, location.country].filter(Boolean).join(", "),
    summary: plain(context.introduction.summary),
  };
}

/** The programme: the author's enabled projects, each with its first link. */
export function programmeOf(context: TemplateContext) {
  if (!context.features.work) return [];
  const origin = context.site.origin.replace(/\/$/, "");
  return context.projects
    .filter((p) => p.enabled)
    .map((p) => {
      const href = p.actions?.find((a) => a.href)?.href;
      return {
        id: p.id,
        name: p.name,
        date: p.date,
        description: p.description,
        href,
        external:
          !!href &&
          /^https?:/i.test(href) &&
          !absolute(origin, href).startsWith(`${origin}/`),
      };
    });
}

export const editionPathOf = (context: TemplateContext) =>
  (context.options as Options).editionPath || "edition";

/** The navigation every page shares: the tickets, the letter, the programme and the writing, as the
 * profile has them. The layout persists across pages, so the sections are addressed from the root. */
export function navOf(context: TemplateContext) {
  const labels = labelsOf(context);
  const at = (id: string) => `/#${id}`;
  return [
    { label: labels.tickets, href: at("tickets") },
    ...(letterOf(context)
      ? [{ label: labels.letter, href: at("letter") }]
      : []),
    ...(programmeOf(context).length
      ? [{ label: labels.programme, href: at("programme") }]
      : []),
    ...(context.capabilities.writing
      ? [{ label: labels.writing, href: "/blogs" }]
      : []),
  ];
}

export const dateOf = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));

/** A title in at most two lines of about equal length, for a ticket's face. */
export function twoLines(text: string): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2 || text.length <= 14) return [text.trim()];
  let best = [text.trim()];
  let score = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const d = Math.abs(a.length - b.length);
    if (d < score) [best, score] = [[a, b], d];
  }
  return best;
}

/** The ticket that ends an article: its stub keeps the article's address. */
export function articleTicket(
  context: TemplateContext,
  post: { title: string; href: string },
): Ticket {
  const labels = labelsOf(context);
  const link = `${context.site.origin.replace(/\/$/, "")}${post.href}`;
  const address = shortLink(link);
  return {
    serial: serialOf(link),
    kicker: labels.admit,
    title: twoLines(post.title),
    address,
    link,
    label: post.title,
    stub: labels.stub,
    toast: fill(labels.hintDone, { link: address }),
    external: false,
  };
}
