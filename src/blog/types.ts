export type BlogPostSummary = {
  slug: string;
  href: string;
  title: string;
  subtitle?: string;
  date: string;
  displayDate?: string;
  description: string;
  excerpt?: string;
  intro?: string;
  cover?: string;
  tags: readonly string[];
  readingMinutes: number;
  kind: "markdown" | "custom";
};

/** A section or subsection heading and the anchor it is reachable at. */
export type BlogHeading = { depth: 2 | 3; text: string; id: string };

export type MarkdownBlogPost = BlogPostSummary & {
  kind: "markdown";
  content: string;
  headings: readonly BlogHeading[];
};

export type CustomBlogPost = BlogPostSummary & {
  kind: "custom";
};
