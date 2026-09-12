import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateProfileBoundary,
  loadBranchPolicy,
} from "./profile-boundary.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = loadBranchPolicy(root);
const portfolio = JSON.parse(
  fs.readFileSync(path.join(root, policy.profileConfig), "utf8"),
);
const boundary = evaluateProfileBoundary(root, portfolio);
const { targetBranch: branch, core, personal } = boundary;
const errors = [...boundary.errors];

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const hasGitMetadata = fs.existsSync(path.join(root, ".git"));

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function isPersonalOnly(file) {
  if (policy.sharedExceptions.includes(file)) return false;
  if (policy.profileSpecificFiles.includes(file)) return true;
  return policy.personalOnlyPrefixes.some((prefix) => file.startsWith(prefix));
}

if (core) {
  const leaked = [
    ...walk(path.join(root, "content", "blogs")),
    ...walk(path.join(root, "content", "assets", "portfolio")),
    ...walk(path.join(root, "public", "portfolio")),
    ...walk(path.join(root, "qa", "baselines", "personal")),
  ]
    .map(relative)
    .filter(isPersonalOnly);
  if (leaked.length) {
    errors.push(
      `Personal-only files are present on ${branch}: ${leaked.join(", ")}`,
    );
  }
}

let changedFiles = [];
if (hasGitMetadata) {
  try {
    const tracked = git("diff", "--name-only", "develop", "--")
      .split(/\r?\n/)
      .filter(Boolean);
    const untracked = git("ls-files", "--others", "--exclude-standard")
      .split(/\r?\n/)
      .filter(Boolean);
    changedFiles = [...new Set([...tracked, ...untracked])].sort();
  } catch {
    changedFiles = git("status", "--short")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.slice(3));
  }
}

const report = {
  targetBranch: branch,
  policy: core ? "core" : personal ? "personal" : "feature",
  sharedChanges: changedFiles.filter((file) => !isPersonalOnly(file)),
  profileChanges: changedFiles.filter((file) => isPersonalOnly(file)),
  errors,
};
fs.writeFileSync(
  path.join(root, "qa", "branch-boundary-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

if (errors.length) {
  console.error("Branch boundary check failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Branch boundary OK — ${branch || "detached"} uses the ${report.policy} policy; ` +
      `${report.sharedChanges.length} shared and ${report.profileChanges.length} profile-specific changed paths classified.`,
  );
}
