// The writing's shared parts: a page's printed head and the topics as a row of small tickets.

import Link from "next/link";
import type { ReactNode } from "react";
import { tagHref } from "@/blog/taxonomy.mjs";
import s from "./site.module.css";
import g from "./pages.module.css";

export function PageHead({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className={`${s.head} ${g.pageHead}`}>
      <p className={`${s.mono} ${s.kicker}`}>{kicker}</p>
      <h1 className={`${s.heading} ${g.pageTitle}`}>{title}</h1>
      {children && <div className={s.headAside}>{children}</div>}
    </header>
  );
}

/** The topics, each a small notched ticket; the current one is printed on the card's stock. */
export function Tags({
  labels,
  active,
  all,
  label,
}: {
  labels: readonly string[];
  active?: string;
  all?: string;
  label: string;
}) {
  if (!labels.length) return null;
  const items = [
    ...(all ? [{ text: all, href: "/blogs", on: !active }] : []),
    ...labels.map((tag) => ({
      text: tag,
      href: tagHref(tag),
      on: tag === active,
    })),
  ];
  return (
    <nav className={g.tags} aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={g.tag}
              aria-current={item.on ? "page" : undefined}
            >
              {item.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
