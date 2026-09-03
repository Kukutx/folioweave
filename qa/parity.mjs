import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import {
  freezeVisualState,
  prepareVisualContext,
  waitForRenderableAssets,
} from "./visual-baseline.mjs";

const chrome = resolveChromePath();
const original = process.env.ORIGINAL_URL || "http://127.0.0.1:4173";
const next = process.env.NEXT_URL || process.env.BASE_URL || "http://127.0.0.1:4181";
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
const allViewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];
const requested = process.argv[2];
const viewports = requested
  ? allViewports.filter((viewport) => viewport.name === requested)
  : allViewports;

await fs.mkdir("qa/screens", { recursive: true });

const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
const stripDynamic = (value) =>
  clean(value)
    .replace(/\b\d{2}:\d{2}\s*IST\b/g, "TIME IST")
    .replace(/\b\d+°/g, "TEMP°")
    .replace(
      /Last Updated: [A-Z][a-z]+ \d{1,2}, \d{4}/g,
      "Last Updated: DATE",
    )
    .replace(
      /\b(?:Hello|Namaste|Bonjour|Hola|Ciao|Olá|Hallo|Guten Tag|Salaam|Konnichiwa),/g,
      "GREETING,",
    )
    .replace(/(?:Contact Now|CONTACT\.EXE|START_MAIL|Send Mail\.\.\.|C0NTACT_N0W|Connect|Get in Touch)/g, "CONTACT_ACTION");

function settleTime(route) {
  if (route === "/" || route === "/clipt") return 3200;
  if (route === "/brink" || route === "/brink/privacy") return 2600;
  return 1800;
}

async function inspect(page, url, route, shot, fullPage = true) {
  const issues = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push({ type: "console", text: message.text() });
    }
  });
  page.on("requestfailed", (request) =>
    issues.push({
      type: "requestfailed",
      text: `${request.url()} :: ${request.failure()?.errorText || "failed"}`,
    }),
  );

  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(settleTime(route));
  await page.waitForFunction(
    () => (document.body.innerText || "").trim().length > 20,
    undefined,
    { timeout: 10_000 },
  );
  await waitForRenderableAssets(page);
  await page.waitForTimeout(100);

  const data = await page.evaluate(() => {
    const query = (selector) => [...document.querySelectorAll(selector)];
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const decorative = query("body *").filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const z = Number.parseInt(style.zIndex || "0", 10);
      return (
        (style.position === "fixed" || style.position === "absolute") &&
        [15000, 19000, 30000].includes(z)
      );
    });
    const previousVisibility = decorative.map((element) => ({
      element,
      value: element.style.getPropertyValue("visibility"),
      priority: element.style.getPropertyPriority("visibility"),
    }));
    decorative.forEach((element) =>
      element.style.setProperty("visibility", "hidden", "important"),
    );
    const semanticText = normalize(document.body.innerText);
    previousVisibility.forEach(({ element, value, priority }) => {
      if (value) element.style.setProperty("visibility", value, priority);
      else element.style.removeProperty("visibility");
    });

    return {
      title: document.title,
      text: semanticText,
      h1: query("h1").map((element) => normalize(element.textContent)),
      h2: query("h2").map((element) => normalize(element.textContent)),
      buttons: query("button,[role=button]").map((element) => ({
        text: normalize(element.textContent),
        aria: element.getAttribute("aria-label") || "",
      })),
      links: query("a").map((element) => ({
        text: normalize(element.textContent),
        href: element.getAttribute("href") || "",
      })),
      images: query("img").map((element) => ({
        src: element.getAttribute("src") || "",
        alt: element.getAttribute("alt") || "",
        ok: element.complete && element.naturalWidth > 0,
      })),
      sections: query("section").map((element) => ({
        id: element.id,
        className: String(element.className),
      })),
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
    };
  });

  await freezeVisualState(page, route);
  await page.screenshot({ path: shot, fullPage, animations: "disabled" });
  return { ...data, status: response?.status() || 0, issues };
}

async function pixelDiff(originalPath, nextPath, diffPath) {
  const [originalBuffer, nextBuffer] = await Promise.all([
    fs.readFile(originalPath),
    fs.readFile(nextPath),
  ]);
  const a = PNG.sync.read(originalBuffer);
  const b = PNG.sync.read(nextBuffer);
  if (a.width !== b.width || a.height !== b.height) {
    return {
      sameDimensions: false,
      a: [a.width, a.height],
      b: [b.width, b.height],
    };
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(
    a.data,
    b.data,
    diff.data,
    a.width,
    a.height,
    { threshold: 0.1, includeAA: false },
  );
  await fs.writeFile(diffPath, PNG.sync.write(diff));
  return {
    sameDimensions: true,
    width: a.width,
    height: a.height,
    diffPixels,
    diffRatio: diffPixels / (a.width * a.height),
  };
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const report = [];

for (const viewport of viewports) {
  for (const route of routes) {
    const safe = route === "/" ? "home" : route.slice(1).replaceAll("/", "__");
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await prepareVisualContext(context);
    const originalPage = await context.newPage();
    const nextPage = await context.newPage();
    const originalPath = path.resolve(
      "qa/screens",
      `${viewport.name}-${safe}-original.png`,
    );
    const nextPath = path.resolve(
      "qa/screens",
      `${viewport.name}-${safe}-next.png`,
    );
    const diffPath = path.resolve(
      "qa/screens",
      `${viewport.name}-${safe}-diff.png`,
    );
    const fullPage = viewport.name === "desktop";

    // Start both pages together so time-, greeting-, and carousel-driven UI is
    // sampled at the same phase instead of several seconds apart.
    const [a, b] = await Promise.all([
      inspect(originalPage, original + route, route, originalPath, fullPage),
      inspect(nextPage, next + route, route, nextPath, fullPage),
    ]);
    const diff = await pixelDiff(originalPath, nextPath, diffPath);
    const item = {
      viewport: viewport.name,
      route,
      status: [a.status, b.status],
      titleEqual: a.title === b.title,
      textEqual: stripDynamic(a.text) === stripDynamic(b.text),
      textLength: [stripDynamic(a.text).length, stripDynamic(b.text).length],
      height: [a.height, b.height],
      width: [a.width, b.width],
      h1Equal:
        JSON.stringify(a.h1.map(stripDynamic)) ===
        JSON.stringify(b.h1.map(stripDynamic)),
      h2Count: [a.h2.length, b.h2.length],
      buttons: [a.buttons.length, b.buttons.length],
      links: [a.links.length, b.links.length],
      images: [a.images.length, b.images.length],
      broken: [
        a.images.filter((image) => !image.ok).length,
        b.images.filter((image) => !image.ok).length,
      ],
      issues: [a.issues.length, b.issues.length],
      diff,
    };
    report.push(item);
    console.log(
      `${viewport.name.padEnd(7)} ${route.padEnd(28)} text=${item.textEqual} ` +
        `h=${a.height}/${b.height} img=${item.images.join("/")} ` +
        `broken=${item.broken.join("/")} diff=${diff.diffRatio?.toFixed(4) ?? "dim"}`,
    );
    await context.close();
  }
}

await browser.close();
await fs.writeFile("qa/parity-report.json", JSON.stringify(report, null, 2));

const summary = {
  checks: report.length,
  statusOk: report.filter(
    (item) => item.status[0] === 200 && item.status[1] === 200,
  ).length,
  titleEqual: report.filter((item) => item.titleEqual).length,
  textEqual: report.filter((item) => item.textEqual).length,
  h1Equal: report.filter((item) => item.h1Equal).length,
  noBrokenNext: report.filter((item) => item.broken[1] === 0).length,
  sameDimensions: report.filter((item) => item.diff.sameDimensions).length,
  pixelExact: report.filter((item) => item.diff.diffRatio === 0).length,
  pixelUnder1pct: report.filter(
    (item) => item.diff.diffRatio !== undefined && item.diff.diffRatio < 0.01,
  ).length,
};
console.log("\nSUMMARY");
console.log(JSON.stringify(summary, null, 2));

const parityOk =
  summary.statusOk === summary.checks &&
  summary.titleEqual === summary.checks &&
  summary.textEqual === summary.checks &&
  summary.h1Equal === summary.checks &&
  summary.noBrokenNext === summary.checks &&
  summary.sameDimensions === summary.checks &&
  summary.pixelExact === summary.checks;

if (!parityOk) process.exitCode = 1;
