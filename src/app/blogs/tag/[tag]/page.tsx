import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogTag, getBlogTags } from "@/blog";
import { createRouteMetadata } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { blogContent } from "@/portfolio";
import BlogTag from "@/portfolio/template-blog-tag.generated";
import { templateContext } from "@/core/template-context";

export const dynamicParams = false;

export function generateStaticParams() {
  return getBlogTags().map((tag) => ({ tag: tag.slug }));
}

/** A tag written in a non-Latin script may arrive percent-encoded. */
function findTag(segment: string) {
  try {
    return getBlogTag(decodeURIComponent(segment));
  } catch {
    return getBlogTag(segment);
  }
}

const postCount = (count: number) =>
  `${count} ${count === 1 ? "post" : "posts"}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const tag = findTag((await params).tag);
  if (!tag) return {};
  return createRouteMetadata({
    title: `${tag.label} | ${blogContent.title} | ${siteConfig.identity.name}`,
    description: `${postCount(tag.posts.length)} tagged ${tag.label}.`,
    path: tag.href,
  });
}

export default async function BlogTagRoute({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const tag = findTag((await params).tag);
  if (!tag) notFound();

  return (
    <BlogTag
      tag={{ ...tag, labels: getBlogTags().map((item) => item.label) }}
      context={templateContext}
    />
  );
}
