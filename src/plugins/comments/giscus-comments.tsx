"use client";

import { useEffect, useRef, useState } from "react";
import type { PluginProps } from "@/core/contracts";
import styles from "./comments.module.css";
import { discussionLanguage } from "./language.mjs";

type Options = {
  provider: "giscus";
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  theme?: "light" | "dark" | "preferred_color_scheme";
  lang?: string;
};

function GiscusDiscussion({
  options,
  articleId,
  lang,
}: {
  options: Options;
  articleId: string;
  lang: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!attempt || !container.current) return;
    const host = container.current;
    let active = true;
    let widget: HTMLElement | undefined;
    const attributes = {
      repo: options.repo,
      repoid: options.repoId,
      category: options.category,
      categoryid: options.categoryId,
      mapping: "specific",
      term: articleId,
      strict: "1",
      reactionsenabled: "1",
      emitmetadata: "1",
      inputposition: "bottom",
      theme: options.theme ?? "preferred_color_scheme",
      lang,
    };
    const timeout = window.setTimeout(() => setStatus("error"), 20000);
    const onMessage = (event: MessageEvent) => {
      const frame = widget?.shadowRoot?.querySelector("iframe");
      if (
        event.origin !== "https://giscus.app" ||
        !frame ||
        event.source !== frame.contentWindow ||
        !event.data?.giscus
      )
        return;
      window.clearTimeout(timeout);
      const error = event.data.giscus.error;
      // A first discussion is created by Giscus when a reader comments.
      setStatus(
        error && !String(error).includes("Discussion not found")
          ? "error"
          : "ready",
      );
    };
    window.addEventListener("message", onMessage);
    // The official widget owns OAuth, sizing and its disconnect cleanup. Its
    // code/styles are bundled locally; only the discussion iframe is remote.
    void import("giscus")
      .then(() => {
        if (!active) return;
        widget = document.createElement("giscus-widget");
        for (const [key, value] of Object.entries(attributes))
          widget.setAttribute(key, value);
        host.appendChild(widget);
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setStatus("error");
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      host.replaceChildren();
    };
  }, [
    articleId,
    attempt,
    lang,
    options.repo,
    options.repoId,
    options.category,
    options.categoryId,
    options.theme,
  ]);

  return (
    <section
      className={styles.comments}
      aria-label="Comments"
      data-plugin="comments"
    >
      <h2>Discussion</h2>
      {(status === "idle" || status === "error") && (
        <>
          <p>
            {status === "error"
              ? "Comments could not load. You can retry or open the discussions on GitHub."
              : "Comments are hosted on GitHub. Load the discussion to read or reply."}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
          >
            {status === "error" ? "Retry comments" : "Load comments"}
          </button>
        </>
      )}
      {status === "loading" && <p role="status">Loading discussion…</p>}
      <div ref={container} />
      <a
        href={`https://github.com/${options.repo}/discussions`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Discussions on GitHub ↗
      </a>
    </section>
  );
}

export default function GiscusComments({
  options,
  context,
}: PluginProps<Options>) {
  if (!context.article) return null;
  return (
    <GiscusDiscussion
      key={context.article.id}
      options={options}
      articleId={context.article.id}
      lang={options.lang ?? discussionLanguage(context.locale)}
    />
  );
}
