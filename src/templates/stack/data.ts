// Profile → Stack. Every name, text, picture and link the page shows comes from
// the profile; the interface wording (section tabs, button text) comes from the
// template's settings, with the English defaults its manifest declares.

import type { TemplateContext } from "@/core/contracts";
import type { BlogPostSummary } from "@/blog/types";
import { mediaDimensions } from "@/portfolio/media";
import manifest from "./manifest.json";

// The manifest's settings schema is the one list of interface words and their defaults.
const LABEL_SCHEMA = manifest.optionsSchema.properties.labels.properties;

export type StackLabels = Record<keyof typeof LABEL_SCHEMA, string>;

export type StackOptions = {
  labels?: Partial<StackLabels>;
  camera?: string;
  ending?: { quote: string; author?: string };
};

export const DEFAULT_LABELS = Object.fromEntries(
  Object.entries(LABEL_SCHEMA).map(([key, entry]) => [key, entry.default]),
) as StackLabels;

export type Picture = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** A crop for narrow screens, when the profile has one. */
  mobile?: { src: string; width: number; height: number };
};

export type Segment =
  | { text: string }
  | { brand: { name: string; icon: string; href: string | null } };

export type SectionId =
  "about" | "work" | "writing" | "photography" | "contact";
export type Tab = { id: SectionId; label: string };

export type DeckCard = {
  id: string;
  name: string;
  date: string;
  description: string;
  icon: string | null;
  badge: { text: string; tone: "gold" | "blue"; href: string | null } | null;
  actions: {
    label: string;
    href: string;
    external: boolean;
    newTab: boolean;
  }[];
  /** The board's picture; app screenshots (up to three) sit side by side. */
  pictures: Picture[];
  screens: boolean;
};

export type Post = {
  id: string;
  title: string;
  href: string;
  date: string;
  datetime: string;
  minutes: string;
};

function dimensions(src: string) {
  try {
    return mediaDimensions(src);
  } catch {
    return null;
  }
}

function picture(src: string, alt: string, mobile?: string): Picture | null {
  const size = dimensions(src);
  if (!size) return null;
  const small = mobile ? dimensions(mobile) : null;
  return {
    src,
    alt,
    ...size,
    ...(mobile && small ? { mobile: { src: mobile, ...small } } : {}),
  };
}

export function stackLabels(context: TemplateContext): StackLabels {
  const options = context.options as StackOptions;
  return { ...DEFAULT_LABELS, ...options.labels };
}

export const dateFormat = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function postsOf(
  posts: readonly BlogPostSummary[],
  locale: string,
  labels: StackLabels,
): Post[] {
  const format = dateFormat(locale);
  return posts.map((post) => ({
    id: post.slug,
    title: post.title,
    href: post.href,
    datetime: post.date.slice(0, 10),
    date: format.format(new Date(`${post.date.slice(0, 10)}T00:00:00Z`)),
    minutes: `${post.readingMinutes} ${labels.minutes}`,
  }));
}

const isExternal = (href: string) => /^https?:\/\//.test(href);

export function buildStack(
  context: TemplateContext,
  posts: readonly BlogPostSummary[],
) {
  const options = context.options as StackOptions;
  const labels = stackLabels(context);
  const { identity, contact, socialLinks, location } = context.site;
  const locale = identity.locale;

  const projects = context.features.work
    ? context.projects.filter((project) => project.enabled)
    : [];
  const projectIds = new Set(projects.map((project) => project.id));
  const rich = (
    segments: TemplateContext["introduction"]["summary"],
  ): Segment[] =>
    segments.map((part) =>
      "text" in part
        ? { text: part.text }
        : {
            brand: {
              name: part.brand.name,
              icon: part.brand.icon,
              href:
                part.brand.project && projectIds.has(part.brand.project)
                  ? `#work-${part.brand.project}`
                  : null,
            },
          },
    );

  // The cover: the first portraits make the pile beside the name.
  const portraits = context.introduction.portraits
    .slice(0, 4)
    .map((src) => picture(src, ""))
    .filter((item): item is Picture => item !== null);
  const roleLine = context.introduction.roleLine.length
    ? rich(context.introduction.roleLine)
    : identity.role
      ? [{ text: identity.role }]
      : [];
  const place = [location.city, location.country].filter(Boolean).join(", ");

  // About: the story on a ruled card, then the timeline as index cards, newest first.
  const about = context.features.about;
  const story = about
    ? context.biography.story.filter((paragraph) => paragraph.length)
    : [];
  const timeline = about ? [...context.biography.timeline] : [];
  const yearOf = (value: string | undefined) =>
    Number(value?.match(/\d{4}/)?.[0]);
  if (yearOf(timeline[0]?.year) < yearOf(timeline.at(-1)?.year))
    timeline.reverse();
  const cards = timeline.map((item) => ({
    year: item.year,
    title: item.title,
    text: item.desc,
    current: item.current === true,
  }));

  // Work: one mounted board per project, dealt into a deck.
  const deck: DeckCard[] = projects.map((project) => {
    const media = project.media;
    const pictures =
      media.kind === "image"
        ? [picture(media.image.src, media.image.alt, media.image.mobile)]
        : media.kind === "carousel"
          ? [
              picture(
                media.images[0].src,
                media.images[0].alt,
                media.images[0].mobile,
              ),
            ]
          : media.screens
              .slice(0, 3)
              .map((screen) => picture(screen.src, screen.alt));
    return {
      id: project.id,
      name: project.name,
      date: project.date,
      description: project.description,
      icon: project.icon ?? null,
      badge: project.badge
        ? {
            text: project.badge.text,
            tone: project.badge.tone,
            href: project.badge.href ?? null,
          }
        : null,
      actions: (project.actions ?? []).map((action) => ({
        label: action.label,
        href: action.href,
        external: isExternal(action.href),
        newTab: action.newTab ?? isExternal(action.href),
      })),
      pictures: pictures.filter((item): item is Picture => item !== null),
      screens: media.kind === "screens",
    };
  });

  const writing = postsOf(posts.slice(0, 6), locale, labels);

  // Photography: up to nine prints, loose on the table.
  const photographs =
    context.features.photography && context.photography.images.length
      ? context.photography.images
          .map((image) => picture(image.src, image.alt))
          .filter((item): item is Picture => item !== null)
          .slice(0, 9)
      : [];
  const instagram = socialLinks.find((link) => link.icon === "instagram");
  const photography = photographs.length
    ? {
        intro: context.photography.intro,
        prints: photographs,
        camera: options.camera ? `${labels.shotWith} ${options.camera}` : null,
        more: instagram
          ? { href: instagram.href, label: labels.morePhotos }
          : null,
      }
    : null;

  // Contact: a stack of calling cards to take one from.
  const email = contact?.email.trim() ?? "";
  const links = socialLinks
    .filter((link) => link.icon !== "email")
    .map((link) => ({ label: link.label, href: link.href }));
  const resume =
    context.features.resume && context.site.resume
      ? { href: context.site.resume.pdf, label: labels.resume }
      : null;
  const card =
    email || links.length || resume
      ? {
          name: identity.name,
          role: identity.role,
          place,
          email,
          links,
          resume,
        }
      : null;

  // The option wins; otherwise the profile's own closing quote, if it has one.
  const ending = options.ending?.quote
    ? { quote: options.ending.quote, author: options.ending.author ?? null }
    : context.closingQuote.quote
      ? {
          quote: context.closingQuote.quote,
          author: context.closingQuote.author || null,
        }
      : null;

  const tabs: Tab[] = [
    ...(story.length || cards.length
      ? [{ id: "about" as const, label: labels.about }]
      : []),
    ...(deck.length ? [{ id: "work" as const, label: labels.work }] : []),
    ...(writing.length
      ? [{ id: "writing" as const, label: labels.writing }]
      : []),
    ...(photography
      ? [{ id: "photography" as const, label: labels.photography }]
      : []),
    ...(card ? [{ id: "contact" as const, label: labels.contact }] : []),
  ];

  return {
    labels,
    locale,
    tabs,
    cover: {
      name: identity.name,
      roleLine,
      place,
      summary: rich(context.introduction.summary),
      portraits,
    },
    story,
    cards,
    deck,
    writing: {
      heading: context.writing.heading ?? context.writing.title,
      description: context.writing.description,
      posts: writing,
    },
    photography,
    card,
    ending,
    footer: { name: identity.name, year: context.site.copyrightYear },
  };
}

export type StackData = ReturnType<typeof buildStack>;
