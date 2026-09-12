import { Fragment } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { formatBlogDate, getBlogIndexPosts } from "@/blog";
import { blogMetadata } from "@/config/seo";
import { PortfolioCalendarIcon, PortfolioClockIcon } from "@/components/portfolio-icons";
import { siteConfig, siteCopyright } from "@/config/site";
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
        <div className="blogs-grid">
          {posts.map((post) => (
            <Link
              href={post.href}
              className="blog-card"
              key={`${post.kind}:${post.slug}`}
            >
              <div className="blog-card-image" style={{ position: "relative" }}>
                {post.cover ? (
                  <Image src={post.cover} alt="" fill sizes="(max-width: 720px) 100vw, 50vw" />
                ) : (
                  <div className="blog-card-image-placeholder" aria-hidden>
                    <span>{post.title.slice(0, 1).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="blog-card-content">
                <div className="blog-meta">
                  <span className="blog-date">
                    <PortfolioCalendarIcon size={14} />
                    <time dateTime={post.date}>
                      {post.displayDate ??
                        formatBlogDate(post.date, siteConfig.identity.locale)}
                    </time>
                  </span>
                  <span className="blog-separator">•</span>
                  <span className="blog-read-time">
                    <PortfolioClockIcon size={14} /> {post.readingMinutes} min read
                  </span>
                </div>
                <h2 className="blog-card-title">
                  {post.title}
                  {post.subtitle ? (
                    <span className="blog-card-subtitle">{post.subtitle}</span>
                  ) : null}
                </h2>
                {post.tags.length ? (
                  <div className="blog-tags">
                    {post.tags.map((tag) => (
                      <span className="blog-tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="blog-card-excerpt">{post.excerpt ?? post.description}</p>
                <span className="read-more">
                  Read post <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <footer className="writing-footer">
        <p>{siteCopyright}</p>
      </footer>
    </div>
  );
}
