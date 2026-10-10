import assert from "node:assert/strict";
import test from "node:test";
import {
  blogSearchDocuments,
  indexBlogSearch,
  searchBlogPosts,
} from "../src/blog/search.ts";

const posts = [
  {
    href: "/blogs/one",
    title: "Design notes",
    description: "A café and its typography",
    date: "2026-10-01",
    tags: ["UI"],
    content: "PRIVATE_BODY_SENTINEL",
    arbitrary: "PRIVATE_EXTRA_SENTINEL",
  },
  {
    href: "/blogs/two",
    title: "Café typography",
    subtitle: "设计实践",
    description: "Readable interfaces",
    excerpt: "中文排版与键盘输入",
    date: "2026-09-01",
    tags: ["Design", "C++"],
  },
];
const index = indexBlogSearch(blogSearchDocuments(posts));
const find = (query) => searchBlogPosts(index, query).map((post) => post.href);

test("search projection excludes bodies and unrelated fields", () => {
  const documents = blogSearchDocuments(posts);
  assert.equal(JSON.stringify(documents).includes("PRIVATE_"), false);
  assert.equal(documents[0].content, undefined);
  assert.deepEqual(find("PRIVATE_BODY_SENTINEL"), []);
});
test("search supports Unicode, accents, case, tags, subtitles and excerpts", () => {
  assert.deepEqual(find("ＣＡＦＥ"), ["/blogs/two", "/blogs/one"]);
  assert.deepEqual(find("设计"), ["/blogs/two"]);
  assert.deepEqual(find("排版"), ["/blogs/two"]);
  assert.deepEqual(find("UI"), ["/blogs/one"]);
  assert.deepEqual(find("C++"), ["/blogs/two"]);
});
test("all terms must match; matching is literal and empty input preserves order", () => {
  assert.deepEqual(find(" cafe   UI "), ["/blogs/one"]);
  assert.deepEqual(find("cafe nonexistent"), []);
  assert.deepEqual(find(".*"), []);
  assert.deepEqual(find("  "), ["/blogs/one", "/blogs/two"]);
  assert.deepEqual(searchBlogPosts(indexBlogSearch([]), "hello"), []);
});
