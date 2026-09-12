import type { Metadata } from "next";
import { siteConfig } from "./site";
import { blogContent, portfolioSeo } from "@/portfolio";

const { identity, origin, socialLinks, assets } = siteConfig;

const rootDescription = portfolioSeo.description;
const rootKeywords = portfolioSeo.keywords;
const rootTitle = `${identity.name} | ${identity.role} in ${identity.country}${
  identity.company ? ` | ${identity.company}` : ""
}`;
const openGraphLocale = identity.locale.replaceAll("-", "_");

export const rootMetadata: Metadata = {
  metadataBase: new URL(origin),
  title: rootTitle,
  description: rootDescription,
  keywords: [...rootKeywords],
  authors: [{ name: identity.name }],
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: assets.icon }],
    apple: assets.appleTouchIcon,
  },
  openGraph: {
    type: "website",
    url: origin,
    title: rootTitle,
    description: rootDescription,
    siteName: `${identity.name} Portfolio`,
    locale: openGraphLocale,
    images: [
      {
        url: assets.socialPreview,
        alt: `${identity.name} - ${identity.role} in ${identity.country}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    ...(siteConfig.social.twitterHandle
      ? { creator: siteConfig.social.twitterHandle, site: siteConfig.social.twitterHandle }
      : {}),
    title: rootTitle,
    description: rootDescription,
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
  ...(identity.company
    ? { worksFor: { "@type": "Organization", name: identity.company } }
    : {}),
  url: origin,
  sameAs: socialLinks
    .filter(({ href }) => href.startsWith("http://") || href.startsWith("https://"))
    .map(({ href }) => href),
  description: rootDescription,
  knowsAbout: [...portfolioSeo.knowsAbout],
  ...(portfolioSeo.award ? { award: portfolioSeo.award } : {}),
};

type RouteMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  icons?: Metadata["icons"];
};

export function createRouteMetadata({
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

export const blogMetadata = createRouteMetadata({
  title: `${blogContent.title} | ${identity.name}`,
  description: blogContent.description,
  path: "/blogs",
});
