import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarkdownBlogPost, getMarkdownBlogPosts } from "@/blog";
import BlogPost from "@/portfolio/template-blog-post.generated";
import ArticlePlugins from "@/portfolio/plugins-article-after.generated";
import { BlogPostingJsonLd } from "@/components/blog/blog-json-ld";
import { templateContext } from "@/core/template-context";
import { createBlogMetadata } from "@/blog/metadata";

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
  const context = {
    locale: templateContext.site.identity.locale,
    article: { id: post.id ?? post.slug, title: post.title, href: post.href },
  };
  return (
    <>
      <BlogPostingJsonLd post={post} />
      <BlogPost
        post={post}
        context={templateContext}
        afterArticle={<ArticlePlugins context={context} />}
      />
    </>
  );
}
