import assert from "node:assert/strict";
import test from "node:test";
import {
  isDocumentationOnlyPath,
  requiresFullValidation,
} from "../scripts/ci-impact.mjs";

test("documentation-only CI paths stay on the lightweight required-check path", () => {
  for (const file of [
    "docs/VISUAL-QA.md",
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "AGENTS.md",
    "CLAUDE.md",
    "LICENSE",
    "content/blogs/_README.md",
    "content/assets/portfolio/README.md",
  ]) {
    assert.equal(isDocumentationOnlyPath(file), true, file);
  }

  assert.equal(
    requiresFullValidation(
      ["docs/VISUAL-QA.md", "README.md", "CONTRIBUTING.md"],
      "pull_request",
    ),
    false,
  );
});

test("CI impact classification fails closed for runtime, author content and workflow changes", () => {
  for (const file of [
    "src/app/page.tsx",
    "portfolio.json",
    "content/blogs/post.md",
    "content/assets/portfolio/profile/portrait.webp",
    "governance/branch-policy.json",
    "package.json",
    ".github/workflows/ci.yml",
  ]) {
    assert.equal(requiresFullValidation([file], "pull_request"), true, file);
  }

  assert.equal(requiresFullValidation([], "pull_request"), true);
  assert.equal(requiresFullValidation(["docs/README.md"], "push"), true);
});
