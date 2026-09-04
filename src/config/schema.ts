export type AbsoluteHttpUrl = `http://${string}` | `https://${string}`;
export type InternalPath = `/${string}`;
export type HashPath = `#${string}`;
export type EmailAddress = `${string}@${string}.${string}`;
export type HexColor = `#${string}`;
export type LocaleCode = `${string}-${string}`;
export type TimeZoneId = `${string}/${string}`;
export type TwitterHandle = `@${string}`;
export type SocialIconName =
  | "twitter"
  | "linkedin"
  | "instagram"
  | "github"
  | "email"
  | "website";

export type NavigationItem = {
  label: string;
  href: InternalPath | HashPath;
  sectionId: string | null;
  newTab?: boolean;
};

export type SocialLink = {
  label: string;
  icon: SocialIconName;
  href: AbsoluteHttpUrl | `mailto:${string}`;
  brand: HexColor;
};

export type SiteConfig = {
  identity: {
    name: string;
    firstName: string;
    initials: string;
    role: string;
    company: string;
    country: string;
    locale: LocaleCode;
  };
  origin: AbsoluteHttpUrl;
  themeColor: HexColor;
  copyrightYear: number;
  contact: {
    email: EmailAddress;
    helloSubject: string;
    hiSubject: string;
  };
  social: {
    twitterHandle: TwitterHandle;
  };
  socialLinks: readonly SocialLink[];
  navigation: readonly NavigationItem[];
  location: {
    city: string;
    country: string;
    timeZone: TimeZoneId;
    timeZoneLabel: string;
    latitude: number;
    longitude: number;
  };
  resume: {
    enabled: boolean;
    image: InternalPath;
    pdf: InternalPath;
    downloadName: `${string}.pdf`;
  };
  features: {
    weather: boolean;
    about: boolean;
    work: boolean;
    photography: boolean;
    resume: boolean;
    demoRoutes: boolean;
  };
  assets: {
    socialPreview: InternalPath;
    appStoreBadge: InternalPath;
  };
};

export type AppStoreLinks =
  | AbsoluteHttpUrl
  | {
      portfolio: AbsoluteHttpUrl;
      product: AbsoluteHttpUrl;
    };

export type ProductDefinition = {
  name: string;
  route?: InternalPath;
  storyRoute?: InternalPath;
  privacyRoute?: InternalPath;
  icon?: InternalPath;
  appStore?: AppStoreLinks;
  store?: AbsoluteHttpUrl;
  press?: AbsoluteHttpUrl;
  supportEmail?: EmailAddress;
  award?: string;
};
