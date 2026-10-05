import assert from "node:assert/strict";
import test from "node:test";
import {
  assignHeadingIds,
  buildTagIndex,
  tagHref,
  taxonomyRoutes,
  taxonomySlug,
} from "../src/blog/taxonomy.mjs";

const post = (slug, date, tags) => ({ href: `/blogs/${slug}`, date, tags });

test("slugs keep letters and digits of any script and nothing else", () => {
  assert.equal(taxonomySlug("For Designers"), "for-designers");
  assert.equal(taxonomySlug("  Node.js / React  "), "node-js-react");
  assert.equal(taxonomySlug("Café au lait"), "cafe-au-lait");
  assert.equal(taxonomySlug("设计"), "设计");
  assert.equal(taxonomySlug("!!!"), "");
});

test("a plus or hash attached to a name keeps sibling tags apart", () => {
  assert.deepEqual(["C", "C++", "C#"].map(taxonomySlug), [
    "c",
    "c-plus-plus",
    "c-sharp",
  ]);
  // A free-standing symbol is punctuation, not part of a name.
  assert.equal(taxonomySlug("Step #1"), "step-1");
});

test("tags group their posts newest first and are ordered by label", () => {
  const tags = buildTagIndex([
    post("old", "2026-01-01", ["Design", "Engineering"]),
    post("new", "2026-09-01", ["Engineering"]),
    post("untagged", "2026-05-01", []),
  ]);
  assert.deepEqual(
    tags.map((tag) => [tag.label, tag.href, tag.posts.map((item) => item.href)]),
    [
      ["Design", "/blogs/tag/design", ["/blogs/old"]],
      ["Engineering", "/blogs/tag/engineering", ["/blogs/new", "/blogs/old"]],
    ],
  );
  assert.equal(tagHref("Engineering"), tags[1].href);
});

test("tag routes exist only for tags that are in use", () => {
  assert.deepEqual(taxonomyRoutes([]), []);
  assert.deepEqual(taxonomyRoutes([post("a", "2026-01-01", [])]), []);
  assert.deepEqual(taxonomyRoutes([post("a", "2026-01-01", ["iOS", "ELI5"])]), [
    "/blogs/tag/eli5",
    "/blogs/tag/ios",
  ]);
});

test("tags that cannot have a page of their own are rejected", () => {
  assert.throws(
    () =>
      buildTagIndex([
        post("a", "2026-01-01", ["Design"]),
        post("b", "2026-01-02", ["design"]),
      ]),
    /"Design" and "design" would share the page \/blogs\/tag\/design/,
  );
  assert.throws(
    () => buildTagIndex([post("a", "2026-01-01", ["!!!"])]),
    /Tag "!!!" on \/blogs\/a has no letters or digits/,
  );
});

test("heading anchors are unique within an article", () => {
  assert.deepEqual(
    assignHeadingIds([
      { depth: 2, text: "Setup" },
      { depth: 3, text: "Setup" },
      { depth: 2, text: "???" },
      { depth: 2, text: "Setup" },
    ]),
    [
      { depth: 2, text: "Setup", id: "setup" },
      { depth: 3, text: "Setup", id: "setup-2" },
      { depth: 2, text: "???", id: "section" },
      { depth: 2, text: "Setup", id: "setup-3" },
    ],
  );
});
