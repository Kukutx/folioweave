import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateProfileBoundary,
  loadBranchPolicy,
  sharedBaseCandidates,
} from "./profile-boundary.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = loadBranchPolicy(root);
const portfolio = JSON.parse(
  fs.readFileSync(path.join(root, policy.profileConfig), "utf8"),
);
const boundary = evaluateProfileBoundary(root, portfolio);
const { targetBranch: branch, core, personal } = boundary;
const errors = [...boundary.errors];
for (const file of policy.sharedExceptions) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`Branch policy shared exception does not exist: ${file}.`);
  }
}

function git(...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

const hasGitMetadata = fs.existsSync(path.join(root, ".git"));

function gitRefExists(ref) {
  if (!hasGitMetadata || !ref) return false;
  try {
    git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

function resolveDiffBase() {
  if (!hasGitMetadata) return null;
  return (
    sharedBaseCandidates({ personal, core, branch }).find(gitRefExists) ?? null
  );
}

const projectName = path.basename(root);
const projectNameLower = projectName.toLowerCase();
const siblingResidue = fs
  .readdirSync(path.dirname(root), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== projectName)
  .map((entry) => entry.name)
  .filter((name) => {
    const lower = name.toLowerCase();
    return (
      lower.startsWith(`${projectNameLower}-`) ||
      lower.startsWith(`.${projectNameLower}-`)
    );
  });
if (siblingResidue.length) {
  errors.push(
    `Sibling FolioWeave workspace residue is forbidden: ${siblingResidue.join(", ")}. Keep exactly one top-level project directory.`,
  );
}

if (hasGitMetadata) {
  const normalizeWorkspacePath = (value) => {
    const resolved = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  const normalizedRoot = normalizeWorkspacePath(root);
  const externalWorktrees = git("worktree", "list", "--porcelain")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)))
    .filter((worktree) => normalizeWorkspacePath(worktree) !== normalizedRoot);
  if (externalWorktrees.length) {
    errors.push(
      `Additional Git worktrees are forbidden: ${externalWorktrees.join(", ")}. Keep FolioWeave in one project directory.`,
    );
  }
}

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
    ...walk(path.join(root, "content", "resume")),
    ...walk(path.join(root, "content", "assets", "portfolio")),
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

const sharedBase = resolveDiffBase();
let changedFiles = [];
if (hasGitMetadata) {
  const untracked = git("ls-files", "--others", "--exclude-standard")
    .split(/\r?\n/)
    .filter(Boolean);
  if (sharedBase) {
    const tracked = git("diff", "--name-only", sharedBase, "--")
      .split(/\r?\n/)
      .filter(Boolean);
    changedFiles = [...new Set([...tracked, ...untracked])].sort();
  } else {
    const workingTree = git("status", "--short")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.slice(3));
    changedFiles = [...new Set([...workingTree, ...untracked])].sort();
  }
}

const sharedChanges = changedFiles.filter((file) => !isPersonalOnly(file));
const profileChanges = changedFiles.filter((file) => isPersonalOnly(file));
// Vercel clones only the branch it deploys and modifies files while it
// installs, so its checkout cannot be compared with main. The profile guard
// still applies to that build; convergence with main is enforced by the
// required GitHub checks before anything reaches the branch.
const convergenceLeftToCi = personal && Boolean(process.env.VERCEL);
if (personal && !sharedBase && !convergenceLeftToCi) {
  errors.push(
    "Cannot verify personal/shared convergence because no main reference is available. Fetch origin/main before running the boundary check.",
  );
}
if (personal && sharedChanges.length && !convergenceLeftToCi) {
  errors.push(
    `${policy.personalBranch} differs from ${sharedBase} outside the profile-owned paths: ${sharedChanges.join(", ")}. Merge main into the branch if it is behind; promote changes that exist only here through develop -> main first.`,
  );
}

const report = {
  targetBranch: branch,
  policy: core ? "core" : personal ? "personal" : "feature",
  sharedBase,
  sharedChanges,
  profileChanges,
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
      `${report.sharedChanges.length} shared and ${report.profileChanges.length} profile-specific changed paths classified` +
      `${sharedBase ? ` against ${sharedBase}` : ""}.` +
      `${convergenceLeftToCi ? " Convergence with main is not verifiable in this checkout and is left to the required GitHub checks." : ""}`,
  );
}
