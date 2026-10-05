import "server-only";
import { siteConfig } from "@/config/site";
import { resolvePublishedRoutes } from "@/portfolio/publication-policy.mjs";
import { markdownPosts } from "./posts.generated";
import { customBlogPosts } from "./custom-posts.generated";
import type { BlogPostSummary, CustomBlogPost, MarkdownBlogPost } from "./types";

export function getMarkdownBlogPosts(): MarkdownBlogPost[] {
  return markdownPosts;
}

export function getMarkdownBlogPost(slug: string): MarkdownBlogPost | undefined {
  return getMarkdownBlogPosts().find((post) => post.slug === slug);
}

/**
 * The content build already writes only published custom posts. Filtering by
 * the route policy here as well keeps the feature flag authoritative when the
 * generated index and the profile disagree, as in the QA profile sandbox,
 * without importing the Markdown build pipeline into every blog route.
 */
export function getPublishedCustomBlogPosts(): CustomBlogPost[] {
  const routes = new Set(
    resolvePublishedRoutes({
      demoRoutesEnabled: siteConfig.features.demoRoutes,
    }),
  );
  return customBlogPosts.filter((post) => routes.has(post.href));
}

export function getCustomBlogPost(slug: string): CustomBlogPost | undefined {
  return getPublishedCustomBlogPosts().find((post) => post.slug === slug);
}

export function getBlogIndexPosts(): BlogPostSummary[] {
  return [...getMarkdownBlogPosts(), ...getPublishedCustomBlogPosts()].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

export { formatBlogDate } from "./format";
export type { BlogPostSummary, CustomBlogPost, MarkdownBlogPost } from "./types";
