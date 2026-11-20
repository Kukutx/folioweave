import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import { publicationRoutes } from "./blog-routes.mjs";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const chrome = resolveChromePath();
// The template and core get the base budget; every plugin the profile turns
// on adds the budget its manifest declares (qa/plugin-budget.test.mjs holds
// each plugin to its own), so a profile pays only for what it enables.
const allowances = await pluginAllowances();
const maxJsBytes =
  Number(process.env.MAX_JS_KB || 260) * 1024 +
  allowances.reduce((total, item) => total + item.jsGzipBytes, 0);
const maxCssBytes =
  Number(process.env.MAX_CSS_KB || 30) * 1024 +
  allowances.reduce((total, item) => total + item.cssGzipBytes, 0);
if (allowances.length)
  console.log(
    `Plugin allowances: ${allowances
      .map(
        (item) =>
          `${item.id} +${(item.jsGzipBytes / 1024).toFixed(1)} KB JS, +${(item.cssGzipBytes / 1024).toFixed(1)} KB CSS`,
      )
      .join("; ")}`,
  );
const routes = await publicationRoutes();

async function pluginAllowances() {
  const profile = JSON.parse(await fs.readFile("portfolio.json", "utf8"));
  const enabled = Object.entries(profile.plugins ?? {}).filter(
    ([, entry]) => entry?.enabled,
  );
  const list = [];
  for (const [id] of enabled) {
    const manifest = JSON.parse(
      await fs
        .readFile(`src/plugins/${id}/manifest.json`, "utf8")
        .catch(() => "{}"),
    );
    if (manifest.budget) list.push({ id, ...manifest.budget });
  }
  return list;
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const report = [];
for (const route of routes) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(base + route, { waitUntil: "networkidle", timeout: 60_000 });
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize || 0,
        encodedBodySize: entry.encodedBodySize || 0,
        decodedBodySize: entry.decodedBodySize || 0,
      })),
  );
  const scripts = resources.filter(
    (entry) =>
      entry.name.includes("/_next/static/chunks/") && entry.name.endsWith(".js"),
  );
  const styles = resources.filter(
    (entry) =>
      entry.name.includes("/_next/static/chunks/") && entry.name.endsWith(".css"),
  );
  // A route with no matched chunks would otherwise weigh nothing and pass.
  if (!scripts.length || !styles.length)
    throw new Error(
      `${route}: found ${scripts.length} script and ${styles.length} style chunks; the budget cannot be measured.`,
    );
  const sum = (items) =>
    items.reduce((total, entry) => total + entry.encodedBodySize, 0);
  const item = {
    route,
    jsBytes: sum(scripts),
    cssBytes: sum(styles),
    jsWithinBudget: sum(scripts) <= maxJsBytes,
    cssWithinBudget: sum(styles) <= maxCssBytes,
    jsChunks: scripts
      .sort((a, b) => b.encodedBodySize - a.encodedBodySize)
      .map((entry) => ({
        file: entry.name.split("/").pop(),
        bytes: entry.encodedBodySize,
      })),
    cssChunks: styles.map((entry) => ({
      file: entry.name.split("/").pop(),
      bytes: entry.encodedBodySize,
    })),
  };
  report.push(item);
  console.log(
    `${route.padEnd(28)} JS ${(item.jsBytes / 1024).toFixed(1).padStart(7)} KB | CSS ${(item.cssBytes / 1024).toFixed(1).padStart(6)} KB`,
  );
  console.log(
    `  top JS: ${item.jsChunks
      .slice(0, 5)
      .map((chunk) => `${chunk.file}:${(chunk.bytes / 1024).toFixed(1)}KB`)
      .join(" | ")}`,
  );
  await context.close();
}
await browser.close();

const failures = report.filter(
  (item) => !item.jsWithinBudget || !item.cssWithinBudget,
);
const summary = {
  routes: report.length,
  passed: report.length - failures.length,
  failed: failures.length,
  maxJsKb: maxJsBytes / 1024,
  maxCssKb: maxCssBytes / 1024,
};
await fs.writeFile(
  "qa/bundle-budget-report.json",
  JSON.stringify({ base, summary, failures, report }, null, 2),
);
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
