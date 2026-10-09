"use client";

import { useRef, useState, type ComponentType } from "react";
import { Search } from "lucide-react";
import type { BlogSearchDocument } from "@/blog/search";
import type { BlogSearchPanelProps } from "./blog-search-panel";
import styles from "./blog-tools.module.css";

export function BlogSearch({
  posts,
  locale,
}: {
  posts: BlogSearchDocument[];
  locale: string;
}) {
  const zh = /^zh(?:-|$)/i.test(locale);
  const [Panel, setPanel] =
    useState<ComponentType<BlogSearchPanelProps> | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const show = async () => {
    if (Panel) {
      setOpen(true);
      return;
    }
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const panelModule = await import("./blog-search-panel");
      // A navigation while the chunk loads must not open a modal on another page.
      if (!trigger.current?.isConnected) return;
      setPanel(() => panelModule.default);
      setOpen(true);
    } catch {
      if (trigger.current?.isConnected) setFailed(true);
    } finally {
      pending.current = false;
      if (trigger.current?.isConnected) setLoading(false);
    }
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.action}
        data-blog-search
        aria-label={zh ? "搜索文章" : "Search posts"}
        title={zh ? "搜索文章" : "Search posts"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={loading}
        disabled={loading}
        onClick={() => void show()}
      >
        <Search size={16} strokeWidth={2.2} aria-hidden="true" />
        <span className={styles.label}>{zh ? "搜索" : "Search"}</span>
      </button>
      {failed && (
        <p role="status" className={styles.error}>
          {zh
            ? "搜索暂时无法加载，请再次点击搜索重试。"
            : "Search could not load. Click Search to retry."}
        </p>
      )}
      {open && Panel && (
        <Panel
          posts={posts}
          locale={locale}
          query={query}
          trigger={trigger}
          onQueryChange={setQuery}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
