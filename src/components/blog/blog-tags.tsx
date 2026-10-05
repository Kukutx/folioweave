import Link from "next/link";
import { tagHref } from "@/blog/taxonomy.mjs";

/** A post's tags; each one opens the list of posts that share it. */
export function BlogTags({
  tags,
  current,
  className,
  label,
}: {
  tags: readonly string[];
  /** The tag whose page is being shown, if any. */
  current?: string;
  className?: string;
  /** Names the group for assistive technology; a named group is a landmark. */
  label?: string;
}) {
  if (!tags.length) return null;
  const Group = label ? "nav" : "div";
  return (
    <Group
      className={className ? `blog-tags ${className}` : "blog-tags"}
      aria-label={label}
    >
      {tags.map((tag) => (
        <Link
          href={tagHref(tag)}
          className="blog-tag"
          aria-current={tag === current ? "page" : undefined}
          key={tag}
        >
          {tag}
        </Link>
      ))}
    </Group>
  );
}
