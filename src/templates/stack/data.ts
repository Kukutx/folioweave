// Profile → Stack. Every name, text, picture and link the page shows comes from the profile; the
// wording the profile has no field for (section labels, the visitor's side of the conversation,
// button text) comes from the template options, defaulting to the original's design wording.

import type { TemplateContext } from "@/core/contracts";
import type { BlogPostSummary } from "@/blog/types";
import { mediaDimensions } from "@/portfolio/media";

export type Preview = { src: string; ratio: number };

export type StackLabels = {
  est: string;
  navHome: string;
  navAbout: string;
  navWork: string;
  navThoughts: string;
  navContact: string;
  experience: string;
  now: string;
  stuff: string;
  stack: string;
  ventures: string;
  writing: string;
  minutes: string;
  personal: string;
  shotWith: string;
  seeMore: string;
  copy: string;
  submit: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  messagePlaceholder: string;
  endingNote: string;
  showPhotos: string;
  hidePhotos: string;
  selectedWork: string;
  contact: string;
  allWriting: string;
  home: string;
  notFoundTitle: string;
  notFoundText: string;
};

export type StackChat = {
  greeting: string;
  emailReply: string;
  messageAsk: string;
  formReply: string;
  elsewhereAsk: string;
  linksReply: string;
  thanks: string;
  goodbye: string;
};

export type StackOptions = {
  established?: string;
  labels?: Partial<StackLabels>;
  chat?: Partial<StackChat>;
  tools?: { name: string; icon: string }[];
  camera?: string;
  art?: boolean;
  shuffle?: boolean;
  pocketLabel?: { title?: string; tool?: string; date?: string };
  ending?: { quote: string; author?: string };
};

export const DEFAULT_LABELS: StackLabels = {
  est: "EST.",
  navHome: "/HOME",
  navAbout: "/ABOUT",
  navWork: "/WORK",
  navThoughts: "/THOUGHTS",
  navContact: "/CONTACT",
  experience: "EXPERIENCE",
  now: "NOW",
  stuff: "STUFF I DO",
  stack: "STACK",
  ventures: "VENTURES",
  writing: "WRITING",
  minutes: "m",
  personal: "PERSONAL",
  shotWith: "Shot with",
  seeMore: "See more on IG",
  copy: "Copy",
  submit: "Submit",
  namePlaceholder: "John Doe",
  emailPlaceholder: "john@doe.com",
  messagePlaceholder: "Enter your message",
  endingNote: "Ending on a note I try to live by",
  showPhotos: "Show photos of",
  hidePhotos: "Hide photos of",
  selectedWork: "Selected work",
  contact: "Contact",
  allWriting: "All writing",
  home: "Home",
  notFoundTitle: "Nothing here.",
  notFoundText: "The link may be outdated, or the page has moved.",
};

export const DEFAULT_CHAT: StackChat = {
  greeting: "hey, how do i actually reach you?",
  emailReply: "fastest way is to email me. keep it short.",
  messageAsk: "hmm too lazy to email tho",
  formReply: "fair. just use the form below, lands in the same inbox.",
  elsewhereAsk: "also where else are you online?",
  linksReply: "you can find me here too.",
  thanks: "nice. i’ll connect.",
  goodbye: "always down to chat, swap ideas, or hear what you’re building.",
};

export type SocialIcon = TemplateContext["site"]["socialLinks"][number]["icon"];

export type Bubble =
  | { from: "me" | "them"; text: string }
  | { from: "them"; card: "email"; text: string; email: string }
  | { from: "them"; card: "form"; text: string }
  | {
      from: "them";
      card: "links";
      text: string;
      links: { label: string; href: string; icon: SocialIcon }[];
    };

export type BioSegment =
  | { text: string }
  | { brand: { name: string; icon: string; href: string | null; preview: Preview | null } };

export type FanCard = { src: string; alt: string; word: number; upright: boolean };

const imagesOf = (project: TemplateContext["projects"][number]) =>
  project.media.kind === "image"
    ? [project.media.image]
    : project.media.kind === "carousel"
      ? project.media.images
      : project.media.screens;

function ratioOf(src: string): number | null {
  try {
    const { width, height } = mediaDimensions(src);
    return width / height;
  } catch {
    return null;
  }
}

const previewOf = (src: string | undefined): Preview | null => {
  if (!src) return null;
  const ratio = ratioOf(src);
  return ratio ? { src, ratio } : null;
};

/** The earliest four-digit year in the timeline, for "EST. 2022". */
function earliestYear(timeline: TemplateContext["biography"]["timeline"]) {
  const years = timeline
    .map((item) => Number(item.year.match(/\d{4}/)?.[0]))
    .filter((year) => Number.isFinite(year) && year > 0);
  return years.length ? String(Math.min(...years)) : null;
}

export function stackLabels(context: TemplateContext): StackLabels {
  const options = context.options as StackOptions;
  return { ...DEFAULT_LABELS, ...options.labels };
}

export function buildStack(context: TemplateContext, posts: readonly BlogPostSummary[]) {
  const options = context.options as StackOptions;
  const labels = stackLabels(context);
  const chatCopy = { ...DEFAULT_CHAT, ...options.chat };
  const { identity, contact, socialLinks, location } = context.site;
  const locale = identity.locale;
  const about = context.features.about;
  const projects = context.features.work
    ? context.projects.filter((project) => project.enabled)
    : [];

  // hero: the first portrait is the avatar, the next ones (up to four) are tucked behind it
  const [avatar, ...rest] = context.introduction.portraits;
  const photos = rest.slice(0, 4);

  const projectLink = (id: string | undefined) => {
    const project = id ? projects.find((item) => item.id === id) : undefined;
    const action = project?.actions?.[0];
    return {
      href: action?.href ?? null,
      preview: project ? previewOf(imagesOf(project)[0]?.src) : null,
    };
  };
  const bio: BioSegment[] = context.introduction.summary.map((part) =>
    "text" in part
      ? { text: part.text }
      : { brand: { name: part.brand.name, icon: part.brand.icon, ...projectLink(part.brand.project) } },
  );

  // experience, newest first as in the original
  const timeline = about ? [...context.biography.timeline] : [];
  const first = Number(timeline[0]?.year.match(/\d{4}/)?.[0]);
  const last = Number(timeline.at(-1)?.year.match(/\d{4}/)?.[0]);
  if (first < last) timeline.reverse();
  const experience = timeline.map((item) => ({
    when: item.current ? `${item.year} — ${labels.now}` : item.year,
    title: item.title,
    text: item.desc,
  }));
  const story = about ? context.biography.story.filter((paragraph) => paragraph.length) : [];

  // the fan: the projects' pictures, dealt in turn (front card first) into the seven places
  const words = projects.map((project) => project.name);
  const pools = projects.map((project) => [...imagesOf(project)]);
  const fan: FanCard[] = [];
  for (let round = 0; fan.length < 7 && pools.some((pool) => pool.length > round); round++)
    pools.forEach((pool, word) => {
      const image = pool[round];
      if (image && fan.length < 7) {
        const ratio = ratioOf(image.src);
        fan.push({ src: image.src, alt: image.alt, word, upright: ratio !== null && ratio < 1 });
      }
    });

  // the shuffle stack: the projects' landscape pictures (story pictures first)
  const shuffleSources = [
    ...projects.flatMap((project) =>
      project.story ? [{ src: project.story.image, alt: project.story.imageAlt, label: project.name }] : [],
    ),
    ...projects.flatMap((project) => imagesOf(project).map((image) => ({ ...image, label: project.name }))),
  ];
  const seen = new Set<string>();
  const shuffle =
    options.shuffle === false
      ? []
      : shuffleSources
          .filter((image) => {
            const ratio = ratioOf(image.src);
            if (!ratio || ratio < 1.2 || seen.has(image.src)) return false;
            seen.add(image.src);
            return true;
          })
          .slice(0, 6)
          .map((image) => ({ kind: "image" as const, src: image.src, label: image.alt || image.label }));

  const ventures = projects.map((project) => {
    const action = project.actions?.[0];
    return {
      id: project.id,
      name: project.name,
      sub: project.description,
      icon: project.icon ?? null,
      href: action?.href ?? null,
      newTab: action?.newTab,
      preview: previewOf(imagesOf(project)[0]?.src),
    };
  });

  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });
  const writing = posts.map((post) => ({
    id: post.slug,
    date: dateFormat.format(new Date(`${post.date.slice(0, 10)}T00:00:00Z`)),
    title: post.title,
    href: post.href,
    mins: `${post.readingMinutes} ${labels.minutes}`,
  }));

  const instagram = socialLinks.find((link) => link.icon === "instagram");
  const personal =
    context.features.photography && context.photography.images.length
      ? {
          text: context.photography.intro,
          photos: context.photography.images.slice(0, 4),
          camera: options.camera ?? null,
          more: instagram ? { href: instagram.href, label: labels.seeMore } : null,
        }
      : null;

  // the conversation: e-mail first, then the form (into the same inbox), then the other links
  const email = contact?.email.trim() ?? "";
  const others = socialLinks
    .filter((link) => link.icon !== "email")
    .map((link) => ({ label: link.label, href: link.href, icon: link.icon }));
  const chat: Bubble[][] = [];
  if (email) {
    chat.push(
      [{ from: "me", text: chatCopy.greeting }],
      [
        { from: "them", text: chatCopy.emailReply },
        { from: "them", card: "email", text: email, email },
      ],
      [{ from: "me", text: chatCopy.messageAsk }],
      [{ from: "them", card: "form", text: chatCopy.formReply }],
    );
  }
  if (others.length) {
    chat.push(
      [{ from: "me", text: chatCopy.elsewhereAsk }],
      [{ from: "them", card: "links", text: chatCopy.linksReply, links: others }],
    );
  }
  if (chat.length) chat.push([{ from: "me", text: chatCopy.thanks }], [{ from: "them", text: chatCopy.goodbye }]);

  // The option wins; otherwise the profile's own closing quote, if it has one.
  const quote = options.ending?.quote
    ? options.ending
    : context.closingQuote.quote
      ? { quote: context.closingQuote.quote, author: context.closingQuote.author || undefined }
      : null;
  const ending = quote
    ? { note: labels.endingNote, quote: quote.quote, author: quote.author ?? null }
    : null;

  const est = options.established ?? earliestYear(context.biography.timeline);
  const nav = [
    { label: labels.navAbout, target: "about" },
    ...(experience.length || fan.length || ventures.length ? [{ label: labels.navWork, target: "work" }] : []),
    ...(writing.length ? [{ label: labels.navThoughts, target: "thoughts" }] : []),
    ...(chat.length ? [{ label: labels.navContact, target: "contact" }] : []),
  ];

  return {
    labels,
    locale,
    est: est ? `${labels.est} ${est}` : null,
    nav,
    name: identity.name,
    role: identity.role,
    avatar: avatar ?? null,
    photos,
    bio,
    story,
    experience,
    words,
    fan,
    shuffle: shuffle.length >= 2 ? shuffle : [],
    tools: options.tools ?? [],
    ventures,
    writing,
    personal,
    // Off unless the author asks: the pocket presents its art as the author's own work.
    art: options.art === true,
    pocketLabel: options.pocketLabel,
    chat,
    email,
    ending,
    footer: { name: identity.name, avatar: avatar ?? null, timeZone: location.timeZone },
  };
}

export type StackData = ReturnType<typeof buildStack>;
