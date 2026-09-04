import type { InternalPath } from "@/config/schema";
import type { PortfolioRichTextSegment } from "@/portfolio/schema";

export type HomeContent = {
  greetings: readonly string[];
  footerBook: {
    title: string;
    quote: string;
    author: string;
  };
  hero: {
    roleLine: readonly PortfolioRichTextSegment[];
    summary: readonly PortfolioRichTextSegment[];
  };
  photographyIntro: string;
};

export type AboutTimelineItem = {
  year: string;
  title: string;
  desc: string;
};

export type WorkItem = {
  name: string;
  date: string;
  description: string;
  icon?: InternalPath;
} &
  (
    | { desktopImage: InternalPath; mobileImage: InternalPath }
    | { desktopImage?: never; mobileImage?: never }
  );

export type MediaList = readonly InternalPath[];
