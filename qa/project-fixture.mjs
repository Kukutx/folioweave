import fs from "node:fs/promises";
import path from "node:path";
import { updateProfile } from "../scripts/profile-edit.mjs";
import { publishContent } from "../scripts/content-build.mjs";
import { qaTempRoot } from "./temp-directory.mjs";

function assertFixture(root) {
  if (path.dirname(path.resolve(root)) !== qaTempRoot)
    throw new Error("Not an owned QA fixture");
}
// CI variables describe the real checkout, never these disposable projects.
export function publishFixture(prepared, root, options) {
  assertFixture(root);
  return publishContent(prepared, root, {
    targetBranch: "snapshot",
    ...options,
  });
}
export function updateFixture(root, transform, options) {
  assertFixture(root);
  return updateProfile(root, transform, {
    ...options,
    publicationOptions: { targetBranch: "snapshot" },
  });
}

/** Seed target-owned definitions explicitly; tests must not borrow the caller's catalog. */
export async function seedProjectDefinitions(target) {
  const root = path.resolve(import.meta.dirname, "..");
  for (const relative of [
    "src/templates",
    "src/plugins",
    "src/portfolio/routes.json",
    "governance",
  ]) {
    await fs.mkdir(path.dirname(path.join(target, relative)), {
      recursive: true,
    });
    await fs.cp(path.join(root, relative), path.join(target, relative), {
      recursive: true,
    });
  }
}
