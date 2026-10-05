import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { formatBlogDate } from "@/blog/format";
import type { BlogPostSummary } from "@/blog/types";
import { PortfolioCalendarIcon, PortfolioClockIcon } from "@/components/portfolio-icons";
import { siteConfig } from "@/config/site";
import { BlogTags } from "./blog-tags";

/**
 * The post cards of the blog index and of a tag page. The title link covers
 * the whole card, so the tags can be links of their own without nesting
 * anchors.
 */
export function BlogCardList({ posts }: { posts: readonly BlogPostSummary[] }) {
  return (
    <div className="blogs-grid">
      {posts.map((post) => (
        <article className="blog-card" key={`${post.kind}:${post.slug}`}>
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
              <Link href={post.href} className="blog-card-link">
                {post.title}
                {post.subtitle ? (
                  <span className="blog-card-subtitle">{post.subtitle}</span>
                ) : null}
              </Link>
            </h2>
            <BlogTags tags={post.tags} />
            <p className="blog-card-excerpt">{post.excerpt ?? post.description}</p>
            <span className="read-more" aria-hidden>
              Read post <ArrowRight size={16} />
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
