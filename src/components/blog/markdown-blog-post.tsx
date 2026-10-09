import Link from "next/link";
import Image from "next/image";
import { type Components } from "react-markdown";
import { ArticleBody } from "./article-body";
import { ArrowLeft } from "lucide-react";
import {
  formatBlogDate,
  type BlogHeading,
  type MarkdownBlogPost,
} from "@/blog";
import { siteConfig, siteCopyright } from "@/config/site";
import {
  PortfolioCalendarIcon,
  PortfolioClockIcon,
} from "@/components/portfolio-icons";
import { BlogTags } from "./blog-tags";
import { CopyCodeButton } from "./copy-code-button";
import { mediaDimensions } from "@/portfolio/media";
import type { ReactNode } from "react";
import "@/styles/blogs.css";

// An outline only helps once there is enough article to get lost in.
const OUTLINE_MIN_HEADINGS = 3;

const markdownComponents: Pick<Components, "pre"> = {
  pre({ children }) {
    return (
      <div className="code-block">
        <pre>{children}</pre>
        <CopyCodeButton />
      </div>
    );
  },
};

function ArticleOutline({ headings }: { headings: readonly BlogHeading[] }) {
  if (headings.length < OUTLINE_MIN_HEADINGS) return null;
  return (
    <nav className="blog-outline" aria-labelledby="blog-outline-title">
      <p className="blog-outline-title" id="blog-outline-title">
        On this page
      </p>
      <ol>
        {headings.map((item) => (
          <li
            className={item.depth === 3 ? "blog-outline-sub" : undefined}
            key={item.id}
          >
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function MarkdownBlogPostPage({
  post,
  afterArticle,
}: {
  post: MarkdownBlogPost;
  afterArticle?: ReactNode;
}) {
  return (
    <div className="writing-container blog-post-page markdown-blog-post-page">
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
          <BlogTags
            tags={post.tags}
            className="blog-post-tags"
            label="Article tags"
          />
        </header>
        {post.cover ? (
          <Image
            src={post.cover}
            alt=""
            className="blog-post-hero-image"
            {...mediaDimensions(post.cover)}
            sizes="(max-width: 900px) 100vw, 900px"
            preload
          />
        ) : null}
        <ArticleOutline headings={post.headings} />
        <div className="blog-post-content markdown-blog-content">
          <ArticleBody post={post} components={markdownComponents} />
        </div>
      </article>
      {afterArticle}
      <footer className="writing-footer">
        <p>{siteCopyright}</p>
      </footer>
    </div>
  );
}
