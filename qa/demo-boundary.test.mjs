import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reusableRoots = [
  "src/blog",
  "src/components",
  "src/config",
  "src/content",
  "src/hooks",
  "src/lib",
];

function sourceFiles(relativeRoot) {
  const start = path.join(root, relativeRoot);
  if (!fs.existsSync(start)) return [];
  const visit = (directory) =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return visit(absolute);
      if (entry.name.endsWith(".generated.ts")) return [];
      return /\.(?:[cm]?[jt]sx?|css|json)$/.test(entry.name) ? [absolute] : [];
    });
  return visit(start);
}

test("reusable source does not depend on demo implementation", () => {
  const leaks = [];
  for (const relativeRoot of reusableRoots) {
    for (const file of sourceFiles(relativeRoot)) {
      const source = fs.readFileSync(file, "utf8");
      if (source.includes("@/demo/")) {
        leaks.push(path.relative(root, file).replaceAll("\\", "/"));
      }
    }
  }
  assert.deepEqual(
    leaks,
    [],
    `Reusable modules import demo-only code: ${leaks.join(", ")}`,
  );
});

test("demo brands stay out of reusable config and components", () => {
  const demoTerms = [
    "Gowtham Oleti",
    "District by Zomato",
    "NotchShelf",
    "notchshelf",
    "Clipt",
    "Brink",
    "Habee",
  ];
  const leaks = [];
  for (const relativeRoot of ["src/blog", "src/config", "src/components"]) {
    for (const file of sourceFiles(relativeRoot)) {
      const source = fs.readFileSync(file, "utf8");
      const terms = demoTerms.filter((term) => source.includes(term));
      if (terms.length) {
        leaks.push({
          file: path.relative(root, file).replaceAll("\\", "/"),
          terms,
        });
      }
    }
  }
  assert.deepEqual(
    leaks,
    [],
    `Demo-specific copy leaked into reusable source: ${JSON.stringify(leaks)}`,
  );
});
