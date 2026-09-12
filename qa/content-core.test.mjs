import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  BlogContentError,
  loadMarkdownBlogPosts,
  normalizeCustomBlogPosts,
  publishedMarkdownBlogPosts,
} from "../src/blog/content-core.mjs";

async function withBlogs(files, run) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "folioweave-blogs-"),
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
