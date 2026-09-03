import type { Metadata, MetadataRoute } from "next";
import { products } from "./products";
import { siteConfig } from "./site";

const { identity, origin, socialLinks, assets } = siteConfig;

const rootDescription =
  `${identity.name} - ${identity.role} in ${identity.country}. ${identity.role} at ${identity.company}, creating simple, user-centric digital experiences across fintech and consumer products. Designer portfolio showcasing UX/UI design work and case studies.`;

const rootKeywords = [
  identity.name,
  identity.firstName,
  "best product designer in india",
  "best designer",
  "best designer in india",
  "product designer india",
  "UX designer india",
  "UI designer india",
  "best UX designer",
  "best UI designer",
  "top product designer",
  "award winning designer",
  "CRED",
  "CRED designer",
  "fintech designer",
  "product design portfolio",
  "UX design portfolio",
  "UI design portfolio",
  "digital product designer",
  "user experience designer",
  "interface designer",
  "mobile app designer",
  "web designer india",
  "design portfolio",
  "product designer portfolio",
  "best design portfolio",
  "designer portfolio india",
  "creative designer",
  "design expert",
  "product design expert",
  "UX expert",
  "UI expert",
  "design consultant",
  "product design consultant",
  "user centered design",
  "human centered design",
  "design thinking",
  "design systems",
  "design strategy",
  "interaction design",
  "visual design",
  "information architecture",
  "usability",
  "accessibility design",
  "responsive design",
  "mobile design",
  "web design",
  "app design",
  "digital design",
  "design innovation",
  "design leadership",
  "design awards",
  "Google Play Best App",
  "product design case study",
  "UX case study",
  "design process",
  "design methodology",
] as const;

export const rootMetadata: Metadata = {
  metadataBase: new URL(origin),
  title: `${identity.name} | ${identity.role} in ${identity.country} | ${identity.company}`,
  description: rootDescription,
  keywords: [...rootKeywords],
  authors: [{ name: identity.name }],
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    url: origin,
    title: `${identity.name} | ${identity.role} in ${identity.country} | ${identity.company}`,
    description:
      `${identity.name} - ${identity.role} in ${identity.country}. ${identity.role} at ${identity.company}, creating simple, user-centric digital experiences across fintech and consumer products.`,
    siteName: `${identity.name} Portfolio`,
    locale: "en_IN",
    images: [
      {
        url: assets.socialPreview,
        width: 1200,
        height: 630,
        alt: `${identity.name} - ${identity.role} in ${identity.country}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    creator: siteConfig.social.twitterHandle,
    site: siteConfig.social.twitterHandle,
    title: `${identity.name} | ${identity.role} in ${identity.country} | ${identity.company}`,
    description:
      `${identity.name} - ${identity.role} in ${identity.country}. ${identity.role} at ${identity.company}, creating simple, user-centric digital experiences.`,
    images: [assets.socialPreview],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: identity.name,
  alternateName: identity.firstName,
  jobTitle: identity.role,
  worksFor: { "@type": "Organization", name: identity.company },
  url: origin,
  sameAs: socialLinks
    .filter(({ label }) => label === "Twitter" || label === "LinkedIn")
    .map(({ href }) => href),
  description:
    `${identity.role} in ${identity.country}. ${identity.role} at ${identity.company}, creating simple, user-centric digital experiences across fintech and consumer products.`,
  knowsAbout: [
    "Product Design",
    "User Experience Design",
    "User Interface Design",
    "Digital Product Design",
    "Mobile App Design",
    "Web Design",
    "Design Systems",
    "User Research",
    "Design Strategy",
  ],
  award: products.district.award,
  nationality: { "@type": "Country", name: identity.country },
};

type RouteMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  icons?: Metadata["icons"];
};

function createRouteMetadata({
  title,
  description,
  path,
  image,
  icons,
}: RouteMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(icons ? { icons } : {}),
    ...(image
      ? {
          openGraph: { images: [image] },
          twitter: { card: "summary_large_image", images: [image] },
        }
      : {}),
  };
}

export const routeMetadata = {
  blogs: createRouteMetadata({
    title: `Blogs | ${identity.name}`,
    description: "Thoughts on design, code, and building products.",
    path: "/blogs",
  }),
  cliptBlog: createRouteMetadata({
    title:
      `Clipt: How I built a clipboard history app and keyboard for iOS.(It's complex than you think) | ${identity.name}`,
    description:
      "My journey building Clipt, an iOS clipboard manager with a focus on native feel and performance.",
    path: products.clipt.storyRoute,
    image: "/media/5c0589_42a00ff8590c4ff5b1cf8496183b08b8~mv2.webp",
  }),
  brink: createRouteMetadata({
    title: "Brink — Podcasts in a calmer flow",
    description:
      "Brink helps you discover, organize, and enjoy podcasts with a focused listening experience.",
    path: products.brink.route,
  }),
  brinkPrivacy: createRouteMetadata({
    title: "Brink — Privacy Policy",
    description: "Privacy policy for Brink.",
    path: products.brink.privacyRoute,
  }),
  caseStudies: createRouteMetadata({
    title: `Case Studies | ${identity.name} - ${identity.role} in ${identity.country}`,
    description:
      `Product design case studies by ${identity.name}, product designer in ${identity.country}. Explore UX/UI design projects including District by Zomato, facilitating over 75 million ticket sales. Award-winning design portfolio.`,
    path: "/case-studies",
  }),
  clipt: createRouteMetadata({
    title: "Clipt - Advanced Clipboard Manager",
    description:
      "A simple, polished clipboard manager synced across your Apple devices.",
    path: products.clipt.route,
    icons: {
      icon: products.clipt.icon,
      apple: products.clipt.icon,
    },
  }),
  cliptPrivacy: createRouteMetadata({
    title: "Privacy Policy | Clipt App",
    description:
      "Privacy Policy for Clipt app. Learn about how we handle your data.",
    path: products.clipt.privacyRoute,
  }),
  district: createRouteMetadata({
    title: `OG x District | ${identity.name} - ${identity.role} in ${identity.country}`,
    description:
      `District by Zomato case study by ${identity.name}, product designer in ${identity.country}. Designing for the Movies vertical facilitating over 75 million ticket sales. Award-winning design work for ${products.district.award}.`,
    path: products.district.route,
  }),
  flipfactPrivacy: createRouteMetadata({
    title: "Privacy Policy (FlipFact / Bulb)",
    description:
      "Privacy Policy for FlipFact (Bulb). Learn what data is collected and how it is used.",
    path: "/flipfact",
  }),
  habeePrivacy: createRouteMetadata({
    title: "Privacy Policy | Habee App",
    description:
      "Privacy Policy for Habee app. Learn how we collect and use analytics data to improve the app experience.",
    path: products.habee.privacyRoute,
  }),
  notchShelfPrivacy: createRouteMetadata({
    title: "Privacy Policy | NotchShelf App",
    description:
      "Privacy Policy for NotchShelf app. Learn how we collect and use analytics data to improve the app experience.",
    path: products.notchShelf.privacyRoute,
  }),
} satisfies Record<string, Metadata>;

export const sitemapEntries = [
  { path: "", changeFrequency: "monthly", priority: 1 },
  { path: "/case-studies", changeFrequency: "monthly", priority: 0.8 },
  { path: "/district", changeFrequency: "monthly", priority: 0.9 },
  { path: "/clipt", changeFrequency: "monthly", priority: 0.8 },
  { path: "/blogs", changeFrequency: "monthly", priority: 0.8 },
  { path: "/blogs/clipt", changeFrequency: "monthly", priority: 0.8 },
  { path: "/brink", changeFrequency: "monthly", priority: 0.7 },
  { path: "/brink/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/clipt-privacypolicy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/flipfact", changeFrequency: "yearly", priority: 0.2 },
  { path: "/habee-privacypolicy", changeFrequency: "yearly", priority: 0.2 },
  {
    path: "/notchshelf-privacypolicy",
    changeFrequency: "yearly",
    priority: 0.2,
  },
] satisfies Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}>;

export const districtJsonLd = {
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  name: "District by Zomato - Case Study",
  creator: { "@type": "Person", name: identity.name },
  about: {
    "@type": "SoftwareApplication",
    name: "District by Zomato",
    applicationCategory: "Entertainment",
    operatingSystem: "Android, iOS",
  },
  award: products.district.award,
  description:
    "Product design case study for District by Zomato Movies vertical, facilitating over 75 million ticket sales.",
};
