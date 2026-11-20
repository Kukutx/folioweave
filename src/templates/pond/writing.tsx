// Writing on the bank: the topics as a line of words, the posts as entries of date, title and summary. A whole
// entry is the link; touching it sends a ring across the water mark beside its title.

import Link from "next/link";
import type { BlogPostSummary } from "@/blog/types";
import type { TemplateContext } from "@/core/contracts";
import { tagHref } from "@/blog/taxonomy.mjs";
import { dateOf, pondLabels } from "./data";
import s from "./pond.module.css";
import w from "./writing.module.css";

export function PostList({ posts, context }: { posts: readonly BlogPostSummary[]; context: TemplateContext }) {
  const labels = pondLabels(context);
  const locale = context.site.identity.locale;
  return (
    <ol className={w.posts}>
      {posts.map((post) => (
        <li key={post.slug} className={w.post}>
          <p className={`${s.label} ${w.meta}`}>
            <time dateTime={post.date}>{dateOf(post.date, locale)}</time>
            <span className={w.minutes}>
              {post.readingMinutes} {labels.minutes}
            </span>
          </p>
          <div className={w.body}>
            <h2 className={w.title}>
              <Link className={w.titleLink} href={post.href}>
                {post.title}
              </Link>
            </h2>
            {post.description && <p className={w.description}>{post.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Topics({ labels, active, context }: { labels: readonly string[]; active?: string; context: TemplateContext }) {
  if (!labels.length) return null;
  const items = [
    { label: pondLabels(context).allTopics, href: "/blogs", current: !active },
    ...labels.map((label) => ({ label, href: tagHref(label), current: active === label })),
  ];
  return (
    <ul className={w.topics}>
      {items.map((item) => (
        <li key={item.href}>
          <Link className={w.topic} href={item.href} aria-current={item.current ? "page" : undefined}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
