// Writing in Stack's language: the same 580 px column, mono navigation and labels, and the WRITING
// rows of the home page (a full-width band lights under the hovered row).

import Link from "next/link";
import type { ReactNode } from "react";
import type { BlogPostSummary } from "@/blog/types";
import type { TemplateContext } from "@/core/contracts";
import { tagHref } from "@/blog/taxonomy.mjs";
import { stackLabels } from "./data";
import * as I from "./icons";
import s from "./stack.module.css";
import b from "./blog.module.css";

export function Shell({ context, children }: { context: TemplateContext; children: ReactNode }) {
  const labels = stackLabels(context);
  return (
    <div className={s.wrap}>
      <nav className={s.nav}>
        <Link href="/">
          {context.site.identity.name}
        </Link>
        <span className={s.navLinks}>
          <Link href="/">{labels.navHome}</Link>
          {context.capabilities.writing && <Link href="/blogs">{labels.navThoughts}</Link>}
        </span>
      </nav>
      <main id="main" className={b.main}>
        {children}
      </main>
      <footer className={`${s.foot} ${b.foot}`}>
        <span>
          © {context.site.copyrightYear} {context.site.identity.name}
        </span>
        {context.site.contact?.email && (
          <a href={`mailto:${context.site.contact.email}`} className={b.footLink}>
            {context.site.contact.email}
          </a>
        )}
      </footer>
    </div>
  );
}

const dateOf = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00Z`),
  );

export function PostRows({ posts, context }: { posts: readonly BlogPostSummary[]; context: TemplateContext }) {
  const labels = stackLabels(context);
  const locale = context.site.identity.locale;
  return (
    <ul className={s.writing}>
      {posts.map((p) => (
        <li key={p.slug}>
          <Link className={`${s.band} ${s.post}`} href={p.href}>
            <time className={s.when} dateTime={p.date}>
              {dateOf(p.date, locale)}
            </time>
            <span className={s.postTitle}>{p.title}</span>
            <span className={s.mins}>
              <I.Clock />
              {p.readingMinutes} {labels.minutes}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Tags({ labels, active, all }: { labels: readonly string[]; active?: string; all: string }) {
  if (!labels.length) return null;
  return (
    <nav className={b.tags} aria-label="Topics">
      <Link href="/blogs" aria-current={!active ? "page" : undefined}>
        {all}
      </Link>
      {labels.map((label) => (
        <Link key={label} href={tagHref(label)} aria-current={active === label ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export { dateOf };
