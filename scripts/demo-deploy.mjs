#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { prepareRefractFixture } from "../qa/refract-fixture.mjs";

// The public Refract demos are built from governance/templates/, never from an
// author profile. Each is an isolated snapshot uploaded to its own Vercel
// project, so redeploying one cannot touch portfolio.json or a personal site.
const args = process.argv.slice(2);
const style = args.find((arg) => !arg.startsWith("--"));
const preview = args.includes("--preview");
const usage =
  "Usage: npm run demo:deploy -- <light|dark> [--preview]\n\nRequires the Vercel CLI, signed in to the account that owns the demo projects.";
if (
  !["light", "dark"].includes(style) ||
  args.some((arg) => arg.startsWith("--") && arg !== "--preview")
) {
  console.error(usage);
  process.exit(1);
}

const project = `folioweave-refract-${style}`;
const run = (cwd, ...command) => {
  const child = spawnSync(command.join(" "), {
    cwd,
    stdio: "inherit",
    shell: true,
  });
  if (child.status !== 0)
    throw new Error(`${command.slice(0, 2).join(" ")} failed`);
};

const fixture = await prepareRefractFixture({
  style,
  prefix: "refract-deploy-",
  linkDependencies: false,
});
try {
  await fs.writeFile(
    path.join(fixture.directory, ".vercelignore"),
    ".generated/\n.next/\nnode_modules/\n.git/\n",
  );
  run(fixture.directory, "vercel", "link", "--yes", "--project", project);
  run(
    fixture.directory,
    "vercel",
    "deploy",
    "--yes",
    ...(preview ? [] : ["--prod"]),
  );
  console.log(
    preview
      ? `Preview of ${project} deployed.`
      : `${project} deployed to ${fixture.profile.site.origin}.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await fixture.cleanup();
}
