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

export function changedFiles(baseRef, root = process.cwd()) {
  if (!baseRef)
    throw new Error("GITHUB_BASE_REF is required for pull requests");
  return execFileSync(
    "git",
    ["diff", "--name-only", `origin/${baseRef}`, "HEAD", "--"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .split(/\r?\n/)
    .filter(Boolean);
}

function main() {
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
