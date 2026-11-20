import type { MetadataRoute } from "next";
import { getBlogIndexPosts, getBlogTags } from "@/blog";
import { siteConfig } from "@/config/site";
import { resolvePublishedRoutes } from "@/portfolio/publication-policy.mjs";
import { pluginPageLinks } from "@/portfolio/plugin-page-links.generated";
import { templatePages } from "@/portfolio/template-pages.generated";

/** Built once from the profile, so static hosts can serve it as a file. */
export const dynamic = "force-static";

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
    pluginRoutes: [
      ...pluginPageLinks
        .filter((link) => link.kind === "page")
        .map((page) => page.href),
      ...templatePages.map((page) => page.href),
    ],
  }).map((route) => ({
    // Tag slugs may be written in any script.
    url: `${siteConfig.origin}${route === "/" ? "" : encodeURI(route)}`,
    changeFrequency: route.includes("privacy") ? "yearly" : "monthly",
    priority: route === "/" ? 1 : route.includes("privacy") ? 0.2 : 0.7,
    ...(modified.has(route) ? { lastModified: modified.get(route) } : {}),
  }));
}
