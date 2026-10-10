"use client";

import Markdown from "react-markdown";
import { memo, type ComponentProps } from "react";
import { safeCommentLink } from "./waline-service";

const components = {
  a: ({ href, children }: ComponentProps<"a">) => {
    const url = safeCommentLink(href);
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer nofollow ugc">
        {children}
      </a>
    ) : (
      <>{children}</>
    );
  },
};

export default memo(function CommentBody({ body }: { body: string }) {
  return (
    <Markdown
      skipHtml
      allowedElements={[
        "p",
        "br",
        "strong",
        "em",
        "del",
        "code",
        "pre",
        "blockquote",
        "ul",
        "ol",
        "li",
        "a",
      ]}
      unwrapDisallowed
      components={components}
    >
      {body}
    </Markdown>
  );
});
