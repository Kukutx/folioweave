import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/config/seo";
import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries.map(({ path, changeFrequency, priority }) => ({
    url: `${siteConfig.origin}${path}`,
    changeFrequency,
    priority,
  }));
}
