// Shared code must not be bound to one author, company or project: names,
// project titles and the brands seen in reference material belong in a
// profile or an option, never in plugins, templates or core source.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const SHARED = ["src/plugins", "src/templates", "src/components", "src/core"];
const TEXT = /\.(?:tsx?|mjs|cjs|js|json|css|md|svg)$/;
// Brands from reference recordings and earlier invented samples.
const REFERENCE_BRANDS = ["OpenAI", "Open AI", "Codex", "Atlassian", "Rovo", "DevMate"];

async function files(directory) {
  const entries = await fs
    .readdir(path.join(root, directory), { recursive: true, withFileTypes: true })
    .catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && TEXT.test(entry.name) && !entry.name.includes(".generated."))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** Names a profile carries: identity and project titles. */
function profileNames(config) {
  const { name, firstName } = config.site.identity;
  const names = [name, firstName.length > 3 ? firstName : ""];
  for (const project of config.projects ?? [])
    for (const title of [project.title, project.name])
      if (title?.length > 3) names.push(title);
  return names.filter(Boolean);
}

/** The author's names, without the demo profile's placeholders (which the
 * shared code may well mention), plus the reference brands. */
async function authorTerms() {
  const read = async (file) =>
    JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
  const demo = new Set(profileNames(await read("governance/demo-portfolio.json")));
  const author = profileNames(await read("portfolio.json")).filter(
    (name) => !demo.has(name),
  );
  return [...new Set([...REFERENCE_BRANDS, ...author])];
}

test("plugins, templates, components and core name no author, company or project", async () => {
  const terms = await authorTerms();
  const hits = [];
  for (const directory of SHARED)
    for (const file of await files(directory)) {
      const text = await fs.readFile(file, "utf8");
      for (const term of terms) {
        const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (pattern.test(text)) hits.push(`${path.relative(root, file)}: "${term}"`);
      }
    }
  assert.deepEqual(hits, [], `Move these into a profile or an option:\n${hits.join("\n")}`);
});
