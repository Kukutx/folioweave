import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";

const chrome = resolveChromePath();
const original = process.env.ORIGINAL_URL || "http://127.0.0.1:4173";
const next = process.env.NEXT_URL || "http://127.0.0.1:4181";
const toleranceMs = 250;

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  locale: "en-IN",
});

async function trace(base) {
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  // The reference SPA performs startup scroll resets/hero animation work.
  // Wait for that startup window, then dispatch native clicks so Playwright's
  // actionability waiting is not accidentally measured as animation duration.
  await page.waitForTimeout(2500);

  const printStarted = Date.now();
  await page.locator(".resume-print-button").evaluate((element) => element.click());
  await page.locator(".resume-printer.is-printing").waitFor({
    state: "attached",
    timeout: 5000,
  });
  const printingMs = Date.now() - printStarted;

  await page.locator(".resume-printer.is-ready").waitFor({
    state: "attached",
    timeout: 7000,
  });
  const readyMs = Date.now() - printStarted;
  const readyPaper = await page.locator(".resume-paper").evaluate((element) => {
    const style = getComputedStyle(element);
    return { transform: style.transform, opacity: style.opacity };
  });

  const closeStarted = Date.now();
  await page.locator(".resume-discard-button").evaluate((element) => element.click());
  await page.locator(".resume-printer.is-closing").waitFor({
    state: "attached",
    timeout: 1000,
  });
  const closingMs = Date.now() - closeStarted;

  await page.locator(".resume-printer.is-collapsing").waitFor({
    state: "attached",
    timeout: 4000,
  });
  const collapsingMs = Date.now() - closeStarted;

  await page.waitForFunction(
    () => {
      const element = document.querySelector(".resume-printer");
      if (!element) return false;
      return ![
        "is-morphing",
        "is-printing",
        "is-ready",
        "is-closing",
        "is-collapsing",
      ].some((className) => element.classList.contains(className));
    },
    undefined,
    { timeout: 5000 },
  );
  const idleMs = Date.now() - closeStarted;
  const idlePaper = await page.locator(".resume-paper").evaluate((element) => {
    const style = getComputedStyle(element);
    return { transform: style.transform, opacity: style.opacity };
  });

  await page.close();
  return {
    printingMs,
    readyMs,
    closingMs,
    collapsingMs,
    idleMs,
    readyPaper,
    idlePaper,
  };
}

const [reference, rebuilt] = await Promise.all([trace(original), trace(next)]);
await browser.close();

const timingFields = [
  "printingMs",
  "readyMs",
  "closingMs",
  "collapsingMs",
  "idleMs",
];
const timingDiffs = Object.fromEntries(
  timingFields.map((field) => [
    field,
    Math.abs(reference[field] - rebuilt[field]),
  ]),
);
const timingOk = Object.values(timingDiffs).every((diff) => diff <= toleranceMs);
const readyPaperOk =
  reference.readyPaper.transform === rebuilt.readyPaper.transform &&
  reference.readyPaper.opacity === rebuilt.readyPaper.opacity &&
  rebuilt.readyPaper.transform === "matrix(1, 0, 0, 1, 0, 2)" &&
  rebuilt.readyPaper.opacity === "1";
const idlePaperOk =
  reference.idlePaper.transform === rebuilt.idlePaper.transform &&
  reference.idlePaper.opacity === rebuilt.idlePaper.opacity &&
  rebuilt.idlePaper.transform === "matrix(1, 0, 0, 1, 0, -326)" &&
  rebuilt.idlePaper.opacity === "0";

const summary = {
  toleranceMs,
  timingOk,
  readyPaperOk,
  idlePaperOk,
  reference,
  next: rebuilt,
  timingDiffs,
};

await fs.writeFile("qa/resume-parity-report.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!timingOk || !readyPaperOk || !idlePaperOk) process.exitCode = 1;
