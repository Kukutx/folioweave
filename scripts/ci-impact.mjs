import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const documentationOnlyFiles = new Set([
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "AGENTS.md",
  "CLAUDE.md",
  "LICENSE",
  "content/blogs/_README.md",
  "content/resume/README.md",
  "content/assets/portfolio/README.md",
]);

export function isDocumentationOnlyPath(file) {
  return (
    (file.startsWith("docs/") &&
      !/\.(?:[cm]?[jt]sx?|css|html|json)$/i.test(file)) ||
    documentationOnlyFiles.has(file)
  );
}

/**
 * A change is `{ status, file }`; a bare path means a modification. Only added
 * or modified documentation takes the fast path: checks depend on some of
 * these files existing, and the far side of a rename is not documentation.
 */
export function requiresFullValidation(changes, eventName = "pull_request") {
  if (eventName !== "pull_request") return true;
  if (changes.length === 0) return true;
  return changes.some((change) => {
    const { status, file } =
      typeof change === "string" ? { status: "M", file: change } : change;
    return !["A", "M"].includes(status) || !isDocumentationOnlyPath(file);
  });
}

/** Renames are reported as a deletion plus an addition so neither side hides. */
export function changedFilesBetween(base, head = "HEAD", root = process.cwd()) {
  return execFileSync(
    "git",
    ["diff", "--name-status", "--no-renames", base, head, "--"],
    { cwd: root, encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, file] = line.split("\t");
      return { status, file };
    });
}

export function changedFiles(baseRef, root = process.cwd()) {
  if (!baseRef)
    throw new Error("GITHUB_BASE_REF is required for pull requests");
  return changedFilesBetween(`origin/${baseRef}`, "HEAD", root);
}

export function vercelIgnoreExitCode(changes) {
  return requiresFullValidation(changes, "pull_request") ? 1 : 0;
}

/**
 * Vercel builds one commit per push. Comparing only with its parent would skip
 * a documentation commit pushed on top of deployable ones, so compare with the
 * last deployed commit when Vercel names one. If that commit cannot be read,
 * nothing is known about what is undeployed and the build proceeds.
 */
export function vercelChanges(env = process.env, diff = changedFilesBetween) {
  try {
    return diff(env.VERCEL_GIT_PREVIOUS_SHA || "HEAD^", "HEAD");
  } catch {
    return null;
  }
}

const describe = (changes) =>
  changes.length
    ? changes.map(({ status, file }) => `${status} ${file}`).join(", ")
    : "(none)";

function main() {
  if (process.argv.includes("--vercel-ignore")) {
    const changes = vercelChanges();
    if (!changes) {
      console.log(
        "Previous commit unavailable; proceeding with the Vercel build.",
      );
      process.exitCode = 1;
      return;
    }

    const exitCode = vercelIgnoreExitCode(changes);
    console.log(`Changed paths: ${describe(changes)}`);
    console.log(
      exitCode === 0
        ? "Documentation-only commit; skipping the Vercel build."
        : "Deployable change detected; proceeding with the Vercel build.",
    );
    process.exitCode = exitCode;
    return;
  }

  const eventName = process.env.GITHUB_EVENT_NAME || "local";
  const baseRef = process.env.GITHUB_BASE_REF || "";
  const changes = eventName === "pull_request" ? changedFiles(baseRef) : [];
  const full = requiresFullValidation(changes, eventName);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `full=${full}\n`);
  }

  console.log(
    `Changed paths: ${changes.length ? describe(changes) : "(push or unavailable)"}`,
  );
  console.log(`Full validation: ${full}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
