import type { TemplateContext } from "@/core/contracts";
import { mediaDimensions } from "@/portfolio/media";
import { refractCopy, type RefractCopy } from "./copy";

export type ResearchFigureConfig = {
  source: string;
  animatedSource?: string;
  width: number;
  height: number;
  caption?: string;
};
export type FeaturedLink = {
  label: string;
  href?: string;
  icon?: "github" | "linkedin" | "external" | "cv" | null;
  image?: string;
  download?: boolean;
};
export type ResearchProject = {
  id: string;
  title: string;
  /** The project's own date line, shown beside its position in the series. */
  meta: string;
  description: string;
  imageAlt: string | null;
  imageCaption: string | null;
  url: string | null;
  linkLabel: string;
};
export type RefractOptions = {
  tagline?: string;
  rotatingTopics?: string[];
  projectHeading?: string;
  toolsHeading?: string;
  focus?: string[];
  layerLabels?: string[];
  labels?: Partial<RefractCopy>;
  group?: string;
  fracturedGlass?: boolean;
  continentalDrift?: boolean | "first";
  tools?: {
    id: string;
    name: string;
    description: string;
    url?: string;
    links?: { label: string; url: string }[];
  }[];
  news?: { id: string; date: string; description: string; url?: string }[];
  publications?: {
    id: string;
    title: string;
    authors: string;
    year: number;
    journal: string;
    citation: string;
    url?: string;
    highlight?: string;
  }[];
  researchFigures?: Record<string, ResearchFigureConfig>;
};

/** Template options enrich the shared profile; identity never has a second source. */
export function createRefractData(context: TemplateContext) {
  const options = context.options as RefractOptions;
  const identity = context.site.identity;
  const copy = refractCopy(identity.locale, options.labels);
  const plain = (parts: TemplateContext["introduction"]["summary"]) =>
    parts
      .map((part) => ("text" in part ? part.text : part.brand.name))
      .join("");
  const projects = context.features.work
    ? context.projects.filter((project) => project.enabled)
    : [];
  const researchFigures: Record<string, ResearchFigureConfig> = {};
  const researchProjects: ResearchProject[] = projects.map((project) => {
    const artwork =
      project.media.kind === "image"
        ? project.media.image
        : project.media.images[0];
    researchFigures[project.id] = options.researchFigures?.[project.id] ?? {
      source: artwork.src,
      ...mediaDimensions(artwork.src),
    };
    const action = project.actions?.[0];
    return {
      id: project.id,
      title: project.name,
      meta: project.date,
      description: project.description,
      imageAlt: artwork.alt,
      imageCaption: null,
      url: action?.href ?? null,
      linkLabel: action?.label ?? copy.viewProject,
    };
  });
  const email = context.site.contact.email;
  const profile = {
    name: identity.name,
    role: identity.role,
    affiliation: identity.company,
    affiliationShort: identity.company,
    location: [context.site.location.city, context.site.location.country]
      .filter(Boolean)
      .join(", "),
    coordinates: {
      latitude: context.site.location.latitude,
      longitude: context.site.location.longitude,
    },
    email,
    tagline: options.tagline ?? plain(context.introduction.roleLine),
    summary: plain(context.introduction.summary),
    bio: context.biography.story.map((paragraph) =>
      paragraph.map((segment) => segment.text).join(""),
    ),
    focus: options.focus ?? [],
    group: options.group ?? "",
    portrait: context.introduction.portraits[0],
    portraitAlt: identity.name,
  };
  const socialLinks = context.site.socialLinks.filter(
    (link) => link.icon !== "email",
  );
  const github = socialLinks.find((link) => link.icon === "github");
  const tools = (options.tools ?? []).map((tool) => ({
    ...tool,
    links: tool.links ?? [],
  }));
  const news = options.news ?? [];
  const publications = options.publications ?? [];
  const experience = (
    context.features.about ? context.biography.timeline : []
  ).map((item, index) => ({
    id: `experience-${index}`,
    period: item.year,
    role: item.title,
    description: item.desc,
  }));
  const projectHeading = options.projectHeading ?? copy.projects;
  const toolsHeading = options.toolsHeading ?? copy.tools;
  const sections = [
    ...(context.features.about
      ? [{ label: copy.about, href: "#about", icon: "About" }]
      : []),
    ...(projects.length
      ? [{ label: projectHeading, href: "#work", icon: "Research" }]
      : []),
    ...(news.length ? [{ label: copy.news, href: "#news", icon: "News" }] : []),
    ...(tools.length
      ? [{ label: toolsHeading, href: "#tools", icon: "Tools" }]
      : []),
    ...(experience.length || publications.length
      ? [{ label: copy.cv, href: "#cv", icon: "CV" }]
      : []),
    ...(context.capabilities.writing
      ? [{ label: copy.writing, href: "/blogs", icon: "News" }]
      : []),
    { label: copy.contact, href: "#contact", icon: "Contact" },
  ];
  return {
    copy,
    profile,
    researchProjects,
    tools,
    news,
    publications,
    experience,
    sections,
    socialLinks,
    aboutEnabled: context.features.about,
    // With nothing between the scene and the contact section, the scene's own
    // closing call would repeat the same heading and address one screen later.
    sceneContact:
      context.features.about ||
      news.length > 0 ||
      experience.length > 0 ||
      publications.length > 0,
    links: { email: `mailto:${email}` },
    siteConfig: {
      projectHeading,
      toolsHeading,
      // The drawing stage captions the author's own fields; with neither
      // option set it stays an unlabeled illustration.
      layerLabels: (options.layerLabels ?? profile.focus).slice(0, 4),
      effects: {
        fracturedGlass: options.fracturedGlass ?? true,
        continentalDrift: {
          enabled: options.continentalDrift !== false,
          chapters:
            options.continentalDrift === "first"
              ? ("first" as const)
              : ("all" as const),
          amplitude: 1,
          spread: 1.18,
          duration: 8,
          repeatDelay: 3,
          leadIn: 0.012,
        },
      },
      researchFigures,
      hero: {
        contactLabel: copy.getInTouch,
        contactHref: `mailto:${email}`,
        learnLabel: copy.learnMore,
        learnHref: "#overview",
        featuredLink: github
          ? ({
              label: github.label,
              href: github.href,
              icon: "github",
            } as FeaturedLink)
          : null,
        rotatingTopics: options.rotatingTopics ?? [],
      },
    },
  };
}
export type RefractData = ReturnType<typeof createRefractData>;
