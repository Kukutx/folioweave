import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { BlogPostSummary } from "@/blog/types";
import type { TemplateModule, TemplateContext } from "@/core/contracts";
import { ArticleBody } from "@/components/blog/article-body";
import { tagHref } from "@/blog/taxonomy.mjs";
import { refractCopy, type RefractCopy } from "@/components/refract/copy";
import styles from "./writing.module.css";

type Style = "light" | "dark";

const copyFor = (context: TemplateContext) =>
  refractCopy(
    context.site.identity.locale,
    (context.options as { labels?: Partial<RefractCopy> }).labels,
  );

function WritingShell({
  context,
  style,
  children,
}: {
  context: TemplateContext;
  style: Style;
  children: ReactNode;
}) {
  const copy = copyFor(context);
  return (
    <div className={styles.shell} data-style={style}>
      <a className={styles.skip} href="#writing-main">
        {copy.skipToContent}
      </a>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/">
          {context.site.identity.name}
        </Link>
        <nav aria-label={copy.mainNavigation}>
          <Link href="/">{copy.home}</Link>
          <Link href="/blogs">{copy.writing}</Link>
        </nav>
      </header>
      {children}
      <footer className={styles.footer}>
        <span>
          © {context.site.copyrightYear} {context.site.identity.name}
        </span>
        <a href={`mailto:${context.site.contact.email}`}>{copy.getInTouch} ↗</a>
      </footer>
    </div>
  );
}

function dateLabel(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function Tags({
  labels,
  active,
  copy,
}: {
  labels: readonly string[];
  active?: string;
  copy: RefractCopy;
}) {
  if (!labels.length) return null;
  return (
    <nav className={styles.tags} aria-label={copy.articleTopics}>
      <Link href="/blogs" aria-current={!active ? "page" : undefined}>
        {copy.allTopics}
      </Link>
      {labels.map((label) => (
        <Link
          key={label}
          href={tagHref(label)}
          aria-current={active === label ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function PostList({
  posts,
  locale,
  copy,
}: {
  posts: readonly BlogPostSummary[];
  locale: string;
  copy: RefractCopy;
}) {
  if (!posts.length) return <p className={styles.empty}>{copy.noArticles}</p>;
  return (
    <ol className={styles.list}>
      {posts.map((post) => (
        <li key={post.slug}>
          <Link className={styles.postLink} href={post.href}>
            <div className={styles.meta}>
              <time dateTime={post.date}>{dateLabel(post.date, locale)}</time>
              <span>
                {post.readingMinutes} {copy.minRead}
              </span>
            </div>
            <div>
              <h2>{post.title}</h2>
              <p>{post.description}</p>
              {post.tags.length > 0 && (
                <span className={styles.topicText}>
                  {post.tags.join(" / ")}
                </span>
              )}
            </div>
            <span className={styles.arrow} aria-hidden="true">
              ↗
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function RefractBlogIndex({
  posts,
  context,
  style,
}: ComponentProps<TemplateModule["BlogIndex"]> & { style: Style }) {
  const copy = copyFor(context);
  const labels = [...new Set(posts.flatMap((post) => [...post.tags]))].sort(
    (a, b) => a.localeCompare(b, context.site.identity.locale),
  );
  return (
    <WritingShell context={context} style={style}>
      <main id="writing-main" className={styles.index}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>{copy.writingEyebrow}</p>
          <h1>{context.writing.heading ?? context.writing.title}</h1>
          <p>{context.writing.description}</p>
        </div>
        <Tags labels={labels} copy={copy} />
        <PostList
          posts={posts}
          locale={context.site.identity.locale}
          copy={copy}
        />
      </main>
    </WritingShell>
  );
}

export function RefractBlogTag({
  tag,
  context,
  style,
}: ComponentProps<TemplateModule["BlogTag"]> & { style: Style }) {
  const copy = copyFor(context);
  return (
    <WritingShell context={context} style={style}>
      <main id="writing-main" className={styles.index}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>{context.writing.title}</p>
          <h1>{tag.label}</h1>
        </div>
        <Tags labels={tag.labels} active={tag.label} copy={copy} />
        <PostList
          posts={tag.posts}
          locale={context.site.identity.locale}
          copy={copy}
        />
      </main>
    </WritingShell>
  );
}

export function RefractBlogPost({
  post,
  afterArticle,
  context,
  style,
}: ComponentProps<TemplateModule["BlogPost"]> & { style: Style }) {
  const copy = copyFor(context);
  return (
    <WritingShell context={context} style={style}>
      <main id="writing-main" className={styles.article}>
        <Link className={styles.back} href="/blogs">
          ← {copy.allWriting}
        </Link>
        <article>
          <header className={styles.articleHeader}>
            <div className={styles.meta}>
              <time dateTime={post.date}>
                {dateLabel(post.date, context.site.identity.locale)}
              </time>
              <span>
                {post.readingMinutes} {copy.minRead}
              </span>
            </div>
            <h1>{post.title}</h1>
            {post.subtitle && <p>{post.subtitle}</p>}
            <p className={styles.dek}>{post.description}</p>
            {post.tags.length > 0 && (
              <div className={styles.articleTags}>
                {post.tags.map((tag) => (
                  <Link key={tag} href={tagHref(tag)}>
                    {tag}
                  </Link>
                ))}
              </div>
            )}
          </header>
          {post.headings.length > 1 && (
            <details className={styles.outline}>
              <summary>{copy.onThisPage}</summary>
              <nav aria-label={copy.articleOutline}>
                <ol>
                  {post.headings.map((heading) => (
                    <li key={heading.id} data-depth={heading.depth}>
                      <a href={`#${heading.id}`}>{heading.text}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            </details>
          )}
          <div className={styles.body}>
            <ArticleBody post={post} />
          </div>
        </article>
        <div className={styles.after}>{afterArticle}</div>
        <nav className={styles.articleEnd} aria-label={copy.articleNavigation}>
          <Link href="/blogs">← {copy.allWriting}</Link>
          <a href="#writing-main">{copy.backToTop} ↑</a>
        </nav>
      </main>
    </WritingShell>
  );
}
