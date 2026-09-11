import type { Metadata } from "next";
import { requirePublishedRoute } from "@/portfolio/route-guard";
import { notFound } from "next/navigation";
import { getCustomBlogPost } from "@/blog";
import { createBlogMetadata } from "@/blog/metadata";
import { BlogPostingJsonLd } from "@/components/blog/blog-json-ld";
import { CliptBlogPage } from "@/components/clipt-blog-page";
import "@/styles/blogs.css";

export function generateMetadata(): Metadata {
  const post = getCustomBlogPost("clipt");
  return post ? createBlogMetadata(post) : {};
}

export default function Page() {
  requirePublishedRoute("/blogs/clipt");
  const post = getCustomBlogPost("clipt");
  if (!post) notFound();
  return (
    <>
      <BlogPostingJsonLd post={post} />
      <CliptBlogPage post={post} />
    </>
  );
}
