export type BlogPostSummary = {
  slug: string;
  href: string;
  title: string;
  subtitle?: string;
  date: string;
  description: string;
  excerpt?: string;
  intro?: string;
  cover?: string;
  tags: readonly string[];
  readingMinutes: number;
  kind: "markdown" | "custom";
};

export type MarkdownBlogPost = BlogPostSummary & {
  kind: "markdown";
  content: string;
};

export type CustomBlogPost = BlogPostSummary & {
  kind: "custom";
};
