"use client";

import type { PluginProps } from "@/core/contracts";
import type { CommentsOptions } from "./options.generated";
import GiscusComments from "./giscus-comments";
import WalineComments from "./waline-comments";

// Keep the small UI and its scoped stylesheet in the same entry. Deferring this
// shell can paint unstyled controls before its CSS arrives on a cold load.
// Markdown parsing and the Giscus widget remain lazy inside their adapters.

/** The host supplies article identity; the plugin never reads template markup. */
export default function Comments(props: PluginProps<CommentsOptions>) {
  if (!props.context.article) return null;
  if (props.options.provider === "waline") {
    return (
      <WalineComments
        {...props}
        key={`${props.options.serverURL}:${props.context.article.id}`}
      />
    );
  }
  if (
    !props.options.repo ||
    !props.options.repoId ||
    !props.options.category ||
    !props.options.categoryId
  )
    return null;
  return (
    <GiscusComments
      context={props.context}
      options={{
        ...props.options,
        provider: "giscus",
        repo: props.options.repo,
        repoId: props.options.repoId,
        category: props.options.category,
        categoryId: props.options.categoryId,
      }}
    />
  );
}
