// Profile → Pond. Every name, line, link and picture the site shows comes from the profile; the interface's own
// wording (navigation, the day/night switch, the pond's hint) comes from the template's settings, in plain English
// by default.

import type { TemplateContext } from "@/core/contracts";

export type PondLabels = {
  home: string;
  projects: string;
  gallery: string;
  /** without one, the profile's title for its writing */
  blog?: string;
  light: string;
  dark: string;
  timeOfDay: string;
  greeting: string;
  pond: string;
  hint: string;
  minutes: string;
  allTopics: string;
  back: string;
  notFound: string;
  skip: string;
  close: string;
  previous: string;
  next: string;
};

export type PondOptions = {
  motto?: string[];
  /** the time of day the site opens in */
  time?: "auto" | "day" | "night";
  projectsPath?: string;
  galleryPath?: string;
  labels?: Partial<PondLabels>;
};

export const DEFAULT_LABELS: Omit<PondLabels, "blog"> = {
  home: "Pond",
  projects: "Work",
  gallery: "Photographs",
  light: "Day",
  dark: "Night",
  timeOfDay: "Time of day",
  greeting: "{hello}, I'm {name}.",
  pond: "Feed the koi",
  hint: "Touch the water to feed the koi",
  minutes: "min read",
  allTopics: "All",
  back: "Back to the pond",
  notFound: "This page wandered off.",
  skip: "Skip to content",
  close: "Close",
  previous: "Previous",
  next: "Next",
};

/** A piece of a line of the introduction: plain text, or a name that links when it has an address. */
export type Part = string | { text: string; href: string | null };
export type NavKey = "home" | "projects" | "gallery" | "blog";
export type NavItem = { key: NavKey; label: string; href: string };
export type Link = { text: string; href: string; external: boolean };

const options = (context: TemplateContext) => context.options as PondOptions;

export function pondLabels(context: TemplateContext): PondLabels {
  const own = options(context).labels ?? {};
  return { ...DEFAULT_LABELS, ...own, blog: own.blog ?? context.writing.title };
}

/** the scheme the site opens in, as the site element's data-default (host.css) */
export const defaultScheme = (context: TemplateContext) =>
  ({ auto: "system", day: "light", night: "dark" } as const)[options(context).time ?? "auto"];

export const isExternal = (href: string) => /^https?:/.test(href);

export const enabledProjects = (context: TemplateContext) =>
  context.features.work ? context.projects.filter((project) => project.enabled) : [];

export const photographs = (context: TemplateContext) =>
  context.features.photography ? (context.photography?.images ?? []) : [];

/** The koi of the site: the n-th koi of every pond is the n-th project's, so a project's fish swims there too. */
export const koiSeeds = (context: TemplateContext) => enabledProjects(context).map((project) => project.id);

export function pagePaths(context: TemplateContext) {
  return {
    projects: `/${options(context).projectsPath ?? "projects"}`,
    gallery: `/${options(context).galleryPath ?? "gallery"}`,
  };
}

/** Work / Photographs / Writing: each only when there is something behind it. */
export function pondNav(context: TemplateContext): NavItem[] {
  const labels = pondLabels(context);
  const paths = pagePaths(context);
  const items: NavItem[] = [];
  if (enabledProjects(context).length) items.push({ key: "projects", label: labels.projects, href: paths.projects });
  if (photographs(context).length) items.push({ key: "gallery", label: labels.gallery, href: paths.gallery });
  if (context.capabilities.writing) items.push({ key: "blog", label: labels.blog!, href: "/blogs" });
  return items;
}

export const siteName = (context: TemplateContext) => context.site.identity.name;

export function socialLinks(context: TemplateContext): Link[] {
  return context.site.socialLinks
    .filter((link) => link.href.trim())
    .map((link) => ({ text: link.label, href: link.href, external: isExternal(link.href) }));
}

/** The profile's rich text as parts; a brand that names a published project links to it. */
function partsOf(context: TemplateContext, segments: TemplateContext["introduction"]["summary"]): Part[] {
  const projects = enabledProjects(context);
  const projectsHref = pagePaths(context).projects;
  return segments
    .map((segment): Part => {
      if ("text" in segment) return segment.text;
      const project = segment.brand.project && projects.find((item) => item.id === segment.brand.project);
      return { text: segment.brand.name, href: project ? `${projectsHref}#${project.id}` : null };
    })
    .filter((part) => (typeof part === "string" ? part.length > 0 : part.text.length > 0));
}

export function introduction(context: TemplateContext) {
  const labels = pondLabels(context);
  const { identity } = context.site;
  const name = identity.firstName?.trim() || identity.name;
  const hello = context.introduction.greetings[0]?.trim();
  const greeting = (hello ? labels.greeting : labels.greeting.replace(/\{hello\}[,.!]?\s*/, ""))
    .replace("{hello}", hello ?? "")
    .replace("{name}", name);
  const roleLine = partsOf(context, context.introduction.roleLine);
  const role: Part[] = roleLine.length
    ? roleLine
    : identity.role
      ? [identity.company ? `${identity.role}, ${identity.company}` : identity.role]
      : [];
  return {
    motto: (options(context).motto ?? []).filter((line) => line.trim()),
    greeting,
    role,
    summary: partsOf(context, context.introduction.summary),
    links: socialLinks(context),
  };
}

export const dateOf = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00Z`),
  );
