import Link from "next/link";
import type { BlogPostSummary } from "@/blog/types";
import { tagHref } from "@/blog/taxonomy.mjs";
import { ArticleBody } from "@/components/blog/article-body";
import type { TemplateContext, TemplateModule } from "@/core/contracts";
import styles from "./bottega.module.css";
import { SubpageShell } from "./parts";
import { shopOf, type Shop } from "./shop";

function dateLabel(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function Tags({
  labels,
  active,
  shop,
}: {
  labels: readonly string[];
  active?: string;
  shop: Shop;
}) {
  if (!labels.length) return null;
  return (
    <nav className={styles.tags} aria-label={shop.copy.articleTopics}>
      <Link href="/blogs" className={styles.tag} aria-current={active ? undefined : "page"}>
        {shop.copy.allTopics}
      </Link>
      {labels.map((label) => (
        <Link
          key={label}
          href={tagHref(label)}
          className={styles.tag}
          aria-current={active === label ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function PostList({ posts, shop }: { posts: readonly BlogPostSummary[]; shop: Shop }) {
  if (!posts.length) return <p className={styles.empty}>{shop.copy.noArticles}</p>;
  return (
    <ol className={styles.posts}>
      {posts.map((post) => (
        <li key={post.slug}>
          <Link className={styles.postLink} href={post.href}>
            <span className={styles.postMeta}>
              <time dateTime={post.date}>{dateLabel(post.date, shop.locale)}</time>
              <span>
                {post.readingMinutes} {shop.copy.minRead}
              </span>
            </span>
            <span className={styles.postTitle}>{post.title}</span>
            {post.description && (
              <span className={`${styles.lead} ${styles.postText}`}>{post.description}</span>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}

function IndexView({
  context,
  eyebrow,
  title,
  text,
  labels,
  active,
  posts,
}: {
  context: TemplateContext;
  eyebrow: string;
  title: string;
  text?: string;
  labels: readonly string[];
  active?: string;
  posts: readonly BlogPostSummary[];
}) {
  const shop = shopOf(context);
  return (
    <SubpageShell context={context}>
      <main id="content">
        <section className={`${styles.container} ${styles.writingIntro}`}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 className={styles.catalogTitle}>{title}</h1>
          {text && <p className={`${styles.lead} ${styles.pageLead}`}>{text}</p>}
          <Tags labels={labels} active={active} shop={shop} />
        </section>
        <section className={`${styles.container} ${styles.pageSection}`}>
          <PostList posts={posts} shop={shop} />
        </section>
      </main>
    </SubpageShell>
  );
}

export const BlogIndexView: TemplateModule["BlogIndex"] = ({ posts, context }) => {
  const labels = [...new Set(posts.flatMap((post) => [...post.tags]))].sort((a, b) =>
    a.localeCompare(b, context.site.identity.locale),
  );
  return (
    <IndexView
      context={context}
      eyebrow={context.site.identity.name}
      title={context.writing.heading ?? context.writing.title}
      text={context.writing.description}
      labels={labels}
      posts={posts}
    />
  );
};

export const BlogTagView: TemplateModule["BlogTag"] = ({ tag, context }) => (
  <IndexView
    context={context}
    eyebrow={context.writing.title}
    title={tag.label}
    labels={tag.labels}
    active={tag.label}
    posts={tag.posts}
  />
);

export const BlogPostView: TemplateModule["BlogPost"] = ({ post, afterArticle, context }) => {
  const shop = shopOf(context);
  const { copy } = shop;
  return (
    <SubpageShell context={context}>
      <main id="content" className={styles.article}>
        <Link href="/blogs" className={styles.homeLink}>
          ← {copy.allArticles}
        </Link>
        <article>
          <header>
            <p className={`${styles.postMeta}`}>
              <time dateTime={post.date}>{dateLabel(post.date, shop.locale)}</time>
              <span>
                {post.readingMinutes} {copy.minRead}
              </span>
            </p>
            <h1 className={styles.articleTitle}>{post.title}</h1>
            {post.subtitle && (
              <p className={`${styles.lead} ${styles.pageLead}`}>{post.subtitle}</p>
            )}
            {post.description && (
              <p className={`${styles.lead} ${styles.muted} ${styles.pageLead}`}>
                {post.description}
              </p>
            )}
            {post.tags.length > 0 && (
              <div className={styles.articleTags}>
                {post.tags.map((tag) => (
                  <Link key={tag} href={tagHref(tag)} className={styles.tag}>
                    {tag}
                  </Link>
                ))}
              </div>
            )}
          </header>
          {post.headings.length > 1 && (
            <details className={styles.outline}>
              <summary>{copy.onThisPage}</summary>
              <nav aria-label={copy.onThisPage}>
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
          <div className={styles.prose}>
            <ArticleBody post={post} />
          </div>
        </article>
        <div className={styles.after}>{afterArticle}</div>
        <div className={styles.articleEnd}>
          <Link href="/blogs" className={styles.subFooterLink}>
            ← {copy.allArticles}
          </Link>
          <a href="#content" className={styles.subFooterLink}>
            {copy.backToTop}
          </a>
        </div>
      </main>
    </SubpageShell>
  );
};
