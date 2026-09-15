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

test("canonical demo placeholders stay minimal and isolated", () => {
  const directory = path.join(root, "public", "assets", "demo");
  const files = fs.readdirSync(directory).sort();
  assert.deepEqual(files, [
    "example-resume.pdf",
    "example-resume.svg",
    "logo-placeholder.svg",
    "photo-01.svg",
    "photo-02.svg",
    "photo-03.svg",
    "photo-04.svg",
    "photo-wide.svg",
    "project-placeholder.svg",
  ]);

  const decorativeSvg =
    /<(?:path|circle|ellipse|polygon|polyline|image|linearGradient|radialGradient)\b/i;
  const externalAssetReference = /\b(?:href|src)=["']https?:\/\//i;
  for (const file of files.filter((name) => name.endsWith(".svg"))) {
    const source = fs.readFileSync(path.join(directory, file), "utf8");
    assert.equal(
      decorativeSvg.test(source),
      false,
      `${file} contains decorative SVG content`,
    );
    assert.equal(
      externalAssetReference.test(source),
      false,
      `${file} embeds remote content`,
    );
    for (const color of source.match(/#[0-9a-f]{6}/gi) ?? []) {
      const channels = [
        Number.parseInt(color.slice(1, 3), 16),
        Number.parseInt(color.slice(3, 5), 16),
        Number.parseInt(color.slice(5, 7), 16),
      ];
      assert.ok(
        Math.max(...channels) - Math.min(...channels) <= 4,
        `${file} uses non-neutral placeholder color ${color}`,
      );
    }
  }

  const demo = JSON.parse(
    fs.readFileSync(
      path.join(root, "governance", "demo-portfolio.json"),
      "utf8",
    ),
  );
  assert.equal(demo.site.identity.name, "Your Name");
  assert.equal(demo.site.contact.email, "hello@example.com");
  assert.equal(
    demo.photography.images.some((image) =>
      image.src.startsWith("/assets/demo/"),
    ),
    false,
    "Photography must not use template placeholders",
  );
  assert.equal(
    demo.projects.some((project) =>
      JSON.stringify(project.media).includes("/assets/demo/"),
    ),
    false,
    "Project showcase media must not use template placeholders",
  );

  const serialized = JSON.stringify(demo);
  for (const forbidden of [
    "Gowtham Oleti",
    "gow88_",
    "oletigowtham",
    "Deepinder Goyal",
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `demo contains forbidden identity: ${forbidden}`,
    );
  }
});
