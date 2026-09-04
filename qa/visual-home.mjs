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
const baseline = process.env.BASELINE_URL || "http://127.0.0.1:4173";
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
const launchOptions = {
  executablePath: chrome,
  headless: true,
  args: [
    "--renderer-process-limit=1",
    "--disable-extensions",
    "--disable-component-update",
    "--no-first-run",
  ],
};
const report = [];

async function captureHome(context, base, shot, viewport) {
  const page = await context.newPage();
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await waitForRenderableAssets(page);
  await page.waitForTimeout(3400);
  await freezeVisualState(page, "/");
  const dimensions = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight,
    w: document.documentElement.scrollWidth,
    imgs: document.images.length,
  }));
  await page.screenshot({
    path: shot,
    fullPage: viewport.fullPage,
    animations: "disabled",
  });
  await page.close();
  return dimensions;
}

for (const viewport of viewports) {
  const browser = await chromium.launch(launchOptions);
  const contextOptions = {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: "en-IN",
  };

  const baselinePath = `qa/static-home/${viewport.name}-baseline.png`;
  const nextPath = `qa/static-home/${viewport.name}-next.png`;
  const baselineContext = await browser.newContext(contextOptions);
  await prepareVisualContext(baselineContext);
  const baselineDimensions = await captureHome(
    baselineContext,
    baseline,
    baselinePath,
    viewport,
  );
  await baselineContext.close();

  const nextContext = await browser.newContext(contextOptions);
  await prepareVisualContext(nextContext);
  const nextDimensions = await captureHome(
    nextContext,
    next,
    nextPath,
    viewport,
  );
  await nextContext.close();

  const difference = await diff(baselinePath, nextPath);
  const dimensions = [baselineDimensions, nextDimensions];

  const item = {
    viewport: viewport.name,
    dims: dimensions,
    diff: difference,
  };
  report.push(item);
  console.log(viewport.name, JSON.stringify(item));
  await browser.close();
}

await fs.writeFile("qa/static-home/report.json", JSON.stringify(report, null, 2));

const staticExact = report.every(
  (item) => item.diff.sameDimensions && item.diff.diffPixels === 0,
);
if (!staticExact) process.exitCode = 1;
