// Profile → Ticket Club. Each ticket on the line is one of the author's destinations: names, handles and
// links come from the profile (or the `tickets` option); the design's own wording (labels, hints, the
// tickets' printed lines) comes from the `labels` option and the ticket defaults below, which are the
// original's words.

import type { TemplateContext } from "@/core/contracts";

export type IconName = "web" | "github" | "chat";

export type ClubLabels = {
  brandTop: string;
  brandBottom: string;
  edition: string;
  tagline: string;
  titleTop: string;
  titleBottom: string;
  subLead: string;
  subTail: string;
  edit: string;
  fresh: string;
  pass: string;
  club: string;
  year: string;
  pull: string;
  taken: string;
  again: string;
  hintIdle: string;
  hintPull: string;
  hintDone: string;
  clipboard: string;
  clipboardFoot: string;
  keys: string;
  copyFailed: string;
  writing: string;
  envelopeTo: string;
  envelopeDate: string;
  envelopeHint: string;
  envelopeOpening: string;
  envelopeTag: string;
  letterTitle: string;
  letterGreeting: string;
  close: string;
  previous: string;
  next: string;
  stampCity: string;
  stampCaption: string;
  stampRainy: string;
  stampPost: string;
  stampWithLove: string;
  allPosts: string;
  readPost: string;
  minutes: string;
  backHome: string;
  notFoundKicker: string;
  notFoundTop: string;
  notFoundBottom: string;
  notFoundText: string;
};

/** The original's wording. `year`, `writing` and `envelopeDate` are filled from the profile. */
export const DEFAULT_LABELS: Omit<ClubLabels, "year" | "writing" | "envelopeDate"> = {
  brandTop: "YOUR LITTLE",
  brandBottom: "LINK COLLECTION",
  edition: "PERSONAL EDITION",
  tagline: "GOOD THINGS. PASSED ALONG.",
  titleTop: "TICKET",
  titleBottom: "CLUB",
  subLead: "A little piece of my internet.",
  subTail: "Tear one off. Make it yours.",
  edit: "Edit your links",
  fresh: "Fresh tickets",
  pass: "PERSONAL PASS",
  club: "TICKET CLUB",
  pull: "PULL TO COLLECT",
  taken: "TAKEN. GOOD CHOICE.",
  again: "PRINT ANOTHER ↻",
  hintIdle: "A whole collection. In good hands.",
  hintPull: "One little pull. One good link.",
  hintDone: "A good link, ready to go. ⌘ V",
  clipboard: "Clipboard",
  clipboardFoot: "Copied & ready to paste.",
  keys: "⌘ V",
  copyFailed: "Couldn’t copy. It’s {link}",
  envelopeTo: "To: You",
  envelopeHint: "Drag to tear the envelope, or tap to open",
  envelopeOpening: "Opening your letter...",
  envelopeTag: "drag",
  letterTitle: "A little about me",
  letterGreeting: "Dear friend,",
  close: "Close",
  previous: "Previous",
  next: "Next",
  stampCity: "SINGAPORE",
  stampCaption: "SHOPHOUSES",
  stampRainy: "RAINY DAYS",
  stampPost: "POST",
  stampWithLove: "WITH LOVE",
  allPosts: "ALL",
  readPost: "READ IT",
  minutes: "MIN",
  backHome: "BACK TO THE LINE",
  notFoundKicker: "NOT FOUND",
  notFoundTop: "LOST",
  notFoundBottom: "TICKET.",
  notFoundText: "This page isn’t on the line.",
};

export type TicketOption = {
  link: string;
  title?: string[];
  kicker?: string;
  subtitle?: string;
  stub?: string;
  label?: string;
  toast?: string;
  icon?: IconName;
  light?: boolean;
};
export type ClubOptions = {
  labels?: Partial<ClubLabels>;
  tickets?: TicketOption[];
  editionPath?: string;
};

/** A ticket as the page draws it. */
export type Ticket = {
  n: string;
  kind: string;
  title: string[];
  sub: string;
  take: string;
  /** what the stub hands out (and the QR code carries) */
  link: string;
  /** clipboard row title */
  label: string;
  icon: IconName;
  toast: string;
  light: boolean;
};

type Role = "web" | "code" | "contact";
// the original's three tickets, by what they point at
const ROLE: Record<Role, { kind: string; title: string[]; sub: string; icon: IconName }> = {
  web: { kind: "THE WEBSITE", title: ["A LITTLE", "ABOUT ME."], sub: "A home for ideas & things I make.", icon: "web" },
  code: { kind: "THE REPOSITORY", title: ["BUILT TO", "BE OPEN."], sub: "Good things are better when shared.", icon: "github" },
  contact: { kind: "THE CONVERSATION", title: ["KEEP IN", "TOUCH."], sub: "Every good thing starts with a hello.", icon: "chat" },
};
const CODE_HOSTS = /^https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|codeberg\.org|bitbucket\.org)\//i;
const roleOf = (link: string): Role =>
  /^(?:mailto|tel|sms):/i.test(link) ? "contact" : CODE_HOSTS.test(link) ? "code" : "web";

/** A link as printed on the stub: no protocol, no trailing slash. */
export const shortLink = (u: string) => u.replace(/^(?:https?:\/\/|mailto:|tel:|sms:)/i, "").replace(/\/$/, "");
/** What the clipboard receives: an address for mail and phone links, the full link otherwise. */
export const copyText = (u: string) => (/^(?:mailto|tel|sms):/i.test(u) ? shortLink(u).split("?")[0] : u);
const absolute = (origin: string, href: string) => (href.startsWith("/") ? `${origin.replace(/\/$/, "")}${href}` : href);

export function clubLabels(context: TemplateContext): ClubLabels {
  const options = context.options as ClubOptions;
  const { city } = context.site.location;
  return {
    ...DEFAULT_LABELS,
    year: `${context.site.copyrightYear} · ∞`,
    writing: context.writing.title.toLocaleUpperCase(context.site.identity.locale),
    envelopeDate: [city, String(context.site.copyrightYear)].filter(Boolean).join(", "),
    ...options.labels,
  };
}

/** The tickets: the option's list, or one per destination the profile has (site, code, contact). */
export function ticketsOf(context: TemplateContext): Ticket[] {
  const options = context.options as ClubOptions;
  const { site, features } = context;
  const origin = site.origin.replace(/\/$/, "");
  type Draft = { role: Role; link: string; label: string; take?: string; toast?: string; o?: TicketOption };
  let drafts: Draft[];
  if (options.tickets?.length) {
    drafts = options.tickets.slice(0, 3).map((o) => {
      const link = absolute(origin, o.link.trim());
      const role = roleOf(link);
      return { role, link, label: o.label ?? (role === "web" ? new URL(link, origin).hostname.replace(/^www\./, "") : shortLink(link)), o };
    });
  } else {
    drafts = [{ role: "web", link: origin, label: "Website" }];
    // built to be open: a code profile, else the first project with a link of its own
    const code = site.socialLinks.find((l) => l.icon === "github" || CODE_HOSTS.test(l.href));
    const project = features.work
      ? context.projects
          .filter((p) => p.enabled)
          .flatMap((p) => (p.actions ?? []).filter((a) => a.href).map((a) => ({ name: p.name, href: absolute(origin, a.href) })))[0]
      : undefined;
    if (code) drafts.push({ role: "code", link: code.href, label: code.label });
    else if (project) drafts.push({ role: "code", link: project.href, label: project.name });
    // keep in touch: e-mail, else the first other social profile
    const email = site.contact?.email.trim() ?? "";
    const social = site.socialLinks.find((l) => l !== code && l.icon !== "email" && l.icon !== "website" && l.href !== origin);
    if (email)
      drafts.push({ role: "contact", link: `mailto:${email}`, label: "Email", take: "TAKE MY EMAIL", toast: "Email copied. All yours." });
    else if (social)
      drafts.push({ role: "contact", link: social.href, label: social.label, take: `TAKE MY ${social.label.toLocaleUpperCase(site.identity.locale)}` });
  }
  return drafts.map((d, i) => {
    const r = ROLE[d.role];
    const o = d.o;
    // a project link on the second ticket is not a repository
    const kind = o?.kicker ?? (d.role === "code" && !CODE_HOSTS.test(d.link) ? "THE PROJECT" : r.kind);
    return {
      n: String(i + 1).padStart(2, "0"),
      kind,
      title: o?.title?.length ? o.title.slice(0, 2) : r.title,
      sub: o?.subtitle ?? r.sub,
      take: o?.stub ?? d.take ?? "TAKE MY LINK",
      link: d.link,
      label: d.label,
      icon: o?.icon ?? (d.role === "code" && !CODE_HOSTS.test(d.link) ? "web" : r.icon),
      toast: o?.toast ?? d.toast ?? `${d.label} link copied. All yours.`,
      light: o?.light ?? i === 0,
    };
  });
}

/** The letter in the personal edition: the biography's story (feature switch respected). */
export function letterOf(context: TemplateContext) {
  if (!context.features.about) return null;
  const paragraphs = context.biography.story
    .map((p) => p.filter((s) => s.text.trim()))
    .filter((p) => p.length)
    .map((p) => p.map((s) => ({ text: s.text, mark: s.tone === "highlight" })));
  return paragraphs.length ? paragraphs : null;
}

export const editionPathOf = (context: TemplateContext) => (context.options as ClubOptions).editionPath || "edition";

/** Everything the line's page needs, serialisable for the client island. */
export function buildClub(context: TemplateContext) {
  const labels = clubLabels(context);
  const tickets = ticketsOf(context);
  const letter = letterOf(context);
  return {
    labels,
    tickets,
    name: context.site.identity.name.toLocaleUpperCase(context.site.identity.locale),
    edition: letter ? `/${editionPathOf(context)}` : null,
    writing: context.capabilities.writing ? "/blogs" : null,
  };
}
export type ClubData = ReturnType<typeof buildClub>;
