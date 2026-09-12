import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarkdownBlogPost, getMarkdownBlogPosts } from "@/blog";
import { MarkdownBlogPostPage } from "@/components/blog/markdown-blog-post";
import { createBlogMetadata } from "@/blog/metadata";
import "@/styles/blogs.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return getMarkdownBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getMarkdownBlogPost(slug);
  if (!post) return {};

  return createBlogMetadata(post);
}

export default async function BlogPostRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getMarkdownBlogPost(slug);
  if (!post) notFound();
  return <MarkdownBlogPostPage post={post} />;
}
