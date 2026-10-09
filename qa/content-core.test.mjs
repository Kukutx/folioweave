import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { qaTempRoot } from "./temp-directory.mjs";
import path from "node:path";
import test from "node:test";
import { parseFrontmatter } from "../src/blog/frontmatter.mjs";
import {
  BlogContentError,
  loadMarkdownBlogPosts,
  normalizeCustomBlogPosts,
  publishedMarkdownBlogPosts,
} from "../src/blog/content-core.mjs";

async function withBlogs(files, run) {
  const directory = await fs.mkdtemp(
    path.join(qaTempRoot, "folioweave-blogs-"),
  );
  try {
    await Promise.all(
      Object.entries(files).map(([name, contents]) =>
        fs.writeFile(path.join(directory, name), contents, "utf8"),
      ),
    );
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("YAML frontmatter retains multiline text, CRLF, BOM and Markdown rules", () => {
  const result = parseFrontmatter('\uFEFF---\r\ntitle: "A: title"\r\ndescription: |\r\n  First line\r\n  第二行\r\ntags: [One, Two]\r\ndraft: false\r\n---\r\nBody\r\n\r\n---\r\nMore');
  assert.equal(result.data.title, "A: title");
  assert.equal(result.data.description, "First line\n第二行\n");
  assert.deepEqual(result.data.tags, ["One", "Two"]);
  assert.equal(result.data.draft, false);
  assert.equal(result.content, "Body\r\n\r\n---\r\nMore");
  assert.throws(() => parseFrontmatter("---\ntitle: unclosed\n"), /closing/);
  assert.throws(() => parseFrontmatter("---\n- array\n---\nBody"), /mapping/);
  assert.throws(() => parseFrontmatter("---\ntitle: One\ntitle: Two\n---\nBody"), /duplicated/);
  assert.throws(() => parseFrontmatter("---\ntitle: !!js/function function() {}\n---\nBody"), /unknown tag/);
});

test("Markdown posts are normalized, filtered, and sorted", async () => {
  await withBlogs(
    {
      "older.md": `---\ntitle: Older\ndate: 2026-01-01\ndescription: Older post\ntags: [Engineering, Engineering]\n---\n\n## Start\n\nBody text.`,
      "newer.md": `---\ntitle: Newer\ndate: 2026-09-07\ndescription: Newer post\n---\n\n## Start\n\n![Diagram](/portfolio/profile/hero-portrait-01.png)`,
      "draft.md": `---\ntitle: Draft\ndate: 2026-12-01\ndescription: Draft post\ndraft: true\n---\n\n## Start\n\nHidden.`,
    },
    (blogsDir) => {
      const loaded = loadMarkdownBlogPosts({ blogsDir });
      assert.equal(loaded.posts.length, 3);
      const published = publishedMarkdownBlogPosts(loaded.posts);
      assert.deepEqual(
        published.map((post) => post.slug),
        ["newer", "older"],
      );
      assert.deepEqual(published[1].tags, ["Engineering"]);
      assert.equal(published[0].readingMinutes, 1);
    },
  );
});

test("Markdown posts carry the outline of their sections", async () => {
  await withBlogs(
    {
      "outline.md": `---\ntitle: Outline\ndate: 2026-01-01\ndescription: Outline post\n---\n\n## Using \`fetch\` *well*\n\nText.[^1]\n\n### Details\n\n#### Too deep\n\n> ## Details\n\n[^1]: Note.\n\n    ## Inside a footnote`,
    },
    (blogsDir) => {
      const [published] = publishedMarkdownBlogPosts(
        loadMarkdownBlogPosts({ blogsDir }).posts,
      );
      assert.deepEqual(published.headings, [
        { depth: 2, text: "Using fetch well", id: "using-fetch-well" },
        { depth: 3, text: "Details", id: "details" },
        { depth: 2, text: "Details", id: "details-2" },
      ]);
    },
  );
});

test("Markdown validation rejects ambiguous routes and unsafe content", async () => {
  await withBlogs(
    {
      "reserved.md": `---\ntitle: Reserved\ndate: 2026-02-30\ndescription: Invalid\nunknown: true\n---\n\n# Duplicate title\n\n![Remote](https://example.com/image.png)`,
    },
    (blogsDir) => {
      assert.throws(
        () => loadMarkdownBlogPosts({ blogsDir, reservedSlugs: ["reserved"] }),
        (error) => {
          assert.ok(error instanceof BlogContentError);
          assert.match(
            error.message,
            /conflicts with a registered custom blog/i,
          );
          assert.match(error.message, /not a valid calendar date/i);
          assert.match(error.message, /unknown frontmatter field/i);
          assert.match(error.message, /level-one Markdown heading/i);
          assert.match(error.message, /local public path/i);
          return true;
        },
      );
    },
  );
});

test("Markdown images reject noncanonical and non-image URLs before rendering", async () => {
  for (const image of [
    "//example.com/a.png",
    "/image.png?v=1",
    "/file.pdf",
    "/missing",
    "/%2e%2e/image.png",
  ]) {
    await withBlogs(
      {
        "image.md": `---\ntitle: Image\ndate: 2026-01-01\ndescription: Test\ncover: ${image}\n---\n\n![Image](${image})`,
      },
      (blogsDir) => {
        assert.throws(
          () => loadMarkdownBlogPosts({ blogsDir }),
          /image|path/i,
          image,
        );
      },
    );
  }
});

test("Markdown dependencies include inline and reference download links", async () => {
  await withBlogs(
    {
      "links.md": `---\ntitle: Links\ndate: 2026-01-01\ndescription: Test\n---\n\n[Download](/portfolio/guide.pdf#page=2) and [reference][file].\n\n[file]: /portfolio/notes.pdf`,
    },
    (blogsDir) => {
      const { posts } = loadMarkdownBlogPosts({ blogsDir });
      assert.deepEqual(posts[0].bodyLinks, [
        "/portfolio/guide.pdf#page=2",
        "/portfolio/notes.pdf",
      ]);
      assert.equal(publishedMarkdownBlogPosts(posts)[0].bodyLinks, undefined);
    },
  );
});


test("custom blog displayDate is explicit presentation data", () => {
  const [post] = normalizeCustomBlogPosts([
    {
      slug: "example",
      title: "Example",
      date: "2026-01-26",
      displayDate: "Jan 26, 2026",
      description: "Example post",
      tags: [],
      readingMinutes: 1,
    },
  ]);
  assert.equal(post.date, "2026-01-26");
  assert.equal(post.displayDate, "Jan 26, 2026");
  assert.throws(
    () =>
      normalizeCustomBlogPosts([
        {
          slug: "bad",
          title: "Bad",
          date: "2026-01-26",
          displayDate: 123,
          description: "Bad post",
          tags: [],
          readingMinutes: 1,
        },
      ]),
    /displayDate must be a non-empty string/,
  );
});
