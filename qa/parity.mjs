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
const allRoutes = [
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
const requestedRoutes = new Set(
  (process.env.PARITY_ROUTES || "")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean),
);
const routes = requestedRoutes.size
  ? allRoutes.filter((route) => requestedRoutes.has(route))
  : allRoutes;
const allViewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];
const requested = process.argv[2] || process.env.PARITY_VIEWPORT;
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
  // reducedMotion + explicit font/image readiness below make multi-second fixed
  // sleeps unnecessary. Keeping these short materially lowers peak commit time
  // on Windows machines with a constrained page file.
  if (route === "/" || route === "/clipt") return 900;
  if (route === "/brink" || route === "/brink/privacy") return 600;
  return 400;
}

async function captureDeterministicScreenshot(page, outputPath, fullPage) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.screenshot({
        path: outputPath,
        fullPage,
        animations: "disabled",
        timeout: 120_000,
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(400 * attempt);
    }
  }
  throw lastError;
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

  // District's long case-study page uses lazy project imagery in the rebuilt app.
  // Materialize those six images for visual parity so we compare rendered content,
  // while functionality/media QA continues to verify the real on-demand behavior.
  if (route === "/district") {
    await page.evaluate(async () => {
      const images = [...document.querySelectorAll("img[loading='lazy']")];
      for (const image of images) {
        image.loading = "eager";
        if (!image.complete) {
          await new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          });
        }
        if (image.naturalWidth > 0) {
          try {
            await image.decode();
          } catch {}
        }
      }
    });
  }

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
        loaded: element.complete && element.naturalWidth > 0,
        broken: element.complete && element.naturalWidth === 0,
        pending: !element.complete,
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
  await captureDeterministicScreenshot(page, shot, fullPage);
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

  const options = { threshold: 0.1, includeAA: false };
  const diffPixels = pixelmatch(
    a.data,
    b.data,
    null,
    a.width,
    a.height,
    options,
  );

  if (diffPixels > 0) {
    const diff = new PNG({ width: a.width, height: a.height });
    pixelmatch(a.data, b.data, diff.data, a.width, a.height, options);
    await fs.writeFile(diffPath, PNG.sync.write(diff));
  } else {
    await fs.rm(diffPath, { force: true });
  }

  return {
    sameDimensions: true,
    width: a.width,
    height: a.height,
    diffPixels,
    diffRatio: diffPixels / (a.width * a.height),
  };
}

const report = [];

for (const viewport of viewports) {
  for (const route of routes) {
    const browser = await chromium.launch({ executablePath: chrome, headless: true });
    const safe = route === "/" ? "home" : route.slice(1).replaceAll("/", "__");
    const contextOptions = {
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    };
    const originalContext = await browser.newContext(contextOptions);
    await prepareVisualContext(originalContext);
    const originalPage = await originalContext.newPage();
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
    // qa:static already owns full-page homepage pixel parity on desktop/tablet/mobile.
    // Avoid duplicating the 14k–22k px home capture here; parity still checks the
    // homepage viewport plus full document geometry/semantics.
    const fullPage = viewport.name === "desktop" && route !== "/";

    // Visual state is deterministically frozen, so capture sequentially to keep
    // long-page screenshots memory-safe on CI and low-pagefile machines.
    const a = await inspect(
      originalPage,
      original + route,
      route,
      originalPath,
      fullPage,
    );
    await originalPage.close();
    await originalContext.close();
    const nextContext = await browser.newContext(contextOptions);
    await prepareVisualContext(nextContext);
    const nextPage = await nextContext.newPage();
    const b = await inspect(
      nextPage,
      next + route,
      route,
      nextPath,
      fullPage,
    );
    await nextPage.close();
    await nextContext.close();
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
        a.images.filter((image) => image.broken).length,
        b.images.filter((image) => image.broken).length,
      ],
      pending: [
        a.images.filter((image) => image.pending).length,
        b.images.filter((image) => image.pending).length,
      ],
      issues: [a.issues.length, b.issues.length],
      diff,
    };
    report.push(item);
    console.log(
      `${viewport.name.padEnd(7)} ${route.padEnd(28)} text=${item.textEqual} ` +
        `h=${a.height}/${b.height} img=${item.images.join("/")} ` +
        `broken=${item.broken.join("/")} pending=${item.pending.join("/")} ` +
        `diff=${diff.diffRatio?.toFixed(4) ?? "dim"}`,
    );
    await browser.close();
    global.gc?.();
  }
}
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
