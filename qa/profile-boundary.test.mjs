import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { qaTempRoot } from "./temp-directory.mjs";
import { assertProjectPublicationAllowed } from "../scripts/content-build.mjs";
import {
  assertProfilePublicationAllowed,
  evaluateProfileBoundary,
  loadBranchPolicy,
  profileOwnedFiles,
  resolveBoundaryTarget,
  sharedBaseCandidates,
} from "../scripts/profile-boundary.mjs";
import {
  extensionOutputs,
  loadCatalog,
  resolveExtensions,
} from "../src/core/extensions.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demo = JSON.parse(
  fs.readFileSync(path.join(root, "governance", "demo-portfolio.json"), "utf8"),
);

test("Git-free canonical snapshots cannot override an explicit personal deployment", () => {
  const snapshot = fs.mkdtempSync(path.join(qaTempRoot, "profile-policy-"));
  try {
    fs.cpSync(path.join(root, "governance"), path.join(snapshot, "governance"), { recursive: true });
    assert.equal(fs.existsSync(path.join(snapshot, ".git")), false);
    const standalone = evaluateProfileBoundary(snapshot, demo, { targetBranch: "snapshot" });
    assert.equal(standalone.core, true);
    assert.deepEqual(standalone.errors, []);
    const deployed = evaluateProfileBoundary(snapshot, demo, { targetBranch: "personal" });
    assert.equal(deployed.core, false);
    assert.equal(deployed.personal, true);
    assert.throws(() => assertProfilePublicationAllowed(snapshot, demo, { targetBranch: "personal" }), /Profile publication blocked for personal/);
  } finally {
    fs.rmSync(snapshot, { recursive: true, force: true });
  }
});

test("profile boundary keeps core and personal publication roles distinct", () => {
  assert.deepEqual(
    evaluateProfileBoundary(root, demo, { targetBranch: "main" }).errors,
    [],
  );

  const personalResult = evaluateProfileBoundary(root, demo, {
    targetBranch: "personal",
  });
  assert.ok(personalResult.errors.length >= 1);
  assert.match(
    personalResult.errors.join("\n"),
    /refusing to publish|cannot publish/,
  );

  const personal = structuredClone(demo);
  personal.features.demoRoutes = false;
  personal.site.identity.name = "Personal Author";
  assert.deepEqual(
    evaluateProfileBoundary(root, personal, { targetBranch: "personal" })
      .errors,
    [],
  );
  assert.throws(
    () =>
      assertProfilePublicationAllowed(root, personal, { targetBranch: "main" }),
    /Profile publication blocked/,
  );
});

test("the guarded branch is the deployed one, not the checkout's local name", () => {
  // A Vercel production build of personal has a local branch called master.
  // A directory without Git metadata keeps this checkout's own branch out of
  // the answer.
  const checkout = os.tmpdir();
  assert.equal(resolveBoundaryTarget(checkout, {}), "snapshot");
  assert.equal(
    resolveBoundaryTarget(checkout, { VERCEL_GIT_COMMIT_REF: "personal" }),
    "personal",
  );
  // GitHub's own refs and an explicit override keep their precedence.
  assert.equal(
    resolveBoundaryTarget(root, {
      GITHUB_BASE_REF: "main",
      GITHUB_REF_NAME: "42/merge",
      VERCEL_GIT_COMMIT_REF: "develop",
    }),
    "main",
  );
  assert.equal(
    resolveBoundaryTarget(root, {
      BOUNDARY_TARGET: "personal",
      GITHUB_BASE_REF: "main",
    }),
    "personal",
  );
  assert.throws(
    () =>
      assertProfilePublicationAllowed(root, demo, {
        targetBranch: resolveBoundaryTarget(root, {
          VERCEL_GIT_COMMIT_REF: "personal",
        }),
      }),
    /Profile publication blocked for personal/,
  );
});

test("the personalization wizard refuses a core branch before it asks or writes anything", () => {
  const before = fs.readFileSync(path.join(root, "portfolio.json"), "utf8");
  const wizard = spawnSync(
    process.execPath,
    [path.join(root, "scripts/personalize.mjs"), "--defaults"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BOUNDARY_TARGET: "main" },
    },
  );
  assert.equal(wizard.status, 1);
  assert.match(wizard.stderr, /keeps its demo profile on main/);
  assert.match(wizard.stderr, /git switch -c personal/);
  assert.equal(wizard.stdout, "");
  assert.equal(
    fs.readFileSync(path.join(root, "portfolio.json"), "utf8"),
    before,
  );
});

test("the personal tree is compared with main, also in a pull request into personal", () => {
  // A main sync opened as a pull request into personal sets the base ref to
  // personal. Diffing against that base would flag every synced shared file.
  assert.deepEqual(
    sharedBaseCandidates({
      personal: true,
      core: false,
      branch: "personal",
      env: { GITHUB_BASE_REF: "personal" },
    }),
    ["origin/main", "main"],
  );
  assert.deepEqual(
    sharedBaseCandidates({
      personal: true,
      core: false,
      branch: "personal",
      env: { BOUNDARY_SHARED_BASE: "upstream/main" },
    }),
    ["upstream/main", "origin/main", "main"],
  );
  // Shared pull requests keep comparing with their own base.
  assert.deepEqual(
    sharedBaseCandidates({
      personal: false,
      core: true,
      branch: "main",
      env: { GITHUB_BASE_REF: "main" },
    }),
    ["origin/main", "main"],
  );
  assert.deepEqual(
    sharedBaseCandidates({
      personal: false,
      core: true,
      branch: "develop",
      env: {},
    }),
    ["origin/develop", "develop"],
  );
  assert.deepEqual(
    sharedBaseCandidates({
      personal: false,
      core: false,
      branch: "feature",
      env: {},
    }),
    ["develop", "origin/develop", "main", "origin/main"],
  );
});

test("content build blocks demo publication before generated output replacement", () => {
  const generated = path.join(root, "src", "portfolio", "config.generated.ts");
  const before = fs.readFileSync(generated, "utf8");

  assert.throws(
    () =>
      assertProjectPublicationAllowed({ config: demo }, root, {
        targetBranch: "personal",
      }),
    /Profile publication blocked/,
  );

  assert.equal(
    fs.readFileSync(generated, "utf8"),
    before,
    "blocked publication still changed generated profile output",
  );
});

test("selecting any template or plugin rewrites only profile-owned files", () => {
  const policy = loadBranchPolicy(root);
  const owned = profileOwnedFiles(policy);
  const catalog = loadCatalog(root);
  for (const file of policy.profileSpecificFiles)
    assert.ok(
      fs.existsSync(path.join(root, file)),
      `Branch policy names a file nothing produces: ${file}`,
    );
  for (const template of catalog.templates) {
    const profile = structuredClone(demo);
    profile.template = { id: template.id, settings: {} };
    profile.plugins = {};
    const outputs = extensionOutputs(resolveExtensions(profile, catalog));
    assert.ok(outputs.length > 2);
    for (const { target } of outputs)
      assert.ok(
        owned.includes(target),
        `${template.id} rewrites ${target}, which the personal branch may not change`,
      );
  }
});
