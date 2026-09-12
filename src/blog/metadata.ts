import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import type { BlogPostSummary } from "./types";

export function createBlogMetadata(post: BlogPostSummary): Metadata {
  const title = `${post.title}${post.subtitle ? ` ${post.subtitle}` : ""} | ${siteConfig.identity.name}`;
  const image = post.cover ?? siteConfig.assets.socialPreview;
  return {
    title,
    description: post.description,
    alternates: { canonical: post.href },
    openGraph: {
      type: "article",
      url: post.href,
      title,
      description: post.description,
      publishedTime: `${post.date}T00:00:00.000Z`,
      tags: [...post.tags],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: post.description,
      images: [image],
    },
  };
}
