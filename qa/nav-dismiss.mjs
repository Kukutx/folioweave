import { cleanupPlaywrightProcesses, resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const chrome = resolveChromePath();
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

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });

    const hideSelector = 'button[aria-label="Hide navigation"]';
    await page.waitForFunction(
      (selector) => {
        const element = document.querySelector(selector);
        return Boolean(
          element &&
            Object.keys(element).some(
              (key) =>
                key.startsWith("__reactProps$") || key.startsWith("__reactFiber$"),
            ),
        );
      },
      hideSelector,
      { timeout: 10_000 },
    );

    await page.locator(hideSelector).click();
    await page.locator(".nav").waitFor({ state: "detached", timeout: 3000 });

    const show = page.locator('button[aria-label="Show navigation"]');
    await show.waitFor({ state: "visible", timeout: 3000 });
    await show.click();
    await page.locator(".nav").waitFor({ state: "visible", timeout: 3000 });

    const restoredHideCount = await page.locator(hideSelector).count();
    if (restoredHideCount !== 1) {
      throw new Error(`restored hide control count ${restoredHideCount}`);
    }

    console.log("PASS floating navigation dismisses and restores");
  } finally {
    await context.close();
  }
} finally {
  await browser.close().catch(() => {});
  cleanupPlaywrightProcesses();
}
