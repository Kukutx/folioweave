// Writing in Stack's language: the same desk, one sheet pulled from the pile with the
// dividers' tabs above it, and the contents typed on it.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { TemplateContext } from "@/core/contracts";
import { tagHref } from "@/blog/taxonomy.mjs";
import { stackLabels } from "./data";
import { ArrowUp } from "./parts/icons";
import s from "./stack.module.css";
import b from "./blog.module.css";

export function Shell({
  context,
  current,
  children,
}: {
  context: TemplateContext;
  current?: "writing";
  children: ReactNode;
}) {
  const labels = stackLabels(context);
  const tabs = [
    { href: "/", label: labels.home, tint: "about", current: false },
    ...(context.capabilities.writing
      ? [
          {
            href: "/blogs",
            label: labels.writing,
            tint: "writing",
            current: current === "writing",
          },
        ]
      : []),
  ];
  return (
    <div className={s.page} id="top">
      <header className={b.top}>
        <Link href="/" className={b.name}>
          {context.site.identity.name}
        </Link>
        <nav className={b.tabs} aria-label={labels.sections}>
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={b.tab}
              aria-current={tab.current ? "page" : undefined}
              style={{ "--tint": `var(--tint-${tab.tint})` } as CSSProperties}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className={`${s.main} ${b.main}`}>
        {children}
      </main>
      <footer className={`${s.foot} ${s.label}`}>
        <span>
          © {context.site.copyrightYear} {context.site.identity.name}
        </span>
        <a href="#top">
          {labels.backToTop} <ArrowUp width={12} height={12} />
        </a>
      </footer>
    </div>
  );
}

/** The topics as small tabs: all writing, then each tag. */
export function Tags({
  labels,
  active,
  all,
}: {
  labels: readonly string[];
  active?: string;
  all: string;
}) {
  if (!labels.length) return null;
  return (
    <nav className={b.topics} aria-label="Topics">
      <Link href="/blogs" aria-current={!active ? "page" : undefined}>
        {all}
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
