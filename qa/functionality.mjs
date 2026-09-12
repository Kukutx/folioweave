import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import { loadQaProfile } from "./profile.mjs";
import { installServiceFixtures } from "./service-fixtures.mjs";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const chrome = resolveChromePath();
const results = [];
const portfolio = loadQaProfile();
const demoRoutesEnabled = portfolio.features?.demoRoutes !== false;
const timelineFirstTitle = portfolio.about?.timeline?.[0]?.title;
const expectedPhotoCount = portfolio.features.photography ? portfolio.photography.images.length : 0;
const enabledProjects = (portfolio.projects ?? []).filter(
  (project) => portfolio.features.work && project.enabled,
);
const carouselProjects = enabledProjects.filter(
  (project) => project.media?.kind === "carousel",
);
const mobileProject = enabledProjects.find(
  (project) =>
    (project.media?.kind === "carousel"
      ? project.media.images.some((image) => image.mobile)
      : project.media?.image?.mobile),
);

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

async function absent(page, selector) {
  assert(await page.locator(selector).count() === 0, `disabled content rendered: ${selector}`);
  return { enabled: false };
}

async function launch(extraArgs = []) {
  return chromium.launch({
    executablePath: chrome,
    headless: true,
    args: [...commonArgs, ...extraArgs],
  });
}

async function waitForHydratedElement(page, selector) {
  await page.waitForFunction(
    (value) => {
      const element = document.querySelector(value);
      return Boolean(
        element &&
          Object.keys(element).some(
            (key) =>
              key.startsWith("__reactProps$") || key.startsWith("__reactFiber$"),
          ),
      );
    },
    selector,
    { timeout: 10_000 },
  );
}

async function runHomeCore() {
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    await installServiceFixtures(context, portfolio);
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


    await test("designer cursors preserve reference desktop behavior", async () => {
      const designerOverlay = page.locator("[data-designer-overlay]");
      const userPointer = page.locator("[data-user-pointer]");
      await designerOverlay.waitFor({ state: "attached", timeout: 3000 });
      await userPointer.waitFor({ state: "attached", timeout: 3000 });
      await page.mouse.move(500, 300);
      await page.waitForTimeout(80);
      assert(
        await userPointer.getByText("You", { exact: true }).isVisible(),
        "reference You cursor is not visible on desktop",
      );
      assert(
        (await page.evaluate(() => getComputedStyle(document.body).cursor)) === "none",
        "native cursor is not hidden while the reference cursor treatment is active",
      );
      return { cursor: "You", nativeCursor: "none" };
    });

    await test("hero greeting cycles", async () => {
      const first = (await page.locator(".hero-greeting").innerText()).trim();
      if (new Set(portfolio.hero.greetings).size === 1) {
        assert(first === `${portfolio.hero.greetings[0]},`, "single greeting differs from configuration");
        return { single: first };
      }
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
      if (new Set(portfolio.hero.portraits).size === 1) {
        assert(await img.getAttribute("src") === first, "single portrait changed");
        return { single: first };
      }
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
      if (!portfolio.features.about) return absent(page, '#about, .nav-links a[href="#about"]');
      if (!portfolio.site.navigation.some((item) => item.href === "#about")) return absent(page, '.nav-links a[href="#about"]');
      await page.locator('.nav-links a[href="#about"]').click();
      await page.waitForFunction(() => scrollY > 700, undefined, {
        timeout: 5000,
      });
      return { scrollY: Math.round(await page.evaluate(() => scrollY)) };
    });

    await test("About TLDR and Timeline switch", async () => {
      if (!portfolio.features.about) return absent(page, "#about");
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
      assert(timelineFirstTitle, "timeline config is empty");
      await root.getByText(timelineFirstTitle, { exact: true }).waitFor({
        state: "visible",
        timeout: 3000,
      });
      return { firstTitle: timelineFirstTitle };
    });

    await test("resume printer reaches ready and downloads PDF", async () => {
      if (!portfolio.features.resume) return absent(page, ".resume-printer");
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
      await waitForHydratedElement(page, ".nav .cycle-btn");
      const btn = page.locator(".nav .cycle-btn");
      const first = (await btn.innerText()).trim();
      await btn.hover();
      await page.waitForFunction(
        (value) =>
          document.querySelector(".nav .cycle-btn")?.textContent?.trim() !==
          value,
        first,
        { timeout: 5000 },
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

    await test("weather widget respects its feature flag", async () => {
      if (!portfolio.features.weather) {
        const response = await context.request.get(`${base}/api/weather`);
        assert(response.status() === 404, "disabled weather endpoint is published");
        return absent(page, ".weather-label");
      }
      assert((await page.locator(".weather-label").innerText()).includes("21°"), "fixture temperature missing");
      return { state: "fresh" };
    });

    await test("time zone label follows configured daylight-saving rules", async () => {
      if (!portfolio.features.weather) return { enabled: false };
      const actual = await page.locator(".timezone-label").innerText();
      const expected = await page.evaluate(
        ({ locale, timeZone }) =>
          new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
            .formatToParts(new Date())
            .find((part) => part.type === "timeZoneName")?.value ?? "",
        {
          locale: portfolio.site.identity.locale,
          timeZone: portfolio.site.location.timeZone,
        },
      );
      assert(actual === expected, `time zone label ${actual} !== ${expected}`);
      return { label: actual };
    });

    await test("podcast API respects demoRoutes", async () => {
      const response = await context.request.get(`${base}/api/podcasts`);
      if (!demoRoutesEnabled) {
        assert(response.status() === 404, `status ${response.status()}`);
        return { enabled: false, status: response.status() };
      }
      assert(response.ok(), `status ${response.status()}`);
      const data = await response.json();
      assert(Array.isArray(data) && data.length === 8, `feed count ${data?.length}`);
      return {
        enabled: true,
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

    await test("carousel project controls", async () => {
      if (!carouselProjects.length) return { skipped: true };
      const carousels = page.locator(".notchshelf-carousel");
      assert(
        (await carousels.count()) === carouselProjects.length,
        `expected ${carouselProjects.length} carousels`,
      );
      const tested = [];
      for (let index = 0; index < carouselProjects.length; index++) {
        const project = carouselProjects[index];
        const carousel = carousels.nth(index);
        await carousel.scrollIntoViewIfNeeded();
        await carousel.hover();
        await page.waitForTimeout(250);
        const images = carousel.locator("img.notchshelf-carousel-image");
        const first = await images.last().getAttribute("src");
        if (project.media.images.length > 1) {
          await carousel.locator('button[aria-label="Next image"]').click();
          await page.waitForFunction(
            ({ carouselIndex, value }) => {
              const nodes = document.querySelectorAll(".notchshelf-carousel");
              return nodes[carouselIndex]
                ?.querySelector("img.notchshelf-carousel-image:last-of-type")
                ?.getAttribute("src") !== value;
            },
            { carouselIndex: index, value: first },
            { timeout: 3000 },
          );
        }
        const second = await images.last().getAttribute("src");
        if (project.media.images.length > 1) {
          assert(first !== second, `${project.id} carousel did not advance`);
        }
        assert(
          (await carousel.locator(".notchshelf-carousel-dot").count()) ===
            project.media.images.length,
          `${project.id}: expected ${project.media.images.length} dots`,
        );
        tested.push({ project: project.id, first, second });
      }
      return tested;
    });

    await test("photography cards reveal on demand without stalled loaders", async () => {
      if (!portfolio.features.photography) return absent(page, "#photography");
      const section = page.locator("#photography");
      const cards = section.locator(".captures-grid > div");
      const count = await cards.count();
      assert(count === expectedPhotoCount, `photo cards ${count}/${expectedPhotoCount}`);
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
      assert(
        state.visible === expectedPhotoCount,
        `visible photos ${state.visible}/${expectedPhotoCount}`,
      );
      assert(state.skeletons === 0, `stale skeletons ${state.skeletons}`);
      return state;
    });

    await test("photography lightbox keyboard navigation and close", async () => {
      if (!expectedPhotoCount) return absent(page, "#photography .captures-grid > div");
      const photo = page
        .locator("#photography .captures-grid")
        .locator(":scope > div")
        .first();
      await photo.scrollIntoViewIfNeeded();
      await photo.focus();
      await page.keyboard.press("Enter");
      const overlay = page.locator(".gallery-overlay");
      await overlay.waitFor({ state: "visible", timeout: 2000 });
      assert(
        await overlay.locator('[aria-label="Close gallery"]').evaluate(
          (button) => document.activeElement === button,
        ),
        "lightbox did not focus its close control",
      );
      assert(
        (await page.locator("body").evaluate((body) => body.style.overflow)) === "hidden",
        "lightbox did not lock background scrolling",
      );
      const counter = overlay
        .locator("div")
        .filter({ hasText: /^\d+ \/ \d+$/ })
        .last();
      const counter1 = await counter.innerText();
      await page.keyboard.press("ArrowRight");
      if (expectedPhotoCount > 1) await page.waitForFunction(
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
      assert(expectedPhotoCount > 1 ? counter1 !== counter2 : counter1 === counter2, "lightbox index disagrees with its image count");
      await page.keyboard.press("Escape");
      await overlay.waitFor({ state: "detached", timeout: 2000 });
      assert(await photo.evaluate((card) => document.activeElement === card), "lightbox did not restore focus");
      assert(
        (await page.locator("body").evaluate((body) => body.style.overflow)) !== "hidden",
        "lightbox did not restore background scrolling",
      );
      return { counter1, counter2 };
    });

    await context.close();
  } finally {
    await browser.close().catch(() => {});
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
    if (portfolio.features.photography) await waitForHydratedElement(page, '[aria-label="Start camera"]');

    await test("camera starts, captures, and exposes Retake/Download", async () => {
      if (!portfolio.features.photography) return absent(page, '[aria-label="Start camera"]');
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
  }
}

async function runCasePages() {
  const browser = await launch();
  try {

    await test("demo blog index preserves reference presentation", async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      try {
        const page = await context.newPage();
        const response = await page.goto(`${base}/blogs`, {
          waitUntil: "domcontentloaded",
        });
        if (!demoRoutesEnabled) {
          assert(response?.status() === 404 || response?.ok(), `status ${response?.status()}`);
          return { enabled: false, status: response?.status() };
        }
        assert(
          (await page.locator(".writing-title").innerText()).trim() === "OG Blogs",
          "demo blog title drifted from the reference presentation",
        );
        const highlights = await page
          .locator(".writing-header .highlight-yellow")
          .allTextContents();
        assert(
          JSON.stringify(highlights.map((value) => value.trim())) ===
            JSON.stringify([
              "design engineering",
              "product philosophy",
              "obsession with detail",
            ]),
          `demo blog highlights drifted: ${JSON.stringify(highlights)}`,
        );
        assert(
          (await page.locator(".blog-date").first().innerText()).includes("Jan 26, 2026"),
          "demo blog date drifted from Jan 26, 2026",
        );
        return { title: "OG Blogs", highlights: highlights.length, date: "Jan 26, 2026" };
      } finally {
        await context.close();
      }
    });

    await test("Clipt blog switches all 3 perspectives", async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      try {
        const page = await context.newPage();
        const response = await page.goto(`${base}/blogs/clipt`, {
          waitUntil: "domcontentloaded",
        });
        if (!demoRoutesEnabled) {
          assert(response?.status() === 404, `status ${response?.status()}`);
          return { enabled: false, status: response.status() };
        }
        assert(
          (await page.locator(".blog-post-meta .blog-date").innerText()).includes("Jan 26, 2026"),
          "Clipt article date drifted from Jan 26, 2026",
        );
        await waitForHydratedElement(page, ".perspective-tag");
        await page
          .locator(".perspective-tag")
          .filter({ hasText: "For Designers" })
          .click();
        await page.getByText("Designing for Trust").waitFor({
          state: "visible",
          timeout: 5000,
        });
        await page
          .locator(".perspective-tag")
          .filter({ hasText: "Explain Like I'm Five" })
          .click();
        await page.getByText("How It Works (Simply Put)").waitFor({
          state: "visible",
          timeout: 5000,
        });
        await page
          .locator(".perspective-tag")
          .filter({ hasText: "The Story" })
          .click();
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
        const response = await page.goto(`${base}/district`, {
          waitUntil: "domcontentloaded",
        });
        if (!demoRoutesEnabled) {
          assert(response?.status() === 404, `status ${response?.status()}`);
          return { enabled: false, status: response.status() };
        }
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
  }
}

async function runMobile() {
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await installServiceFixtures(context, portfolio, base);
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await waitForHydratedElement(page, "button.mobile-menu-toggle");

    await test("mobile menu opens and scrolls", async () => {
      const toggle = page.locator("button.mobile-menu-toggle");
      await toggle.click();
      assert(
        (await page.locator(".mobile-nav-overlay.open").count()) === 1,
        "overlay not open",
      );
      const about = page.locator('.mobile-nav-menu a[href^="#"]:not([href="#home"])').first();
      if (!await about.count()) {
        await page.keyboard.press("Escape");
        assert(await toggle.getAttribute("aria-expanded") === "false", "empty section menu did not close");
        return { sectionLinks: 0 };
      }
      await about.waitFor({ state: "visible" });
      await about.dispatchEvent("click");
      await page.waitForFunction(() => scrollY > 700, undefined, {
        timeout: 5000,
      });
      // Reaching the section is not the end of Lenis's animation. Otherwise
      // the next test's native scroll can be overwritten before a lazy image
      // enters the viewport, making currentSrc stay empty indefinitely.
      await page.waitForFunction(() => !window.__lenis?.isScrolling);
      return true;
    });

    await test("mobile uses configured art-directed work image", async () => {
      if (!mobileProject) return { skipped: true };
      const selector = `.work-list > .work-item:nth-child(${enabledProjects.indexOf(mobileProject) + 1}) .work-image-container img`;
      const image = page.locator(selector);
      await image.scrollIntoViewIfNeeded();
      const expected =
        mobileProject.media.kind === "carousel"
          ? (mobileProject.media.images[0].mobile ?? mobileProject.media.images[0].src)
          : (mobileProject.media.image.mobile ?? mobileProject.media.image.src);
      await page.waitForFunction(
        ({ value, src }) => {
          const image = document.querySelector(value);
          if (!image?.currentSrc) return false;
          const selected = new URL(image.currentSrc, location.href);
          return (selected.searchParams.get("url") ?? selected.pathname) === src;
        },
        { value: selector, src: expected },
        { timeout: 5000 },
      );
      const src = await image.evaluate((element) => {
        const selected = new URL(element.currentSrc, location.href);
        return selected.searchParams.get("url") ?? selected.pathname;
      });
      assert(src === expected, `unexpected ${src}`);
      return { project: mobileProject.id, src };
    });

    await test("mobile camera controls remain available", async () => {
      if (!portfolio.features.photography) return absent(page, '[aria-label="Start camera"]');
      const count = await page
        .locator('[role="button"][aria-label="Start camera"]')
        .count();
      assert(count === 1, `camera lens count ${count}`);
      return true;
    });

    await context.close();
  } finally {
    await browser.close().catch(() => {});
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
