import Link from "next/link";
import Image from "next/image";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";
import { formatBlogDate, type MarkdownBlogPost } from "@/blog";
import { siteConfig, siteCopyright } from "@/config/site";
import { PortfolioCalendarIcon, PortfolioClockIcon } from "@/components/portfolio-icons";
import { BlogPostingJsonLd } from "./blog-json-ld";
import { mediaDimensions } from "@/portfolio/media";

const markdownComponents: Components = {
  a({ href, children, ...props }) {
    const external = typeof href === "string" && /^https?:\/\//.test(href);
    return (
      <a
        {...props}
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  img({ src, alt, ...props }) {
    if (typeof src !== "string") return null;
    return (
      <img
        {...props}
        src={src}
        {...mediaDimensions(src)}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className="markdown-blog-image"
      />
    );
  },
};

export function MarkdownBlogPostPage({ post }: { post: MarkdownBlogPost }) {
  return (
    <div className="writing-container blog-post-page markdown-blog-post-page">
      <BlogPostingJsonLd post={post} />
      <div className="reading-progress-bar" aria-hidden />
      <nav className="writing-nav">
        <Link href="/blogs" className="back-link">
          <ArrowLeft size={18} /> Back to Blogs
        </Link>
      </nav>
      <article className="blog-post-container">
        <header className="blog-post-header">
          <div className="blog-post-meta">
            <span className="blog-date">
              <PortfolioCalendarIcon size={14} />
              <time dateTime={post.date}>
                {formatBlogDate(post.date, siteConfig.identity.locale)}
              </time>
            </span>
            <span className="blog-read-time">
              <PortfolioClockIcon size={14} /> {post.readingMinutes} min read
            </span>
          </div>
          <h1 className="blog-post-title">
            {post.title}
            {post.subtitle ? (
              <span className="blog-post-title-secondary">{post.subtitle}</span>
            ) : null}
          </h1>
          <p className="writing-subtitle">{post.description}</p>
          {post.tags.length ? (
            <div className="blog-tags blog-post-tags" aria-label="Article tags">
              {post.tags.map((tag) => (
                <span className="blog-tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </header>
        {post.cover ? (
          <Image
            src={post.cover}
            alt=""
            className="blog-post-hero-image"
            {...mediaDimensions(post.cover)}
            sizes="(max-width: 900px) 100vw, 900px"
            priority
          />
        ) : null}
        <div className="blog-post-content markdown-blog-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
      <footer className="writing-footer">
        <p>{siteCopyright}</p>
      </footer>
    </div>
  );
}
