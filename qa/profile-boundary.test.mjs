import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertProjectPublicationAllowed } from "../scripts/content-build.mjs";
import {
  assertProfilePublicationAllowed,
  evaluateProfileBoundary,
} from "../scripts/profile-boundary.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demo = JSON.parse(
  fs.readFileSync(path.join(root, "governance", "demo-portfolio.json"), "utf8"),
);

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
