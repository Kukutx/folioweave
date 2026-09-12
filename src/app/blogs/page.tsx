import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { formatBlogDate, getBlogIndexPosts } from "@/blog";
import { routeMetadata } from "@/config/seo";
import { PortfolioCalendarIcon, PortfolioClockIcon } from "@/components/portfolio-icons";
import { siteConfig, siteCopyright } from "@/config/site";
import { blogContent } from "@/portfolio";
import "@/styles/blogs.css";

export const metadata = routeMetadata.blogs;

export default function BlogsPage() {
  const posts = getBlogIndexPosts();
  if (!posts.length) notFound();

  return (
    <div className="writing-container">
      <header className="writing-header">
        <div>
          {siteConfig.features.demoRoutes ? (
            <>
              <h1 className="writing-title">OG Blogs</h1>
              <p className="writing-subtitle">
                Thoughts on{" "}
                <span className="highlight-yellow">design engineering</span>,{" "}
                <span className="highlight-yellow">product philosophy</span>, and the{" "}
                <span className="highlight-yellow">obsession with detail</span>.
              </p>
            </>
          ) : (
            <>
              <h1 className="writing-title">{blogContent.title}</h1>
              <p className="writing-subtitle">{blogContent.description}</p>
            </>
          )}
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
                      {siteConfig.features.demoRoutes &&
                      post.kind === "custom" &&
                      post.slug === "clipt"
                        ? "Jan 26, 2026"
                        : formatBlogDate(post.date, siteConfig.identity.locale)}
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
