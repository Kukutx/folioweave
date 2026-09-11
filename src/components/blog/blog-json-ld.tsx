import { siteConfig } from "@/config/site";
import { serializeJsonLd } from "@/lib/json-ld";
import type { BlogPostSummary } from "@/blog";

export function BlogPostingJsonLd({ post }: { post: BlogPostSummary }) {
  const url = `${siteConfig.origin}${post.href}`;
  const image = post.cover ? `${siteConfig.origin}${post.cover}` : undefined;
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: `${post.date}T00:00:00.000Z`,
    author: {
      "@type": "Person",
      name: siteConfig.identity.name,
      url: siteConfig.origin,
    },
    mainEntityOfPage: url,
    url,
    ...(image ? { image } : {}),
    ...(post.tags.length ? { keywords: [...post.tags] } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
