import type { ProductDefinition } from "./schema";

export const products = {
  district: {
    name: "District by Zomato",
    route: "/district",
    icon: "/assets/district-icon-fad26ad7.png",
    award: "Best App of 2025 - Google Play",
  },
  brink: {
    name: "Brink",
    route: "/brink",
    privacyRoute: "/brink/privacy",
    icon: "/brink/logo.png",
    appStore: {
      portfolio:
        "https://apps.apple.com/in/app/brink-podcasts-and-news/id6760338948",
      product:
        "https://apps.apple.com/in/app/brink-podcast-player/id6760338948",
    },
    press:
      "https://9to5mac.com/2026/06/20/indie-app-spotlight-brink-brings-a-feature-rich-experience-to-iphone-podcast-listening/",
    supportEmail: "hello@gowtham.com",
  },
  clipt: {
    name: "Clipt",
    route: "/clipt",
    storyRoute: "/blogs/clipt",
    privacyRoute: "/clipt-privacypolicy",
    icon: "/media/5c0589_4015772c87e6491eb8881e3764409267~mv2.webp",
    appStore:
      "https://apps.apple.com/in/app/clipt-clipboard-history/id6758057628",
    supportEmail: "gowtham@notchshelf.app",
  },
  habee: {
    name: "Habee",
    privacyRoute: "/habee-privacypolicy",
    appStore:
      "https://apps.apple.com/in/app/habee-habit-tracker/id6757213438",
    supportEmail: "gowtham@habee.app",
  },
  ogWalls: {
    name: "OG Walls",
    store:
      "https://play.google.com/store/apps/details?id=com.ogwalls.app",
  },
  notchShelf: {
    name: "NotchShelf",
    privacyRoute: "/notchshelf-privacypolicy",
    icon: "/notchshelf-logo.webp",
    appStore: {
      portfolio:
        "https://apps.apple.com/in/app/notchshelf-folders-in-notch/id6757535797?mt=12",
      product:
        "https://apps.apple.com/in/app/notchshelf-utility-notch/id6757535797?mt=12",
    },
    supportEmail: "gowtham@notchshelf.app",
  },
} as const satisfies Record<string, ProductDefinition>;

export type ProductKey = keyof typeof products;
