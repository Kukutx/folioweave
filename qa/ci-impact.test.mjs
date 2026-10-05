import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  changedFilesBetween,
  isDocumentationOnlyPath,
  requiresFullValidation,
  vercelChanges,
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
    "content/resume/README.md",
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
    "content/resume/resume.json",
    "content/resume/resume.example.json",
    "resume.schema.json",
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

test("only added or modified documentation takes the fast path", () => {
  const docs = (status, file) => requiresFullValidation([{ status, file }]);
  assert.equal(docs("A", "docs/NEW.md"), false);
  assert.equal(docs("M", "README.md"), false);
  // The boundary check requires these shared files to exist.
  assert.equal(docs("D", "content/resume/README.md"), true);
  assert.equal(docs("D", "docs/OLD.md"), true);
  // A rename is reported as both sides, so its source cannot hide.
  assert.equal(
    requiresFullValidation([
      { status: "D", file: "content/resume/resume.example.json" },
      { status: "A", file: "docs/resume.example.json" },
    ]),
    true,
  );
});

test("the Vercel comparison starts from the last deployed commit when known", () => {
  const seen = [];
  const diff = (base) => {
    seen.push(base);
    return [{ status: "M", file: "README.md" }];
  };
  assert.deepEqual(vercelChanges({ VERCEL_GIT_PREVIOUS_SHA: "abc123" }, diff), [
    { status: "M", file: "README.md" },
  ]);
  vercelChanges({}, diff);
  assert.deepEqual(seen, ["abc123", "HEAD^"]);
});

test("an unreadable deployed commit proceeds with the build, not with a guess", () => {
  const seen = [];
  const unavailable = (base) => {
    seen.push(base);
    throw new Error(`bad revision ${base}`);
  };
  // Falling back to HEAD^ here could skip a build whose earlier commits were
  // never deployed; null makes the ignore step build.
  assert.equal(
    vercelChanges({ VERCEL_GIT_PREVIOUS_SHA: "abc123" }, unavailable),
    null,
  );
  assert.deepEqual(seen, ["abc123"]);
});

test("the classifier reads both sides of a rename from git", (t) => {
  const repository = fs.mkdtempSync(
    path.join(os.tmpdir(), "folioweave-ci-impact-"),
  );
  // This file runs in prebuild, where Git may be absent (a project copied
  // without its history) or configured to sign and hook every commit. An empty
  // file stands in for the user's configuration.
  const emptyConfig = path.join(repository, "empty.gitconfig");
  fs.writeFileSync(emptyConfig, "");
  const run = (...args) =>
    execFileSync(
      "git",
      ["-c", "user.name=qa", "-c", "user.email=qa@example.com", ...args],
      {
        cwd: repository,
        stdio: "pipe",
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: emptyConfig,
          GIT_CONFIG_NOSYSTEM: "1",
        },
      },
    );
  try {
    try {
      run("--version");
    } catch {
      t.skip("git is not available");
      return;
    }
    run("init", "--quiet");
    fs.mkdirSync(path.join(repository, "content"));
    fs.mkdirSync(path.join(repository, "docs"));
    fs.writeFileSync(path.join(repository, "content/source.json"), "{}\n");
    run("add", "content");
    run("commit", "--quiet", "-m", "add");
    run("mv", "content/source.json", "docs/source.json");
    run("commit", "--quiet", "-m", "move");
    const changes = changedFilesBetween("HEAD^", "HEAD", repository);
    assert.deepEqual(changes, [
      { status: "D", file: "content/source.json" },
      { status: "A", file: "docs/source.json" },
    ]);
    assert.equal(requiresFullValidation(changes), true);
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
});

test("only the fast-path notices are skipped by default; every other gated step runs", () => {
  const workflow = fs.readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const gated = workflow
    .split(/\n {6}- /)
    .filter((step) => step.includes("impact.outputs.full"));
  assert.ok(gated.length >= 12, "expected gated workflow steps in both jobs");
  let notices = 0;
  for (const step of gated) {
    const condition = step.match(/^\s*if: (.+)$/m)[1].trim();
    if (step.includes('run: echo "Documentation-only')) {
      notices += 1;
      assert.equal(condition, "steps.impact.outputs.full == 'false'", step);
    } else
      assert.match(
        condition,
        /^(failure\(\) && )?steps\.impact\.outputs\.full != 'false'$/,
        `a missing classification must not skip this step:\n${step}`,
      );
  }
  assert.equal(notices, 2, "one fast-path notice per job");
});

test("workflow actions are GitHub-owned and pinned to immutable SHAs", () => {
  const workflow = fs.readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const actionUses = [
    ...workflow.matchAll(/^\s*- uses:\s*([^\s#]+)(?:\s+#.*)?$/gm),
  ].map(([, action]) => action);

  assert.ok(actionUses.length > 0, "workflow must contain external actions");
  for (const action of actionUses) {
    const match = action.match(/^([^/]+)\/([^@]+)@([0-9a-f]{40})$/);
    assert.ok(match, `action must be pinned to a 40-character SHA: ${action}`);
    assert.equal(match[1], "actions", `action must be GitHub-owned: ${action}`);
  }
});
