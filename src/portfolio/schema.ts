export type PortfolioSocialIcon =
  | "twitter"
  | "linkedin"
  | "instagram"
  | "github"
  | "email"
  | "website";

export type PortfolioRichTextSegment =
  | { text: string }
  | { brand: { name: string; icon: string } };

export type PortfolioProjectAction = {
  label: string;
  href: string;
  icon?: "arrow" | "book";
  tone?: "default" | "accent";
};

export type PortfolioProjectBadge = {
  text: string;
  tone: "gold" | "blue";
  href?: string;
  previewImage?: string;
  previewMaxWidth?: number;
};

export type PortfolioProjectImage = {
  desktop: string;
  mobile: string;
  alt: string;
  desktopSize?: [number, number];
  mobileSize?: [number, number];
};

export type PortfolioProjectStory = {
  title: string;
  image: string;
  imageAlt: string;
  imageSize?: [number, number];
  body: string;
};

export type PortfolioProject = {
  id: string;
  enabled: boolean;
  layout: "standard" | "featured" | "story" | "carousel";
  featuredOnMobile?: boolean;
  name: string;
  date: string;
  description: string;
  icon?: string;
  image?: PortfolioProjectImage;
  carouselImages?: readonly string[];
  badge?: PortfolioProjectBadge;
  actions?: readonly PortfolioProjectAction[];
  story?: PortfolioProjectStory;
};

export type PortfolioStorySegment = {
  tone: "muted" | "strong" | "highlight";
  text: string;
};

export type PortfolioConfig = {
  site: {
    identity: {
      name: string;
      firstName: string;
      initials: string;
      role: string;
      company: string;
      country: string;
      locale: string;
    };
    origin: string;
    themeColor: string;
    copyrightYear: number;
    contact: {
      email: string;
      helloSubject: string;
      hiSubject: string;
    };
    twitterHandle: string;
    socialLinks: readonly {
      label: string;
      icon: PortfolioSocialIcon;
      href: string;
      brand: string;
    }[];
    navigation: readonly {
      label: string;
      href: string;
      sectionId: string | null;
      newTab?: boolean;
    }[];
    location: {
      city: string;
      country: string;
      timeZone: string;
      timeZoneLabel: string;
      latitude: number;
      longitude: number;
    };
    resume: {
      enabled: boolean;
      image: string;
      pdf: string;
      downloadName: string;
    };
    assets: {
      socialPreview: string;
      appStoreBadge: string;
    };
  };
  features: {
    weather: boolean;
    about: boolean;
    work: boolean;
    photography: boolean;
    resume: boolean;
    demoRoutes: boolean;
  };
  hero: {
    greetings: readonly string[];
    portraits: readonly string[];
    roleLine: readonly PortfolioRichTextSegment[];
    summary: readonly PortfolioRichTextSegment[];
  };
  about: {
    timeline: readonly {
      year: string;
      title: string;
      desc: string;
    }[];
    story: readonly (readonly PortfolioStorySegment[])[];
    galleryImages: readonly string[];
  };
  projects: readonly PortfolioProject[];
  photography: {
    intro: string;
    images: readonly string[];
  };
  footerBook: {
    title: string;
    quote: string;
    author: string;
  };
  seo: {
    description: string;
    keywords: readonly string[];
    knowsAbout: readonly string[];
    award?: string;
    caseStudiesDescription: string;
  };
};
