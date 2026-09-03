import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const chrome = resolveChromePath();
const maxJsBytes = Number(process.env.MAX_JS_KB || 260) * 1024;
const maxCssBytes = Number(process.env.MAX_CSS_KB || 30) * 1024;
const routes = [
  "/",
  "/blogs",
  "/blogs/clipt",
  "/brink",
  "/brink/privacy",
  "/case-studies",
  "/clipt",
  "/clipt-privacypolicy",
  "/district",
  "/flipfact",
  "/habee-privacypolicy",
  "/notchshelf-privacypolicy",
];

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
