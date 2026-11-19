import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/** Built once from the profile, so static hosts can serve it as a file. */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${siteConfig.origin}/sitemap.xml`,
    host: siteConfig.origin,
  };
}
