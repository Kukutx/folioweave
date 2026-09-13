import assert from "node:assert/strict";
import test from "node:test";
import {
  isDocumentationOnlyPath,
  requiresFullValidation,
  vercelIgnoreExitCode,
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

test("Vercel ignore semantics skip documentation only and fail closed otherwise", () => {
  assert.equal(vercelIgnoreExitCode(["docs/VISUAL-QA.md"]), 0);
  assert.equal(
    vercelIgnoreExitCode(["README.md", "content/blogs/_README.md"]),
    0,
  );
  assert.equal(vercelIgnoreExitCode(["src/app/page.tsx"]), 1);
  assert.equal(vercelIgnoreExitCode([]), 1);
});
