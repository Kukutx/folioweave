import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import {
  freezeVisualState,
  prepareVisualContext,
  waitForRenderableAssets,
} from "./visual-baseline.mjs";

const chrome = resolveChromePath();
const original = process.env.ORIGINAL_URL || "http://127.0.0.1:4173";
const next = process.env.NEXT_URL || "http://127.0.0.1:4181";
const viewports = [
  { name: "desktop", width: 1440, height: 1000, fullPage: true },
  { name: "tablet", width: 820, height: 1180, fullPage: false },
  { name: "mobile", width: 390, height: 844, fullPage: false },
];

async function diff(aPath, bPath) {
  const [aBuffer, bBuffer] = await Promise.all([
    fs.readFile(aPath),
    fs.readFile(bPath),
  ]);
  const a = PNG.sync.read(aBuffer);
  const b = PNG.sync.read(bBuffer);
  if (a.width !== b.width || a.height !== b.height) {
    return {
      sameDimensions: false,
      a: [a.width, a.height],
      b: [b.width, b.height],
    };
  }

  const diffImage = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(
    a.data,
    b.data,
    diffImage.data,
    a.width,
    a.height,
    { threshold: 0.1, includeAA: false, diffMask: true },
  );

  const rows = new Array(a.height).fill(0);
  let minX = a.width;
  let minY = a.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      if (diffImage.data[(y * a.width + x) * 4 + 3]) {
        rows[y] += 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const clusters = [];
  let start = -1;
  let pixels = 0;
  let peak = 0;
  for (let y = 0; y <= rows.length; y += 1) {
    if (y < rows.length && rows[y]) {
      if (start < 0) start = y;
      pixels += rows[y];
      peak = Math.max(peak, rows[y]);
      continue;
    }
    if (start < 0) continue;

    let clusterMinX = a.width;
    let clusterMaxX = -1;
    for (let yy = start; yy < y; yy += 1) {
      for (let x = 0; x < a.width; x += 1) {
        if (diffImage.data[(yy * a.width + x) * 4 + 3]) {
          clusterMinX = Math.min(clusterMinX, x);
          clusterMaxX = Math.max(clusterMaxX, x);
        }
      }
    }
    clusters.push({
      start,
      end: y - 1,
      pixels,
      peak,
      minX: clusterMinX,
      maxX: clusterMaxX,
    });
    start = -1;
    pixels = 0;
    peak = 0;
  }

  return {
    sameDimensions: true,
    diffPixels,
    diffRatio: diffPixels / (a.width * a.height),
    bbox: maxX >= 0 ? { minX, minY, maxX, maxY } : null,
    clusters: clusters.sort((x, y) => y.pixels - x.pixels).slice(0, 15),
  };
}

await fs.mkdir("qa/static-home", { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const report = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: "en-IN",
  });
  await prepareVisualContext(context);

  const [originalPage, nextPage] = await Promise.all([
    context.newPage(),
    context.newPage(),
  ]);
  await Promise.all([
    originalPage.goto(original + "/", { waitUntil: "domcontentloaded" }),
    nextPage.goto(next + "/", { waitUntil: "domcontentloaded" }),
  ]);
  await Promise.all([
    waitForRenderableAssets(originalPage),
    waitForRenderableAssets(nextPage),
  ]);
  await Promise.all([
    originalPage.waitForTimeout(3400),
    nextPage.waitForTimeout(3400),
  ]);
  await Promise.all([
    freezeVisualState(originalPage, "/"),
    freezeVisualState(nextPage, "/"),
  ]);

  const originalPath = `qa/static-home/${viewport.name}-original.png`;
  const nextPath = `qa/static-home/${viewport.name}-next.png`;
  await Promise.all([
    originalPage.screenshot({
      path: originalPath,
      fullPage: viewport.fullPage,
      animations: "disabled",
    }),
    nextPage.screenshot({
      path: nextPath,
      fullPage: viewport.fullPage,
      animations: "disabled",
    }),
  ]);

  const [difference, dimensions] = await Promise.all([
    diff(originalPath, nextPath),
    Promise.all(
      [originalPage, nextPage].map((page) =>
        page.evaluate(() => ({
          h: document.documentElement.scrollHeight,
          w: document.documentElement.scrollWidth,
          imgs: document.images.length,
        })),
      ),
    ),
  ]);

  const item = {
    viewport: viewport.name,
    dims: dimensions,
    diff: difference,
  };
  report.push(item);
  console.log(viewport.name, JSON.stringify(item));
  await context.close();
}

await browser.close();
await fs.writeFile("qa/static-home/report.json", JSON.stringify(report, null, 2));

const staticExact = report.every(
  (item) => item.diff.sameDimensions && item.diff.diffPixels === 0,
);
if (!staticExact) process.exitCode = 1;
