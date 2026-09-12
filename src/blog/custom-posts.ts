import rawCustomBlogPosts from "./custom-posts.json";
import { normalizeCustomBlogPosts } from "./content-core.mjs";
import type { CustomBlogPost } from "./types";

export const customBlogPosts = normalizeCustomBlogPosts(
  rawCustomBlogPosts,
) as readonly CustomBlogPost[];
