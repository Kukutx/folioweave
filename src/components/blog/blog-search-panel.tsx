"use client";

import Link from "next/link";
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { ArrowUpRight, Search, X } from "lucide-react";
import {
  indexBlogSearch,
  searchBlogPosts,
  type BlogSearchDocument,
} from "@/blog/search";
import { lockPageScroll } from "@/lib/scroll-lock";
import styles from "./blog-search-panel.module.css";

export type BlogSearchPanelProps = {
  posts: BlogSearchDocument[];
  locale: string;
  query: string;
  trigger: RefObject<HTMLButtonElement | null>;
  onQueryChange: (query: string) => void;
  onClose: () => void;
};

export default function BlogSearchPanel({
  posts,
  locale,
  query,
  trigger,
  onQueryChange,
  onClose,
}: BlogSearchPanelProps) {
  const zh = /^zh(?:-|$)/i.test(locale);
  const title = zh ? "搜索文章" : "Search posts";
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const backdropDown = useRef(false);
  const id = useId();
  const [limit, setLimit] = useState(12);
  const index = useMemo(() => indexBlogSearch(posts), [posts]);
  const matches = useMemo(() => searchBlogPosts(index, query), [index, query]);
  useLayoutEffect(() => {
    const element = dialog.current;
    const returnTarget = trigger.current;
    const release = lockPageScroll();
    element?.showModal();
    input.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      release();
      if (returnTarget?.isConnected)
        returnTarget.focus({ preventScroll: true });
    };
  }, [trigger]);
  const changeQuery = (value: string) => {
    onQueryChange(value);
    setLimit(12);
    list.current?.scrollTo({ top: 0, behavior: "instant" });
  };
  const outside = (event: PointerEvent<HTMLDialogElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  };
  return createPortal(
    <dialog
      ref={dialog}
      className={styles.panel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-hint`}
      data-blog-search-panel
      onCancel={(event) => {
        event.preventDefault();
        flushSync(onClose);
      }}
      onPointerDown={(event) => {
        backdropDown.current = outside(event);
      }}
      onPointerUp={(event) => {
        if (backdropDown.current && outside(event)) onClose();
        backdropDown.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input, a[href]",
          ),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className={styles.header}>
        <h2 id={`${id}-title`}>{title}</h2>
        <button
          type="button"
          className={styles.icon}
          aria-label={zh ? "关闭搜索" : "Close search"}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.field}>
        <Search size={18} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          value={query}
          maxLength={200}
          aria-label={title}
          placeholder={zh ? "搜索标题、摘要或标签…" : "Title, summary or tag…"}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(event) => changeQuery(event.target.value)}
        />
        {query && (
          <button
            type="button"
            className={styles.icon}
            aria-label={zh ? "清空搜索" : "Clear search"}
            onClick={() => {
              changeQuery("");
              input.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className={styles.hint} id={`${id}-hint`}>
        {zh
          ? "按标题、摘要和标签查找文章"
          : "Find articles by title, summary and tags"}
      </p>
      <p
        className={styles.count}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {query.trim()
          ? zh
            ? `找到 ${matches.length} 篇文章`
            : `${matches.length} ${matches.length === 1 ? "result" : "results"}`
          : zh
            ? "最近发布"
            : "Recent posts"}
      </p>
      <ul ref={list} className={styles.results}>
        {matches.slice(0, limit).map((post) => (
          <li key={post.href}>
            <Link
              href={post.href}
              prefetch={false}
              onNavigate={() => {
                flushSync(onClose);
              }}
              className={styles.result}
            >
              <span className={styles.resultTop}>
                <time dateTime={post.date}>{post.date}</time>
                <ArrowUpRight size={16} aria-hidden="true" />
              </span>
              <span className={styles.title}>
                {post.title}
                {post.subtitle ? ` ${post.subtitle}` : ""}
              </span>
              <span className={styles.summary}>
                {post.excerpt ?? post.description}
              </span>
              {post.tags.length > 0 && (
                <span className={styles.tags}>{post.tags.join(" · ")}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {matches.length === 0 && (
        <div className={styles.empty}>
          <p>{zh ? "没有找到匹配的文章" : "No matching posts"}</p>
          <span>
            {zh
              ? "试试更短的关键词，或清空搜索。"
              : "Try a shorter keyword, or clear your search."}
          </span>
        </div>
      )}
      {matches.length > limit && (
        <button
          type="button"
          className={styles.more}
          onClick={() => setLimit(limit + 12)}
        >
          {zh ? "显示更多" : "Show more"}
        </button>
      )}
    </dialog>,
    document.body,
  );
}
