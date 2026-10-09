import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, firefox, webkit } from "playwright-core";
import { firstPhotograph } from "./profile.mjs";
import { installServiceFixtures } from "./service-fixtures.mjs";

const screenshots = "qa/screens/browsers";
const keepScreenshots = process.env.KEEP_QA_SCREENSHOTS === "1";
const report = [];
let passed = false;
await fs.rm(screenshots, { recursive: true, force: true });
await fs.mkdir(screenshots, { recursive: true });
try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const width of [390, 1440]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        await installServiceFixtures(context);
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(process.env.BASE_URL || "http://127.0.0.1:4181", {
          waitUntil: "networkidle",
        });
        await page.evaluate(() => document.fonts.ready);
        assert.ok(
          (await page.locator("main").innerText()).trim().length > 0,
          "blank page",
        );
        assert.equal(
          await page.locator("[data-nextjs-dialog]").count(),
          0,
          "error overlay",
        );
        if (width < 768) {
          const menu = page.locator(".mobile-menu-toggle");
          await menu.click();
          assert.equal(await menu.getAttribute("aria-expanded"), "true");
          await page.keyboard.press("Escape");
          assert.equal(await menu.getAttribute("aria-expanded"), "false");
        }
        const photo = await firstPhotograph(page);
        if (photo) {
          await photo.scrollIntoViewIfNeeded();
          await photo.focus();
          await page.evaluate(() =>
            document.documentElement.style.setProperty(
              "background-color",
              "rgb(18, 52, 86)",
              "important",
            ),
          );
          // Bringing the photograph into view may still be easing. Compare
          // positions at rest, or the easing itself reads as a shifted viewport.
          const atRest = () =>
            page.evaluate(
              () =>
                new Promise((resolve) => {
                  let previous = scrollY,
                    still = 0;
                  const started = performance.now();
                  const check = () => {
                    still =
                      scrollY === previous && !window.__lenis?.isScrolling
                        ? still + 1
                        : 0;
                    previous = scrollY;
                    if (still >= 4 || performance.now() - started > 3000)
                      resolve(scrollY);
                    else requestAnimationFrame(check);
                  };
                  requestAnimationFrame(check);
                }),
            );
          for (let cycle = 0; cycle < 3; cycle++) {
            const scrollBefore = await atRest();
            await page.keyboard.press("Enter");
            const dialog = page.getByRole("dialog", {
              name: "Photography viewer",
            });
            await dialog.waitFor();
            assert.equal(
              await dialog.evaluate((el) => el.matches("dialog:modal")),
              true,
            );
            await page.keyboard.press("Tab");
            assert.equal(
              await dialog.evaluate((el) =>
                el.contains(document.activeElement),
              ),
              true,
            );
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("Escape");
            await dialog.waitFor({ state: "detached" });
            assert.ok(
              Math.abs((await atRest()) - scrollBefore) < 1,
              "modal close shifts the viewport",
            );
            assert.deepEqual(
              await page.evaluate(() => [
                document.documentElement.style.backgroundColor,
                document.documentElement.style.getPropertyPriority(
                  "background-color",
                ),
              ]),
              ["rgb(18, 52, 86)", "important"],
              "modal failed to restore the caller's root background",
            );
            assert.equal(
              await photo.evaluate((el) => document.activeElement === el),
              true,
            );
          }
        }
        const link = page.locator('a[href="#contact"]').first();
        if ((await link.count()) && (await link.isVisible())) {
          await link.click();
          await page.waitForFunction(() => location.hash === "#contact");
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          "horizontal overflow",
        );
        assert.deepEqual(errors, []);
        await page.screenshot({
          path: `qa/screens/browsers/${engine.name()}-${width}.png`,
        });
        report.push({
          engine: engine.name(),
          version: browser.version(),
          width,
          passed: true,
        });
        console.log(
          `PASS ${engine.name()} ${width}: load, navigation, modal lifecycle, focus, overflow`,
        );
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
  passed = true;
} finally {
  await fs.writeFile(
    "qa/cross-browser-report.json",
    JSON.stringify(report, null, 2),
  );
  if (passed && !keepScreenshots) {
    await fs.rm(screenshots, { recursive: true, force: true });
    await fs.rmdir("qa/screens").catch(() => {});
  }
}
