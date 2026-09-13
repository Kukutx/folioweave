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
  "content/assets/portfolio/README.md",
]);

export function isDocumentationOnlyPath(file) {
  return file.startsWith("docs/") || documentationOnlyFiles.has(file);
}

export function requiresFullValidation(files, eventName = "pull_request") {
  if (eventName !== "pull_request") return true;
  if (files.length === 0) return true;
  return files.some((file) => !isDocumentationOnlyPath(file));
}

export function changedFilesBetween(base, head = "HEAD", root = process.cwd()) {
  return execFileSync("git", ["diff", "--name-only", base, head, "--"], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
}

export function changedFiles(baseRef, root = process.cwd()) {
  if (!baseRef)
    throw new Error("GITHUB_BASE_REF is required for pull requests");
  return changedFilesBetween(`origin/${baseRef}`, "HEAD", root);
}

export function vercelIgnoreExitCode(files) {
  return requiresFullValidation(files, "pull_request") ? 1 : 0;
}

function main() {
  if (process.argv.includes("--vercel-ignore")) {
    let files;
    try {
      files = changedFilesBetween("HEAD^", "HEAD");
    } catch {
      console.log(
        "Previous commit unavailable; proceeding with the Vercel build.",
      );
      process.exitCode = 1;
      return;
    }

    const exitCode = vercelIgnoreExitCode(files);
    console.log(`Changed paths: ${files.length ? files.join(", ") : "(none)"}`);
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
  const files = eventName === "pull_request" ? changedFiles(baseRef) : [];
  const full = requiresFullValidation(files, eventName);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `full=${full}\n`);
  }

  console.log(
    `Changed paths: ${files.length ? files.join(", ") : "(push or unavailable)"}`,
  );
  console.log(`Full validation: ${full}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
