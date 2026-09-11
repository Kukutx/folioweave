import "server-only";
import { markdownPosts } from "./posts.generated";
import { siteConfig } from "@/config/site";
import { customBlogPosts } from "./custom-posts";
import {
  publishedCustomBlogPosts as resolvePublishedCustomBlogPosts,
} from "./content-core.mjs";
import type { BlogPostSummary, CustomBlogPost, MarkdownBlogPost } from "./types";

export function getMarkdownBlogPosts(): MarkdownBlogPost[] {
  return markdownPosts;
}

export function getMarkdownBlogPost(slug: string): MarkdownBlogPost | undefined {
  return getMarkdownBlogPosts().find((post) => post.slug === slug);
}

export function getPublishedCustomBlogPosts(): CustomBlogPost[] {
  return resolvePublishedCustomBlogPosts(
    customBlogPosts,
    siteConfig.features.demoRoutes,
  ) as CustomBlogPost[];
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
