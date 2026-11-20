// Profile → Pond. Every name, line and link the page shows comes from the profile; the wording the
// profile has no field for (the navigation, the theme switch, the greeting's pattern) comes from the
// template options, defaulting to the original's own words.

import type { TemplateContext } from "@/core/contracts";

export type PondLabels = {
  home: string;
  projects: string;
  gallery: string;
  blog: string;
  light: string;
  dark: string;
  greeting: string;
  pond: string;
  minutes: string;
  allTopics: string;
  back: string;
  notFound: string;
};

export type PondOptions = {
  motto?: string[];
  projectsPath?: string;
  galleryPath?: string;
  labels?: Partial<PondLabels>;
};

export const DEFAULT_LABELS: PondLabels = {
  home: "pond",
  projects: "projects",
  gallery: "gallery",
  blog: "blog",
  light: "light",
  dark: "dark",
  greeting: "{hello}, I'm {name}.",
  pond: "Koi pond",
  minutes: "min",
  allTopics: "all",
  back: "back to the pond",
  notFound: "This page wandered off.",
};

/** A piece of an intro line: plain text, or an underlined name that links when it has an address. */
export type Part = string | { text: string; href: string | null };
export type NavKey = "home" | "projects" | "gallery" | "blog";
export type NavItem = { key: NavKey; label: string; href: string };
export type SocialLink = { text: string; href: string; external: boolean };

export function pondLabels(context: TemplateContext): PondLabels {
  return { ...DEFAULT_LABELS, ...(context.options as PondOptions).labels };
}

export const enabledProjects = (context: TemplateContext) =>
  context.features.work ? context.projects.filter((project) => project.enabled) : [];

export const photographs = (context: TemplateContext) =>
  context.features.photography ? (context.photography?.images ?? []) : [];

export function pagePaths(context: TemplateContext) {
  const options = context.options as PondOptions;
  return {
    projects: `/${options.projectsPath ?? "projects"}`,
    gallery: `/${options.galleryPath ?? "gallery"}`,
  };
}

/** pond / projects / gallery / blog: each item only when there is something behind it. */
export function pondNav(context: TemplateContext): NavItem[] {
  const labels = pondLabels(context);
  const paths = pagePaths(context);
  const items: NavItem[] = [{ key: "home", label: labels.home, href: "/" }];
  if (enabledProjects(context).length) items.push({ key: "projects", label: labels.projects, href: paths.projects });
  if (photographs(context).length) items.push({ key: "gallery", label: labels.gallery, href: paths.gallery });
  if (context.capabilities.writing) items.push({ key: "blog", label: labels.blog, href: "/blogs" });
  return items;
}

/** The profile's rich text as intro parts; a brand that names a published project links to it. */
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

export function buildPond(context: TemplateContext) {
  const options = context.options as PondOptions;
  const labels = pondLabels(context);
  const { identity, socialLinks } = context.site;
  const name = identity.firstName?.trim() || identity.name;
  const hello = context.introduction.greetings[0]?.trim();
  const greeting = (hello ? labels.greeting : labels.greeting.replace(/\{hello\}[,.!]?\s*/, ""))
    .replace("{hello}", hello ?? "")
    .replace("{name}", name);

  const role = partsOf(context, context.introduction.roleLine);
  const lines: Part[][] = [
    role.length ? role : identity.role ? [identity.company ? `${identity.role} @ ${identity.company}` : identity.role] : [],
    partsOf(context, context.introduction.summary),
  ].filter((line) => line.length > 0);

  const social: SocialLink[] = socialLinks
    .filter((link) => link.href.trim())
    .map((link) => ({ text: link.label, href: link.href, external: /^https?:/.test(link.href) }));

  return {
    labels,
    nav: pondNav(context),
    motto: (options.motto ?? []).filter((line) => line.trim()),
    greeting,
    lines,
    social,
  };
}

export type PondData = ReturnType<typeof buildPond>;
