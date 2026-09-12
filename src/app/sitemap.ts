import type { MetadataRoute } from "next";
import { getBlogIndexPosts } from "@/blog";
import { siteConfig } from "@/config/site";
import { resolvePublishedRoutes } from "@/portfolio/publication-policy.mjs";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getBlogIndexPosts();
  return resolvePublishedRoutes({
    demoRoutesEnabled: siteConfig.features.demoRoutes,
    blogRoutes: posts.map((post) => post.href),
  }).map((route) => ({
    url: `${siteConfig.origin}${route === "/" ? "" : route}`,
    changeFrequency: route.includes("privacy") ? "yearly" : "monthly",
    priority: route === "/" ? 1 : route.includes("privacy") ? 0.2 : 0.7,
    ...(posts.find((post) => post.href === route)?.date
      ? { lastModified: posts.find((post) => post.href === route)!.date } : {}),
  }));
}
