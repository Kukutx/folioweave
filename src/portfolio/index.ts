import generatedPortfolio from "./config.generated";
import type {
  PortfolioConfig,
  PortfolioProject,
} from "./schema";

export const portfolio: PortfolioConfig = generatedPortfolio;

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
};

export const siteCopyright = `© ${siteConfig.copyrightYear} ${siteConfig.identity.name}. All rights reserved.`;

export function mailto(email: PortfolioConfig["site"]["contact"]["email"], subject?: string) {
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
};

export const aboutTimeline = portfolio.about.timeline;
export const aboutStory = portfolio.about.story;

export const portraitImages = portfolio.hero.portraits;
export const storyGalleryImages = portfolio.about.galleryImages;
export const photographyImages = portfolio.photography.images;

export const workProjects = portfolio.projects.filter(
  (project): project is PortfolioProject => project.enabled,
);

export const portfolioSeo = portfolio.seo;
export const blogContent = portfolio.blog;

export type { PortfolioProject, PortfolioRichTextSegment } from "./schema";
