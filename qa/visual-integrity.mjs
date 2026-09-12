import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";
import { PNG } from "pngjs";
import { installServiceFixtures } from "./service-fixtures.mjs";
import { verifyVisualBaseline } from "./visual-contract.mjs";

// Capture real content, including lazy images. No images or sections are masked.
const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const updateRegression = process.argv.includes("--update-regression");
const regression = updateRegression || process.argv.includes("--regression");
const classicScrollbars = process.argv.includes("--classic-scrollbars");
const label = `after${classicScrollbars ? "-classic" : ""}`;
const directory = regression
  ? `qa/screens/regression-${process.pid}`
  : `qa/screens/integrity-${label}`;
await fs.rm(directory, { recursive: true, force: true });
await fs.mkdir(directory, { recursive: true });
const report = [];
const browser = await chromium.launch({
  executablePath: regression ? undefined : resolveChromePath(),
  headless: true,
  args: ["--disable-gpu", "--no-sandbox"],
  ignoreDefaultArgs: classicScrollbars ? ["--hide-scrollbars"] : [],
});
try {
  for (const width of classicScrollbars
    ? [1440]
    : [360, 390, 767, 768, 820, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await installServiceFixtures(context);
    await page.clock.setFixedTime(new Date("2026-01-15T12:00:00Z"));
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const gallery = page.locator(".story-gallery");
    if (await gallery.count()) {
      await gallery.scrollIntoViewIfNeeded();
      for (let i = 0; i < (await gallery.locator("img").count()); i++) {
        await gallery.locator("img").nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
      }
      await gallery.evaluate((el) => {
        el.scrollLeft = 0;
      });
    }
    // Trigger every viewport reveal and lazy load before inspecting below-fold content.
    for (
      let y = 0;
      y < (await page.evaluate(() => document.body.scrollHeight));
      y += 650
    ) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(100);
    }
    await page.evaluate(() =>
      Promise.race([
        Promise.all(
          [...document.images]
            .filter((img) => img.getClientRects().length)
            .map((img) => img.decode().catch(() => {})),
        ),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]),
    );
    await page.waitForTimeout(2100);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
    const geometry = await page.evaluate(() => {
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
      };
      return {
        sections: Object.fromEntries(
          [...document.querySelectorAll("section[id]")].map((el) => [
            el.id,
            box(el),
          ]),
        ),
        work: [...document.querySelectorAll(".work-image-container")].map(box),
        photos: [...document.querySelectorAll(".captures-grid > *")].map(box),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        scrollbarWidth: innerWidth - document.documentElement.clientWidth,
        broken: [...document.images]
          .filter(
            (img) =>
              img.getClientRects().length &&
              (!img.complete || !img.naturalWidth),
          )
          .map((img) => img.src),
      };
    });
    await page.screenshot({
      path: `${directory}/${width}-home.png`,
      fullPage: true,
    });
    if (regression)
      await page.screenshot({
        path: `${directory}/${width}-hero.png`,
        animations: "disabled",
      });
    // Text reveals intentionally reset offscreen. Inspect sections in-view too,
    // rather than treating a stitched full-page screenshot as their only proof.
    for (const id of ["about", "work", "photography", "contact"]) {
      const section = page.locator(`#${id}`);
      if (!(await section.count())) continue;
      await section.evaluate((el) =>
        window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 100),
      );
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${directory}/${width}-${id}.png` });
    }
    const photo = page.getByRole("button", {
      name: "Open photograph 1 of",
      exact: false,
    });
    let lightbox = null;
    if (await photo.count()) {
      await photo.scrollIntoViewIfNeeded();
      await photo.focus();
      await page.waitForTimeout(300);
      const before = await page.locator("#photography").boundingBox();
      const scrollBefore = await page.evaluate(() => scrollY);
      assert.equal(
        await photo.evaluate((el) => document.activeElement === el),
        true,
        "photograph receives keyboard focus",
      );
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Photography viewer" });
      await dialog.waitFor();
      await dialog
        .locator('img:not([aria-hidden="true"])')
        .evaluate((img) => img.decode());
      await page.waitForTimeout(700);
      lightbox = await dialog.evaluate((el) => {
        const img = el.querySelector('img:not([aria-hidden="true"])');
        const r = img.getBoundingClientRect();
        const bounds = el.getBoundingClientRect();
        return {
          naturalRatio: img.naturalWidth / img.naturalHeight,
          renderedRatio: r.width / r.height,
          image: { x: r.x, y: r.y, width: r.width, height: r.height },
          viewportCovered:
            Math.abs(bounds.x) < 1 &&
            Math.abs(bounds.y) < 1 &&
            bounds.width >= innerWidth - 1 &&
            bounds.height >= innerHeight - 1,
          focusInside: el.contains(document.activeElement),
          topLayer: el.matches("dialog:modal"),
        };
      });
      lightbox.backgroundShift = Math.abs(
        (await page.locator("#photography").boundingBox()).x - before.x,
      );
      await page.screenshot({ path: `${directory}/${width}-lightbox.png` });
      if (classicScrollbars) {
        const screenshot = PNG.sync.read(
          await fs.readFile(`${directory}/${width}-lightbox.png`),
        );
        const edge =
          (Math.floor(screenshot.height / 2) * screenshot.width +
            screenshot.width -
            1) *
          4;
        lightbox.gutterCovered = [
          ...screenshot.data.subarray(edge, edge + 3),
        ].every((channel) => channel < 20);
      }
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      lightbox.focusTrapped = await dialog.evaluate((el) =>
        el.contains(document.activeElement),
      );
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(500);
      const nextNumber = geometry.photos.length > 1 ? 2 : 1;
      lightbox.nextWorks = (
        await dialog.locator('[aria-live="polite"]').innerText()
      ).startsWith(`${nextNumber} /`);
      const currentImage = dialog.locator('img:not([aria-hidden="true"])');
      await currentImage.evaluate((img) => img.decode());
      lightbox.nextRatioError = await currentImage.evaluate((img) => {
        const r = img.getBoundingClientRect();
        return Math.abs(
          r.width / r.height - img.naturalWidth / img.naturalHeight,
        );
      });
      await page.screenshot({
        path: `${directory}/${width}-lightbox-next.png`,
      });
      const portraitIndex = await page
        .locator(".captures-grid img")
        .evaluateAll((images) =>
          images.findIndex((img) => img.naturalWidth < img.naturalHeight),
        );
      if (portraitIndex > 1) {
        for (let index = 1; index < portraitIndex; index++)
          await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => {
          const images = [...document.querySelectorAll(".gallery-overlay img")];
          return images.filter(
            (img) => getComputedStyle(img).opacity === "1",
          ).length === 1;
        });
        const portraitImage = dialog.locator(
          'img:not([aria-hidden="true"])',
        );
        await portraitImage.evaluate((img) => img.decode());
        await page.waitForTimeout(500);
        lightbox.portraitRatioError = await portraitImage.evaluate((img) => {
          const r = img.getBoundingClientRect();
          return Math.abs(
            r.width / r.height - img.naturalWidth / img.naturalHeight,
          );
        });
        await page.screenshot({
          path: `${directory}/${width}-lightbox-portrait.png`,
        });
      }
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      lightbox.focusRestored = await photo.evaluate(
        (el) => document.activeElement === el,
      );
      lightbox.scrollShift = Math.abs(
        (await page.evaluate(() => scrollY)) - scrollBefore,
      );
      if (classicScrollbars) {
        lightbox.repeatedScrollShifts = [];
        for (let cycle = 0; cycle < 5; cycle++) {
          const origin = await page.evaluate(() => scrollY);
          await page.keyboard.press("Enter");
          await dialog.waitFor();
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "detached" });
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          lightbox.repeatedScrollShifts.push(
            Math.abs((await page.evaluate(() => scrollY)) - origin),
          );
        }
      }
    }
    const item = { width, geometry, lightbox, errors };
    report.push(item);
    console.log(
      `${width}: ${geometry.photos.length} photos, ${geometry.broken.length} broken; lightbox ${JSON.stringify(lightbox)}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(
    `qa/visual-integrity-${label}-report.json`,
    JSON.stringify(report, null, 2),
  );
}
{
  for (const { width, geometry, lightbox, errors } of report) {
    assert.deepEqual(errors, [], `${width}: browser errors`);
    assert.equal(geometry.overflow, false, `${width}: horizontal overflow`);
    assert.deepEqual(geometry.broken, [], `${width}: broken images`);
    if (classicScrollbars)
      assert.ok(
        geometry.scrollbarWidth > 0,
        "classic scrollbar coverage requires a real scrollbar gutter",
      );
    if (lightbox) {
      assert.ok(
        Math.abs(lightbox.naturalRatio - lightbox.renderedRatio) < 0.015,
        `${width}: lightbox aspect ratio`,
      );
      assert.ok(
        lightbox.nextRatioError < 0.015,
        `${width}: next image aspect ratio`,
      );
      if (lightbox.portraitRatioError !== undefined)
        assert.ok(
          lightbox.portraitRatioError < 0.015,
          `${width}: portrait image aspect ratio`,
        );
      assert.ok(
        lightbox.viewportCovered &&
          lightbox.focusInside &&
          lightbox.focusTrapped &&
          lightbox.focusRestored &&
          lightbox.nextWorks &&
          lightbox.topLayer,
        `${width}: lightbox interaction`,
      );
      assert.ok(
        lightbox.backgroundShift < 1 && lightbox.scrollShift < 1,
        `${width}: lightbox layout shift`,
      );
      if (classicScrollbars)
        assert.equal(
          lightbox.gutterCovered,
          true,
          "modal leaves an unpainted scrollbar gutter",
        );
      if (classicScrollbars)
        assert.ok(
          lightbox.repeatedScrollShifts.every((shift) => shift < 1),
          "repeated modal lifecycle changes scroll position",
        );
    }
  }
}
if (regression) {
  let passed = false;
  try {
    await verifyVisualBaseline({
      report,
      directory,
      browserVersion: browser.version(),
      update: updateRegression,
    });
    passed = true;
  } finally {
    if (passed) await fs.rm(directory, { recursive: true, force: true });
  }
}
