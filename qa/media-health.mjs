import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const chrome = resolveChromePath();
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
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const report = [];
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  for (const route of routes) {
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
      const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const steps = Math.min(10, Math.max(1, Math.ceil(max / innerHeight)));
      for (let i = 1; i <= steps; i++) {
        scrollTo(0, Math.round((max * i) / steps));
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    });
    await page.waitForTimeout(900);
    const state = await page.evaluate(() => {
      const isIntentionallyHidden = (image) =>
        image.matches("[data-portrait-preload]") ||
        Boolean(image.closest(".resume-paper")) ||
        Boolean(image.closest(".gallery-overlay")) ||
        Boolean(image.closest(".camera-view")) ||
        Boolean(image.closest(".notchshelf-carousel"));
      const invisibleLoaded = [...document.images]
        .filter((image) => {
          if (isIntentionallyHidden(image)) return false;
          const rect = image.getBoundingClientRect();
          const style = getComputedStyle(image);
          return (
            image.complete &&
            image.naturalWidth > 0 &&
            rect.width > 1 &&
            rect.height > 1 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) <= 0.01
          );
        })
        .map((image) => ({
          src: image.getAttribute("src"),
          className: image.className,
          opacity: getComputedStyle(image).opacity,
          rect: (() => {
            const rect = image.getBoundingClientRect();
            return [rect.x, rect.y + scrollY, rect.width, rect.height];
          })(),
        }));
      const broken = [...document.images]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.getAttribute("src"));
      return {
        images: document.images.length,
        broken,
        invisibleLoaded,
        skeletons: document.querySelectorAll(".skeleton-loader").length,
      };
    });
    report.push({
      viewport: viewport.name,
      route,
      ...state,
      consoleErrors,
      pageErrors,
    });
    console.log(
      `${viewport.name.padEnd(7)} ${route.padEnd(28)} images=${state.images} broken=${state.broken.length} invisible=${state.invisibleLoaded.length} skeletons=${state.skeletons} console=${consoleErrors.length} page=${pageErrors.length}`,
    );
    if (state.invisibleLoaded.length) {
      console.log(JSON.stringify(state.invisibleLoaded, null, 2));
    }
    await page.close();
  }
  await context.close();
}
await browser.close();

const issues = report.filter(
  (item) =>
    item.broken.length ||
    item.invisibleLoaded.length ||
    item.skeletons ||
    item.consoleErrors.length ||
    item.pageErrors.length,
);
const summary = {
  checks: report.length,
  passed: report.length - issues.length,
  failed: issues.length,
};
await fs.writeFile(
  "qa/media-health-report.json",
  JSON.stringify({ base, summary, issues, report }, null, 2),
);
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
if (issues.length) process.exitCode = 1;
