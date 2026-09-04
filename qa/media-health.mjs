import { cleanupPlaywrightProcesses, resolveChromePath } from "./chrome.mjs";
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
const browserArgs = [
  "--renderer-process-limit=1",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-component-update",
  "--no-first-run",
];

async function scan(viewport, route) {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: browserArgs,
  });
  try {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
      const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const steps = Math.min(12, Math.max(1, Math.ceil(max / innerHeight)));
      for (let index = 1; index <= steps; index++) {
        scrollTo(0, Math.round((max * index) / steps));
        await new Promise((resolve) => setTimeout(resolve, 140));
      }
    });
    await page.waitForTimeout(250);

    // Very long pages can jump over viewport-triggered media. Visit any
    // remaining loader explicitly. A genuinely stalled loader survives the
    // bounded loop and is still reported as a failure below.
    for (let attempt = 0; attempt < 30; attempt++) {
      const foundLoader = await page.evaluate(() => {
        const loader = document.querySelector(".skeleton-loader");
        if (!loader) return false;
        loader.scrollIntoView({ block: "center", inline: "nearest" });
        return true;
      });
      if (!foundLoader) break;
      await page.waitForTimeout(180);
    }
    await page.waitForTimeout(250);
    if (route === "/clipt") {
      // Clipt hero screenshots have a staggered opacity entrance. Wait for the
      // intended stable state so media health does not sample a valid image
      // halfway through its mount animation on a busy CI runner.
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll(".clipt-images-hero img")].every(
              (image) => Number(getComputedStyle(image).opacity) > 0.99,
            ),
          { timeout: 3000 },
        )
        .catch(() => {});
    }

    const state = await page.evaluate(() => {
      const isIntentionallyHidden = (image) =>
        image.matches("[data-portrait-preload]") ||
        Boolean(image.closest(".resume-paper")) ||
        Boolean(image.closest(".gallery-overlay")) ||
        Boolean(image.closest(".camera-view")) ||
        Boolean(image.closest(".notchshelf-carousel")) ||
        // AnimatePresence can keep an outgoing Brink phone screenshot at
        // opacity 0 briefly while its replacement is already visible.
        (image.classList.contains("brink-phoneShot") &&
          image.parentElement?.querySelectorAll("img.brink-phoneShot").length > 1);

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

      const visibleSkeletons = [...document.querySelectorAll(".skeleton-loader")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 1 &&
            rect.height > 1 &&
            rect.bottom >= -innerHeight * 0.5 &&
            rect.top <= innerHeight * 1.5
          );
        }).length;

      return {
        images: document.images.length,
        broken,
        invisibleLoaded,
        skeletons: visibleSkeletons,
        pendingSkeletons: document.querySelectorAll(".skeleton-loader").length,
      };
    });

    await context.close();
    return { ...state, consoleErrors, pageErrors };
  } finally {
    await browser.close().catch(() => {});
    cleanupPlaywrightProcesses();
  }
}

const report = [];
for (const viewport of viewports) {
  for (const route of routes) {
    const state = await scan(viewport, route);
    const item = { viewport: viewport.name, route, ...state };
    report.push(item);
    console.log(
      `${viewport.name.padEnd(7)} ${route.padEnd(28)} images=${state.images} broken=${state.broken.length} invisible=${state.invisibleLoaded.length} skeletons=${state.skeletons} console=${state.consoleErrors.length} page=${state.pageErrors.length}`,
    );
    if (state.invisibleLoaded.length) {
      console.log(JSON.stringify(state.invisibleLoaded, null, 2));
    }
  }
}

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
