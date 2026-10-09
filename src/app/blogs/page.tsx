import { notFound } from "next/navigation";
import { getBlogIndexPosts } from "@/blog";
import { blogMetadata } from "@/config/seo";
import BlogIndex from "@/portfolio/template-blog-index.generated";
import { templateContext } from "@/core/template-context";
export const metadata = blogMetadata;
export default function BlogsPage() {
  const posts = getBlogIndexPosts();
  if (!posts.length) notFound();
  return <BlogIndex posts={posts} context={templateContext} />;
}
