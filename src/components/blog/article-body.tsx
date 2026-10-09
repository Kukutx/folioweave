import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarkdownBlogPost } from "@/blog/types";
import { mediaDimensions } from "@/portfolio/media";
import { rehypeHeadingIds } from "./heading-ids";

const semanticComponents: Components = {
  a({ href, children, ...props }) {
    const external = typeof href === "string" && /^https?:\/\//.test(href);
    return (
      <a
        {...props}
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  img({ src, alt, ...props }) {
    if (typeof src !== "string") return null;
    return (
      <img
        {...props}
        src={src}
        {...mediaDimensions(src)}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className="markdown-blog-image"
      />
    );
  },
};

/** Shared content semantics; templates supply presentation without importing a theme. */
export function ArticleBody({
  post,
  components,
}: {
  post: MarkdownBlogPost;
  components?: Pick<Components, "pre" | "code">;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHeadingIds, post.headings]]}
      components={{ ...semanticComponents, ...components }}
    >
      {post.content}
    </ReactMarkdown>
  );
}
