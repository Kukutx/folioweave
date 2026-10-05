import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBlogTag, getBlogTags } from "@/blog";
import { BlogCardList } from "@/components/blog/blog-card-list";
import { BlogTags } from "@/components/blog/blog-tags";
import { createRouteMetadata } from "@/config/seo";
import { siteConfig, siteCopyright } from "@/config/site";
import { blogContent } from "@/portfolio";
import "@/styles/blogs.css";

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

const postCount = (count: number) => `${count} ${count === 1 ? "post" : "posts"}`;

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
    <div className="writing-container">
      <header className="writing-header blog-tag-header">
        <Link href="/blogs" className="back-link">
          <ArrowLeft size={18} /> All posts
        </Link>
        <h1 className="writing-title">{tag.label}</h1>
        <p className="writing-subtitle">{postCount(tag.posts.length)} tagged</p>
        <BlogTags
          tags={getBlogTags().map((item) => item.label)}
          current={tag.label}
          className="blog-tag-browser"
          label="All tags"
        />
      </header>
      <main className="writing-list-container">
        <BlogCardList posts={tag.posts} />
      </main>
      <footer className="writing-footer">
        <p>{siteCopyright}</p>
      </footer>
    </div>
  );
}
