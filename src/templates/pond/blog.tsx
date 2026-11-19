// Writing in the pond's language: the navigation with "blog" lit, the intro's column and mono type, posts as
// rows of date, title and description, and the links underlined as in the intro.

import Link from "next/link";
import { Fragment } from "react";
import type { BlogPostSummary } from "@/blog/types";
import type { TemplateContext } from "@/core/contracts";
import { tagHref } from "@/blog/taxonomy.mjs";
import { pondLabels } from "./data";
import s from "./pond.module.css";
import b from "./blog.module.css";

export const dateOf = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00Z`),
  );

export function PostList({ posts, context }: { posts: readonly BlogPostSummary[]; context: TemplateContext }) {
  const labels = pondLabels(context);
  const locale = context.site.identity.locale;
  return (
    <ol className={s.list}>
      {posts.map((post) => (
        <li key={post.slug} className={s.entry}>
          <p className={`${s.muted} ${s.small}`}>
            <time dateTime={post.date}>{dateOf(post.date, locale)}</time>
            <span className={s.sep}> / </span>
            {post.readingMinutes} {labels.minutes}
          </p>
          <h2 className={s.entryHead}>
            <Link className={s.link} href={post.href}>
              {post.title}
            </Link>
          </h2>
          {post.description && <p className={s.text}>{post.description}</p>}
        </li>
      ))}
    </ol>
  );
}

export function Topics({ labels, active, context }: { labels: readonly string[]; active?: string; context: TemplateContext }) {
  if (!labels.length) return null;
  const all = pondLabels(context).allTopics;
  return (
    <nav className={b.topics} aria-label="Topics">
      {[{ label: all, href: "/blogs", current: !active }, ...labels.map((label) => ({ label, href: tagHref(label), current: active === label }))].map(
        (item, i) => (
          <Fragment key={item.href}>
            {i > 0 && <span className={s.sep}> / </span>}
            <Link className={s.link} href={item.href} aria-current={item.current ? "page" : undefined}>
              {item.label}
            </Link>
          </Fragment>
        ),
      )}
    </nav>
  );
}
