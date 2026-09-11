import fs from "node:fs";
import path from "node:path";
import { loadQaProfile } from "./profile.mjs";
import { fileURLToPath } from "node:url";
import {
  loadMarkdownBlogPosts,
  normalizeCustomBlogPosts,
  publishedCustomBlogPosts,
  publishedMarkdownBlogPosts,
} from "../src/blog/content-core.mjs";
import {
  resolveDisabledDemoRoutes,
  resolvePublishedRoutes,
} from "../src/portfolio/publication-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blogsDir = path.join(root, "content", "blogs");
const customPostsPath = path.join(root, "src", "blog", "custom-posts.json");

function loadBlogRoutes() {
  const portfolio = loadQaProfile();
  const customPosts = normalizeCustomBlogPosts(
    JSON.parse(fs.readFileSync(customPostsPath, "utf8")),
  );
  const markdown = publishedMarkdownBlogPosts(
    loadMarkdownBlogPosts({
      blogsDir,
      reservedSlugs: customPosts.map((post) => post.slug),
    }).posts,
  );
  const custom = publishedCustomBlogPosts(
    customPosts,
    portfolio.features?.demoRoutes !== false,
  );
  return {
    markdown: markdown.map((post) => post.href).sort(),
    custom: custom.map((post) => post.href).sort(),
  };
}

export async function markdownBlogRoutes() {
  return loadBlogRoutes().markdown;
}

export async function publishedBlogRoutes() {
  const { markdown, custom } = loadBlogRoutes();
  return [...new Set([...markdown, ...custom])].sort();
}

export async function publicationRoutes() {
  const portfolio = loadQaProfile();
  const blogRoutes = await publishedBlogRoutes();
  return resolvePublishedRoutes({
    demoRoutesEnabled: portfolio.features?.demoRoutes === true,
    blogRoutes,
  });
}

export async function disabledDemoRoutes() {
  const portfolio = loadQaProfile();
  const blogRoutes = await publishedBlogRoutes();
  return resolveDisabledDemoRoutes({
    demoRoutesEnabled: portfolio.features?.demoRoutes === true,
    blogRoutes,
  });
}
