import type { MetadataRoute } from "next";
import { getBlogIndexPosts, getBlogTags } from "@/blog";
import { siteConfig } from "@/config/site";
import { resolvePublishedRoutes } from "@/portfolio/publication-policy.mjs";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getBlogIndexPosts();
  const tags = getBlogTags();
  // A post changes on its date; a tag page changes with its newest post.
  const modified = new Map([
    ...posts.map((post) => [post.href, post.date] as const),
    ...tags.map((tag) => [tag.href, tag.posts[0].date] as const),
  ]);
  return resolvePublishedRoutes({
    demoRoutesEnabled: siteConfig.features.demoRoutes,
    blogRoutes: [...modified.keys()],
  }).map((route) => ({
    // Tag slugs may be written in any script.
    url: `${siteConfig.origin}${route === "/" ? "" : encodeURI(route)}`,
    changeFrequency: route.includes("privacy") ? "yearly" : "monthly",
    priority: route === "/" ? 1 : route.includes("privacy") ? 0.2 : 0.7,
    ...(modified.has(route) ? { lastModified: modified.get(route) } : {}),
  }));
}
