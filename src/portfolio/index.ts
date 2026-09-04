import rawPortfolio from "../../portfolio.json";
import type { EmailAddress, SiteConfig } from "@/config/schema";
import type { HomeContent, MediaList, WorkItem } from "@/content/schema";
import type {
  PortfolioConfig,
  PortfolioProject,
} from "./schema";

export const portfolio = rawPortfolio as unknown as PortfolioConfig;

const sourceSite = portfolio.site;

function twitterHandleFromSocialLinks() {
  const href = sourceSite.socialLinks.find((item) => item.icon === "twitter")?.href;
  if (!href) return "";
  try {
    const handle = new URL(href).pathname.split("/").filter(Boolean)[0];
    return handle ? `@${handle}` : "";
  } catch {
    return "";
  }
}

export const siteConfig = {
  identity: { ...sourceSite.identity, country: sourceSite.location.country },
  origin: sourceSite.origin,
  themeColor: sourceSite.themeColor,
  copyrightYear: sourceSite.copyrightYear,
  contact: sourceSite.contact,
  social: { twitterHandle: twitterHandleFromSocialLinks() },
  socialLinks: sourceSite.socialLinks,
  navigation: sourceSite.navigation,
  location: sourceSite.location,
  resume: {
    ...sourceSite.resume,
    enabled: portfolio.features.resume,
  },
  assets: sourceSite.assets,
  features: portfolio.features,
} as unknown as SiteConfig;

export const siteCopyright = `© ${siteConfig.copyrightYear} ${siteConfig.identity.name}. All rights reserved.`;

export function mailto(email: EmailAddress, subject?: string) {
  return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}

export const homeContent = {
  greetings: portfolio.hero.greetings,
  footerBook: portfolio.footerBook,
  hero: {
    roleLine: portfolio.hero.roleLine,
    summary: portfolio.hero.summary,
  },
  photographyIntro: portfolio.photography.intro,
} as HomeContent;

export const aboutTimeline = portfolio.about.timeline;
export const aboutStory = portfolio.about.story;

export const portraitImages = portfolio.hero.portraits as MediaList;
export const storyGalleryImages = portfolio.about.galleryImages as MediaList;
export const photographyImages = portfolio.photography.images as MediaList;

export const workProjects = portfolio.projects.filter(
  (project): project is PortfolioProject => project.enabled,
);

export const workItems = Object.fromEntries(
  workProjects
    .filter((project) => project.image)
    .map((project) => [
      project.id,
      {
        name: project.name,
        date: project.date,
        description: project.description,
        ...(project.icon ? { icon: project.icon } : {}),
        ...(project.image
          ? {
              desktopImage: project.image.desktop,
              mobileImage: project.image.mobile,
            }
          : {}),
      },
    ]),
) as Record<string, WorkItem>;

export const notchShelfImages =
  workProjects.find((project) => project.id === "notchshelf")?.carouselImages ?? [];

export const portfolioSeo = portfolio.seo;

export type { PortfolioProject, PortfolioRichTextSegment } from "./schema";
