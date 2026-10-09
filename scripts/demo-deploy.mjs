#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { prepareRefractFixture } from "../qa/refract-fixture.mjs";
import { prepareContent, publishContent } from "./content-build.mjs";
import { loadBranchPolicy, profileOwnedFiles } from "./profile-boundary.mjs";
import { demoOrigin, demoProjects } from "./demo-targets.mjs";

// The public demos are built from the repository's demo profiles, never from an
// author profile. Each is an isolated snapshot uploaded to its own Vercel
// project, so redeploying one cannot touch portfolio.json or a personal site.
const root = path.resolve(import.meta.dirname, "..");
const demos = demoProjects;
const args = process.argv.slice(2);
const name = args.find((arg) => !arg.startsWith("--"));
const preview = args.includes("--preview");
if (
  !Object.hasOwn(demos, name ?? "") ||
  args.some((arg) => arg.startsWith("--") && arg !== "--preview")
) {
  console.error(
    "Usage: npm run demo:deploy -- <classic|light|dark> [--preview]\n\nRequires the Vercel CLI, signed in (or VERCEL_TOKEN set) for the account that owns the demo projects.",
  );
  process.exit(1);
}
const project = demos[name];
const origin = demoOrigin(name);

/** The shared tree at its demo profile: no author content, media or generated profile output. */
async function prepareClassicSnapshot() {
  const policy = loadBranchPolicy(root);
  const owned = new Set(profileOwnedFiles(policy));
  const temporaryRoot = path.join(root, ".generated");
  await fs.mkdir(temporaryRoot, { recursive: true });
  const directory = await fs.mkdtemp(
    path.join(temporaryRoot, "classic-deploy-"),
  );
  const cleanup = async () => {
    const resolved = path.resolve(directory);
    if (
      path.dirname(resolved) !== temporaryRoot ||
      !path.basename(resolved).startsWith("classic-deploy-")
    )
      throw new Error("Refusing cleanup outside the owned demo snapshot.");
    await fs.rm(resolved, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    });
  };
  try {
    const files = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    )
      .split("\0")
      .filter(Boolean);
    for (const file of files) {
      const authorOwned =
        !policy.sharedExceptions.includes(file) &&
        (owned.has(file) ||
          policy.personalOnlyPrefixes.some((prefix) =>
            file.startsWith(prefix),
          ));
      if (authorOwned || file.startsWith("qa/baselines/")) continue;
      const source = path.join(root, file);
      if (!(await fs.stat(source).catch(() => null))?.isFile()) continue;
      await fs.mkdir(path.dirname(path.join(directory, file)), {
        recursive: true,
      });
      await fs.copyFile(source, path.join(directory, file));
    }
    const profile = JSON.parse(
      await fs.readFile(path.join(root, policy.demoProfile), "utf8"),
    );
    profile.site.origin = origin;
    profile.$schema = "./portfolio.schema.json";
    await fs.writeFile(
      path.join(directory, policy.profileConfig),
      JSON.stringify(profile, null, 2) + "\n",
    );
    // Publish through the real guard, as a Git-free snapshot with its own identity.
    const prepared = await prepareContent(directory);
    await publishContent(prepared, directory, { targetBranch: "snapshot" });
    return { directory, profile, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

const run = (cwd, ...command) => {
  const child = spawnSync(command.join(" "), {
    cwd,
    stdio: "inherit",
    shell: true,
  });
  if (child.status !== 0)
    throw new Error(`${command.slice(0, 2).join(" ")} failed`);
};

const snapshot =
  name === "classic"
    ? await prepareClassicSnapshot()
    : await prepareRefractFixture({
        style: name,
        origin,
        prefix: "refract-deploy-",
        linkDependencies: false,
      });
try {
  await fs.writeFile(
    path.join(snapshot.directory, ".vercelignore"),
    ".generated/\n.next/\nnode_modules/\n.git/\nqa/screens/\nqa/baselines/\n",
  );
  // CI authenticates with a token; a maintainer's machine uses its own login.
  const scope = [
    ...(process.env.VERCEL_SCOPE ? ["--scope", process.env.VERCEL_SCOPE] : []),
    ...(process.env.VERCEL_TOKEN ? ["--token", process.env.VERCEL_TOKEN] : []),
  ];
  run(
    snapshot.directory,
    "vercel",
    "link",
    "--yes",
    "--project",
    project,
    ...scope,
  );
  run(
    snapshot.directory,
    "vercel",
    "deploy",
    "--yes",
    ...(preview ? [] : ["--prod"]),
    ...scope,
  );
  console.log(
    preview
      ? `Preview of ${project} deployed.`
      : `${project} deployed to ${origin}.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await snapshot.cleanup();
}
