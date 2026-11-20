// Every plugin that declares a budget stays within it: its slot entry, bundled
// on its own and gzipped, is what it adds to each page it appears on. Code it
// loads later (a dynamic import, such as the badge's 3D scene) does not count,
// and the framework it shares with the page (React, Next) is left out.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import zlib from "node:zlib";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const pluginsDir = path.join(root, "src/plugins");

const budgeted = fs
  .readdirSync(pluginsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const file = path.join(pluginsDir, entry.name, "manifest.json");
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : null;
  })
  .filter((manifest) => manifest?.budget);

async function measure(manifest) {
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(pluginsDir, manifest.id, manifest.entry)],
    bundle: true,
    write: false,
    minify: true,
    format: "esm",
    platform: "browser",
    outdir: path.join(root, ".generated", "plugin-budget"),
    jsx: "automatic",
    loader: { ".css": "local-css" },
    alias: { "@": path.join(root, "src") },
    external: [
      "react",
      "react-dom",
      "react/*",
      "react-dom/*",
      "next",
      "next/*",
      "server-only",
    ],
    logLevel: "silent",
    plugins: [
      {
        name: "lazy-code-loads-later",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) =>
            args.kind === "dynamic-import"
              ? { path: args.path, external: true }
              : undefined,
          );
        },
      },
    ],
  });
  const size = { js: 0, css: 0 };
  for (const file of result.outputFiles) {
    const bytes = zlib.gzipSync(file.contents).length;
    if (file.path.endsWith(".css")) size.css += bytes;
    else size.js += bytes;
  }
  return size;
}

test("at least the floating plugins declare a budget", () => {
  const ids = budgeted.map((manifest) => manifest.id);
  for (const id of ["music", "launcher", "badge"])
    assert.ok(ids.includes(id), id);
});

for (const manifest of budgeted)
  test(`${manifest.id} stays within its declared budget`, async () => {
    const size = await measure(manifest);
    assert.ok(
      size.js <= manifest.budget.jsGzipBytes,
      `${manifest.id}: ${size.js} gzip bytes of JS, budget ${manifest.budget.jsGzipBytes}`,
    );
    assert.ok(
      size.css <= manifest.budget.cssGzipBytes,
      `${manifest.id}: ${size.css} gzip bytes of CSS, budget ${manifest.budget.cssGzipBytes}`,
    );
  });
