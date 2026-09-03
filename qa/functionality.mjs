import { cleanupPlaywrightProcesses, resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const chrome = resolveChromePath();
const results = [];

const commonArgs = [
  "--renderer-process-limit=1",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-component-update",
  "--no-first-run",
];

async function test(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(
      `PASS ${name}${detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""}`,
    );
  } catch (error) {
    results.push({ name, ok: false, error: String(error) });
    console.log(`FAIL ${name} :: ${error}`);
  }
}

const assert = (value, message) => {
  if (!value) throw new Error(message);
};

async function launch(extraArgs = []) {
  return chromium.launch({
    executablePath: chrome,
    headless: true,
    args: [...commonArgs, ...extraArgs],
  });
}

async function runHomeCore() {
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const localBad = [];
    const consoleErrors = [];
    const requestFailures = [];
    page.on("response", (response) => {
      if (response.url().startsWith(base) && response.status() >= 400) {
        localBad.push({ url: response.url(), status: response.status() });
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      requestFailures.push({
        url: request.url(),
        error: request.failure()?.errorText || "failed",
      });
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);

    await test("hero greeting cycles", async () => {
      const first = (await page.locator(".hero-greeting").innerText()).trim();
      await page.waitForFunction(
        (value) =>
          document.querySelector(".hero-greeting")?.textContent?.trim() !== value,
        first,
        { timeout: 5000 },
      );
      const second = (await page.locator(".hero-greeting").innerText()).trim();
      assert(first !== second, `greeting did not change: ${first}`);
      return { first, second };
    });

    await test("portrait cycles on click", async () => {
      const card = page.locator(".card-polaroid");
      const img = card.locator("img.polaroid-photo-image");
      const first = await img.getAttribute("src");
      await card.click();
      await page.waitForFunction(
        (value) =>
          document
            .querySelector("img.polaroid-photo-image")
            ?.getAttribute("src") !== value,
        first,
        { timeout: 5000 },
      );
      const second = await card
        .locator("img.polaroid-photo-image")
        .last()
        .getAttribute("src");
      assert(first !== second, "portrait source did not change");
      return { first, second };
    });

    await test("nav smooth-scroll About", async () => {
      await page.locator('.nav-links a[href="#about"]').click();
      await page.waitForFunction(() => scrollY > 700, undefined, {
        timeout: 5000,
      });
      return { scrollY: Math.round(await page.evaluate(() => scrollY)) };
    });

    await test("About TLDR and Timeline switch", async () => {
      const root = page.locator("#about");
      const tldr = root
        .locator("button:visible")
        .filter({ hasText: "TL;DR" })
        .first();
      await tldr.click();
      await root.locator(".profile-about-content.is-tldr").waitFor({
        state: "attached",
        timeout: 3000,
      });
      const timeline = root
        .locator("button:visible")
        .filter({ hasText: "Timeline" })
        .first();
      await timeline.click();
      await root.getByText("First smartphone").waitFor({
        state: "visible",
        timeout: 3000,
      });
      return true;
    });

    await test("resume printer reaches ready and downloads PDF", async () => {
      await page.evaluate(() => scrollTo(0, 0));
      await page.locator("button.resume-print-button").click();
      const downloadButton = page.locator("button.resume-download-button");
      await downloadButton.waitFor({ state: "visible", timeout: 7000 });
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 5000 }),
        downloadButton.click(),
      ]);
      const name = download.suggestedFilename();
      assert(name.toLowerCase().endsWith(".pdf"), `unexpected file ${name}`);
      return { filename: name };
    });

    await test("contact hover cycles style/text", async () => {
      await page.evaluate(() => scrollTo(0, 0));
      const btn = page.locator(".nav .cycle-btn");
      const first = (await btn.innerText()).trim();
      await btn.hover();
      await page.waitForFunction(
        (value) =>
          document.querySelector(".nav .cycle-btn")?.textContent?.trim() !==
          value,
        first,
        { timeout: 3000 },
      );
      const second = (await btn.innerText()).trim();
      assert(first !== second, "contact button did not cycle");
      return { first, second };
    });

    await test("offline screen appears and recovers", async () => {
      await context.setOffline(true);
      try {
        const offline = page.locator(".offline-screen");
        await offline.waitFor({ state: "visible", timeout: 2500 });
        assert(
          (await offline.innerText()).includes("No internet connection"),
          "offline message mismatch",
        );
        await context.setOffline(false);
        await offline.waitFor({ state: "detached", timeout: 4000 });
        return true;
      } finally {
        await context.setOffline(false);
      }
    });

    await test("weather API responds", async () => {
      const response = await context.request.get(`${base}/api/weather`);
      assert(response.ok(), `status ${response.status()}`);
      const data = await response.json();
      assert("weatherCode" in data && "isDay" in data, "weather shape invalid");
      return data;
    });

    await test("podcast API resolves 8 feeds", async () => {
      const response = await context.request.get(`${base}/api/podcasts`);
      assert(response.ok(), `status ${response.status()}`);
      const data = await response.json();
      assert(Array.isArray(data) && data.length === 8, `feed count ${data?.length}`);
      return {
        count: data.length,
        artwork: data.filter((item) => item.artwork).length,
      };
    });

    await test("no same-origin 4xx/5xx during core homepage interactions", async () => {
      assert(localBad.length === 0, JSON.stringify(localBad));
      return true;
    });
    await test("no browser console errors during core homepage interactions", async () => {
      const relevant = consoleErrors.filter(
        (message) =>
          !message.includes("favicon") &&
          !message.includes("ERR_INTERNET_DISCONNECTED"),
      );
      assert(
        relevant.length === 0,
        JSON.stringify({ consoleErrors: relevant, requestFailures }),
      );
      return true;
    });

    await context.close();
  } finally {
    await browser.close().catch(() => {});
    cleanupPlaywrightProcesses();
  }
}

async function runHomeMedia() {
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });

    await test("NotchShelf carousel controls", async () => {
      const carousel = page.locator(".notchshelf-carousel");
      await carousel.scrollIntoViewIfNeeded();
      await carousel.hover();
      await page.waitForTimeout(350);
      const images = carousel.locator("img.notchshelf-carousel-image");
      const first = await images.last().getAttribute("src");
      await carousel.locator('button[aria-label="Next image"]').click();
      await page.waitForFunction(
        (value) =>
          document
            .querySelector(
              ".notchshelf-carousel img.notchshelf-carousel-image:last-of-type",
            )
            ?.getAttribute("src") !== value,
        first,
        { timeout: 3000 },
      );
      const second = await images.last().getAttribute("src");
      assert(first !== second, "carousel did not advance");
      assert(
        (await carousel.locator(".notchshelf-carousel-dot").count()) === 5,
        "expected 5 dots",
      );
      return { first, second };
    });

    await test("photography cards reveal on demand without stalled loaders", async () => {
      const section = page.locator("#photography");
      const cards = section.locator(".captures-grid > div");
      const count = await cards.count();
      assert(count === 18, `photo cards ${count}`);
      for (let index = 0; index < count; index++) {
        await cards.nth(index).scrollIntoViewIfNeeded();
        await page.waitForFunction(
          (itemIndex) => {
            const card = document.querySelectorAll(
              "#photography .captures-grid > div",
            )[itemIndex];
            const img = card?.querySelector("img");
            return Boolean(
              img &&
                img.complete &&
                img.naturalWidth > 0 &&
                Number(getComputedStyle(img).opacity) >= 0.99,
            );
          },
          index,
          { timeout: 5000 },
        );
      }
      const state = await section.evaluate((root) => {
        const items = [...root.querySelectorAll(".captures-grid > div")];
        const visible = items.filter((card) => {
          const img = card.querySelector("img");
          return (
            img &&
            img.complete &&
            img.naturalWidth > 0 &&
            Number(getComputedStyle(img).opacity) >= 0.99
          );
        }).length;
        return {
          cards: items.length,
          visible,
          skeletons: root.querySelectorAll(".skeleton-loader").length,
        };
      });
      assert(state.visible === 18, `visible photos ${state.visible}/18`);
      assert(state.skeletons === 0, `stale skeletons ${state.skeletons}`);
      return state;
    });

    await test("photography lightbox keyboard navigation and close", async () => {
      const photo = page
        .locator("#photography .captures-grid")
        .locator(":scope > div")
        .first();
      await photo.scrollIntoViewIfNeeded();
      await photo.focus();
      await page.keyboard.press("Enter");
      const overlay = page.locator(".gallery-overlay");
      await overlay.waitFor({ state: "visible", timeout: 2000 });
      const counter = overlay
        .locator("div")
        .filter({ hasText: /^\d+ \/ \d+$/ })
        .last();
      const counter1 = await counter.innerText();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        (value) =>
          [...document.querySelectorAll(".gallery-overlay div")].some(
            (node) =>
              /^\d+ \/ \d+$/.test(node.textContent?.trim() || "") &&
              node.textContent.trim() !== value,
          ),
        counter1,
        { timeout: 3000 },
      );
      const counter2 = await counter.innerText();
      assert(counter1 !== counter2, "lightbox did not navigate");
      await page.keyboard.press("Escape");
      await overlay.waitFor({ state: "detached", timeout: 2000 });
      return { counter1, counter2 };
    });

    await context.close();
  } finally {
    await browser.close().catch(() => {});
    cleanupPlaywrightProcesses();
  }
}

async function runCamera() {
  const browser = await launch([
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ]);
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.grantPermissions(["camera"], { origin: base });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });

    await test("camera starts, captures, and exposes Retake/Download", async () => {
      const lens = page.locator('[role="button"][aria-label="Start camera"]');
      await lens.scrollIntoViewIfNeeded();
      await lens.click();
      await page.waitForFunction(
        () => {
          const video = document.querySelector("video.lens-media");
          return video && video.readyState >= 2;
        },
        undefined,
        { timeout: 8000 },
      );
      const shutter = page.locator("button.shutter");
      assert(await shutter.isEnabled(), "shutter not enabled");
      await shutter.click();
      await page.getByRole("button", { name: "Retake" }).waitFor({
        state: "visible",
        timeout: 6000,
      });
      await page.getByRole("button", { name: /Download/ }).waitFor({
        state: "visible",
        timeout: 2000,
      });
      return true;
    });

    await context.close();
  } finally {
    await browser.close().catch(() => {});
    cleanupPlaywrightProcesses();
  }
}

async function runCasePages() {
  const browser = await launch();
  try {
    await test("Clipt blog switches all 3 perspectives", async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      try {
        const page = await context.newPage();
        await page.goto(`${base}/blogs/clipt`, {
          waitUntil: "domcontentloaded",
        });
        await page.getByRole("button", { name: /For Designers/ }).click();
        await page.getByText("Designing for Trust").waitFor({
          state: "visible",
          timeout: 5000,
        });
        await page
          .getByRole("button", { name: /Explain Like I'm Five/ })
          .click();
        await page.getByText("How It Works (Simply Put)").waitFor({
          state: "visible",
          timeout: 5000,
        });
        await page.getByRole("button", { name: "The Story" }).click();
        await page.getByText("My Tech Stack").waitFor({
          state: "visible",
          timeout: 5000,
        });
        return true;
      } finally {
        await context.close();
      }
    });

    await test("District count-up reaches 22% and 18%", async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      try {
        const page = await context.newPage();
        await page.goto(`${base}/district`, { waitUntil: "domcontentloaded" });
        const metrics = page
          .locator(".case-study-main-content")
          .getByText(/increase|discoverability/i);
        for (let index = 0; index < (await metrics.count()); index++) {
          await metrics.nth(index).scrollIntoViewIfNeeded();
        }
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        await page.waitForFunction(
          () => {
            const text =
              document.querySelector(".case-study-main-content")?.textContent ||
              "";
            return text.includes("22%") && text.includes("18%");
          },
          undefined,
          { timeout: 6000 },
        );
        return true;
      } finally {
        await context.close();
      }
    });
  } finally {
    await browser.close().catch(() => {});
    cleanupPlaywrightProcesses();
  }
}

async function runMobile() {
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });

    await test("mobile menu opens and scrolls", async () => {
      const toggle = page.locator("button.mobile-menu-toggle");
      await toggle.click();
      assert(
        (await page.locator(".mobile-nav-overlay.open").count()) === 1,
        "overlay not open",
      );
      const about = page.locator(".mobile-nav-menu a", { hasText: "About" });
      await about.waitFor({ state: "visible" });
      await about.evaluate((element) => element.click());
      await page.waitForFunction(() => scrollY > 700, undefined, {
        timeout: 5000,
      });
      return true;
    });

    await test("mobile uses Brink mobile work image", async () => {
      const brink = page.locator(".mobile-work-brink .work-image-container img");
      await brink.scrollIntoViewIfNeeded();
      const src = await brink.getAttribute("src");
      assert(src?.includes("brink-work-mobile.jpg"), `unexpected ${src}`);
      return src;
    });

    await test("mobile camera controls remain available", async () => {
      const count = await page
        .locator('[role="button"][aria-label="Start camera"]')
        .count();
      assert(count === 1, `camera lens count ${count}`);
      return true;
    });

    await context.close();
  } finally {
    await browser.close().catch(() => {});
    cleanupPlaywrightProcesses();
  }
}

await runHomeCore();
await runHomeMedia();
await runCamera();
await runCasePages();
await runMobile();

const failed = results.filter((result) => !result.ok);
const summary = {
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed,
};
await fs.writeFile(
  "qa/functionality-report.json",
  JSON.stringify({ base, summary, results }, null, 2),
);
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
process.exitCode = failed.length ? 1 : 0;
