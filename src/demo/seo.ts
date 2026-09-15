import type { Metadata } from "next";
import { createRouteMetadata } from "@/config/seo";
import { portfolioSeo } from "@/portfolio";
import { products } from "./products";

export const demoRouteMetadata = {
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
    title: "Case Studies | FolioWeave Demo",
    description: portfolioSeo.caseStudiesDescription,
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
    title: "District by Zomato | Example Case Study",
    description:
      "Example District by Zomato case-study route bundled with FolioWeave to demonstrate long-form product storytelling and project presentation.",
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

export const districtJsonLd = {
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  name: "District by Zomato - Example Case Study",
  about: {
    "@type": "SoftwareApplication",
    name: "District by Zomato",
    applicationCategory: "Entertainment",
    operatingSystem: "Android, iOS",
  },
  award: products.district.award,
  description:
    "Example case-study route bundled with FolioWeave to demonstrate product storytelling and project presentation.",
};
