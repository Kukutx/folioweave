import type { EmailAddress, SiteConfig } from "./schema";

const primaryEmail: EmailAddress = "oletigowtham8803@gmail.com";

export const siteConfig = {
  identity: {
    name: "Gowtham Oleti",
    firstName: "Gowtham",
    initials: "OG",
    role: "Product Designer",
    company: "CRED",
    country: "India",
    locale: "en-IN",
  },
  origin: "https://gowthamoleti.com",
  themeColor: "#ffffff",
  copyrightYear: 2026,
  contact: {
    email: primaryEmail,
    helloSubject: "Hello Gowtham!",
    hiSubject: "Hi Gowtham",
  },
  social: { twitterHandle: "@gow88_" },
  socialLinks: [
    { label: "Twitter", href: "https://x.com/gow88_", brand: "#000000" },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/gowthamoleti/",
      brand: "#0A66C2",
    },
    {
      label: "Instagram",
      href: "https://www.instagram.com/gowthamoleti",
      brand: "#E1306C",
    },
    {
      label: "Email",
      href: `mailto:${primaryEmail}`,
      brand: "#EA4335",
    },
  ],
  navigation: [
    { label: "About", href: "#about", sectionId: "about" },
    { label: "Work", href: "#work", sectionId: "work" },
    {
      label: "Photography",
      href: "#photography",
      sectionId: "photography",
    },
    { label: "Blogs", href: "/blogs", sectionId: null, newTab: true },
  ],
  location: {
    city: "Bengaluru",
    country: "India",
    timeZone: "Asia/Kolkata",
    timeZoneLabel: "IST",
    latitude: 12.9716,
    longitude: 77.5946,
  },
  resume: {
    image: "/gowtham-oleti-resume.jpg",
    pdf: "/gowtham-oleti-resume.pdf",
    downloadName: "Gowtham-Oleti-Resume.pdf",
  },
  assets: {
    socialPreview: "/ogportfolio-logo.webp",
    appStoreBadge: "/assets/app-store-badge.svg",
  },
} as const satisfies SiteConfig;

export const siteCopyright = `© ${siteConfig.copyrightYear} ${siteConfig.identity.name}. All rights reserved.`;

export type SiteNavigationItem = (typeof siteConfig.navigation)[number];
export type SiteSocialLink = (typeof siteConfig.socialLinks)[number];

export function mailto(email: EmailAddress, subject?: string) {
  return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}
