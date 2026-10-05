import { Fragment } from "react";
import { notFound } from "next/navigation";
import { getBlogIndexPosts } from "@/blog";
import { BlogCardList } from "@/components/blog/blog-card-list";
import { blogMetadata } from "@/config/seo";
import { siteCopyright } from "@/config/site";
import { blogContent } from "@/portfolio";
import "@/styles/blogs.css";

export const metadata = blogMetadata;

export default function BlogsPage() {
  const posts = getBlogIndexPosts();
  if (!posts.length) notFound();

  return (
    <div className="writing-container">
      <header className="writing-header">
        <div>
          <h1 className="writing-title">
            {blogContent.heading ?? blogContent.title}
          </h1>
          <p className="writing-subtitle">
            {blogContent.intro?.length
              ? blogContent.intro.map((segment, index) =>
                  segment.tone === "highlight" ? (
                    <span className="highlight-yellow" key={index}>
                      {segment.text}
                    </span>
                  ) : (
                    <Fragment key={index}>{segment.text}</Fragment>
                  ),
                )
              : blogContent.description}
          </p>
        </div>
      </header>
      <main className="writing-list-container">
        <BlogCardList posts={posts} />
      </main>
      <footer className="writing-footer">
        <p>{siteCopyright}</p>
      </footer>
    </div>
  );
}
