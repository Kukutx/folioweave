import type { BlogPostSummary } from "./types.ts";

export type BlogSearchDocument = Pick<
  BlogPostSummary,
  "href" | "title" | "subtitle" | "description" | "excerpt" | "date" | "tags"
>;

/** Accept published summaries only; never serialize Markdown bodies or extra fields. */
export function blogSearchDocuments(
  posts: readonly BlogPostSummary[],
): BlogSearchDocument[] {
  return posts.map(
    ({ href, title, subtitle, description, excerpt, date, tags }) => ({
      href,
      title,
      subtitle,
      description,
      excerpt,
      date,
      tags: [...tags],
    }),
  );
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function indexBlogSearch(posts: readonly BlogSearchDocument[]) {
  return posts.map((post) => ({
    post,
    title: normalize(`${post.title} ${post.subtitle ?? ""}`),
    text: normalize(
      [post.title, post.subtitle, post.description, post.excerpt, ...post.tags]
        .filter(Boolean)
        .join(" "),
    ),
  }));
}

/** Literal, Unicode-aware matching: every word must occur, title matches first. */
export function searchBlogPosts(
  index: ReturnType<typeof indexBlogSearch>,
  query: string,
) {
  const terms = normalize(query).split(/\s+/u).filter(Boolean);
  if (!terms.length) return index.map(({ post }) => post);
  return index
    .filter(({ text }) => terms.every((term) => text.includes(term)))
    .map((entry) => ({
      ...entry,
      score: terms.filter((term) => entry.title.includes(term)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
}
