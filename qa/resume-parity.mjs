import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";

const base = process.env.BASE_URL || process.env.NEXT_URL || "http://127.0.0.1:4181";
const chrome = resolveChromePath();
const expectedDelays = {
  print: [1050, 2550],
  close: [1880, 2880],
};

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: [
    "--renderer-process-limit=1",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-component-update",
    "--no-first-run",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  locale: "en-IN",
});
const page = await context.newPage();

// Record the delays the application actually requests. This verifies the
// Resume state-machine configuration without treating host CPU scheduling
// jitter as an application timing regression.
await page.addInitScript(() => {
  const nativeSetTimeout = window.setTimeout.bind(window);
  window.__resumeTimeoutRequests = [];
  window.setTimeout = (handler, delay = 0, ...args) => {
    window.__resumeTimeoutRequests.push(Number(delay));
    return nativeSetTimeout(handler, delay, ...args);
  };
});

await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

await page.evaluate(async () => {
  const source =
    document.querySelector(".resume-paper img")?.getAttribute("src") ||
    "/gowtham-oleti-resume.jpg";
  const image = new Image();
  image.src = source;
  if (!image.complete || image.naturalWidth === 0) {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
  }
  try {
    await image.decode?.();
  } catch {
    // complete + naturalWidth is enough; decode is only a warm-up optimization.
  }

  const printer = document.querySelector(".resume-printer");
  if (!(printer instanceof HTMLElement)) throw new Error("resume printer missing");
  window.__resumeTrace = [];
  window.__resumeTimeoutRequests = [];
  const record = () => {
    window.__resumeTrace.push(printer.className);
  };
  record();
  const observer = new MutationObserver(record);
  observer.observe(printer, { attributes: true, attributeFilter: ["class"] });
  window.__resumeObserver = observer;
});

await page.locator(".resume-print-button").click({ force: true });
await page.locator(".resume-printer.is-ready").waitFor({
  state: "attached",
  timeout: 10_000,
});
const printTimeouts = await page.evaluate(() => [
  ...(window.__resumeTimeoutRequests || []),
]);
const readyPaper = await page.locator(".resume-paper").evaluate((element) => {
  const style = getComputedStyle(element);
  return { transform: style.transform, opacity: style.opacity };
});

await page.evaluate(() => {
  window.__resumeTimeoutRequests = [];
});
await page.locator(".resume-discard-button").click({ force: true });
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
  { timeout: 12_000 },
);
const closeTimeouts = await page.evaluate(() => [
  ...(window.__resumeTimeoutRequests || []),
]);
const idlePaper = await page.locator(".resume-paper").evaluate((element) => {
  const style = getComputedStyle(element);
  return { transform: style.transform, opacity: style.opacity };
});
const trace = await page.evaluate(() => {
  window.__resumeObserver?.disconnect();
  return [...(window.__resumeTrace || [])];
});

await context.close();
await browser.close();

const includesDelay = (values, expected) =>
  values.some((value) => Math.abs(value - expected) < 1);
const printDelaysOk = expectedDelays.print.every((delay) =>
  includesDelay(printTimeouts, delay),
);
const closeDelaysOk = expectedDelays.close.every((delay) =>
  includesDelay(closeTimeouts, delay),
);
const firstIndex = (className) =>
  trace.findIndex((value) => value.split(/\s+/).includes(className));
const morphingIndex = firstIndex("is-morphing");
const printingIndex = firstIndex("is-printing");
const readyIndex = firstIndex("is-ready");
const closingIndex = firstIndex("is-closing");
const collapsingIndex = firstIndex("is-collapsing");
const idleIndex = trace.findIndex(
  (value, index) =>
    index > collapsingIndex &&
    ![
      "is-morphing",
      "is-printing",
      "is-ready",
      "is-closing",
      "is-collapsing",
    ].some((className) => value.split(/\s+/).includes(className)),
);
const orderOk =
  morphingIndex >= 0 &&
  morphingIndex < printingIndex &&
  printingIndex < readyIndex &&
  readyIndex < closingIndex &&
  closingIndex < collapsingIndex &&
  collapsingIndex < idleIndex;
const readyPaperOk =
  readyPaper.transform === "matrix(1, 0, 0, 1, 0, 2)" &&
  readyPaper.opacity === "1";
const idlePaperOk =
  idlePaper.transform === "matrix(1, 0, 0, 1, 0, -326)" &&
  idlePaper.opacity === "0";

const summary = {
  base,
  expectedDelays,
  printTimeouts,
  closeTimeouts,
  printDelaysOk,
  closeDelaysOk,
  orderOk,
  readyPaperOk,
  idlePaperOk,
  readyPaper,
  idlePaper,
  trace,
};
await fs.writeFile("qa/resume-parity-report.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!printDelaysOk || !closeDelaysOk || !orderOk || !readyPaperOk || !idlePaperOk) {
  process.exitCode = 1;
}
