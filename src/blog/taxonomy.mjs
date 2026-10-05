/**
 * Views derived from published posts: tag pages and the anchors of an
 * article's headings. Dependency-free so the content build, the runtime and QA
 * all derive exactly the same routes and ids from the same posts.
 */

/**
 * URL segment for a label: lowercase letters and digits of any script joined
 * by hyphens. "For Designers" becomes "for-designers"; "设计" stays "设计".
 * A plus or hash attached to a name is spelled out, so "C", "C++" and "C#"
 * stay three different tags.
 */
export function taxonomySlug(label) {
  return label
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/(?<=[\p{L}\p{N}+])\+/gu, " plus")
    .replace(/(?<=[\p{L}\p{N}])#/gu, " sharp")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** Where a tag's posts are listed. */
export const tagHref = (label) => `/blogs/tag/${taxonomySlug(label)}`;

/**
 * Tags with the posts that carry them, ordered by label. Two labels that share
 * a slug would silently merge into one page, so that is an error instead.
 * @template {{ tags: readonly string[], date: string, href: string }} T
 * @param {readonly T[]} posts
 * @returns {{ slug: string, label: string, href: string, posts: T[] }[]}
 */
export function buildTagIndex(posts) {
  const tags = new Map();
  for (const post of posts)
    for (const label of post.tags) {
      const slug = taxonomySlug(label);
      if (!slug)
        throw new Error(
          `Tag "${label}" on ${post.href} has no letters or digits to build a URL from.`,
        );
      const tag = tags.get(slug);
      if (tag && tag.label !== label)
        throw new Error(
          `Tags "${tag.label}" and "${label}" would share the page /blogs/tag/${slug}. Use one spelling.`,
        );
      if (tag) tag.posts.push(post);
      else tags.set(slug, { slug, label, href: tagHref(label), posts: [post] });
    }
  return [...tags.values()]
    .map((tag) => ({
      ...tag,
      posts: tag.posts.toSorted((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}

/**
 * Routes that exist only because posts carry tags. They join the published
 * route set, so the sitemap, link validation and QA crawl cover them like any
 * post.
 * @param {readonly { tags: readonly string[], date: string, href: string }[]} posts
 */
export function taxonomyRoutes(posts) {
  return buildTagIndex(posts).map((tag) => tag.href);
}

/**
 * Stable ids for an article's headings, in document order. A repeated heading
 * gets a numeric suffix so every anchor stays unique within the page.
 * @template {{ text: string }} T
 * @param {readonly T[]} headings
 * @returns {(T & { id: string })[]}
 */
export function assignHeadingIds(headings) {
  const used = new Map();
  return headings.map((heading) => {
    const base = taxonomySlug(heading.text) || "section";
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return { ...heading, id: count === 1 ? base : `${base}-${count}` };
  });
}
