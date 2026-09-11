import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { installServiceFixtures } from "./service-fixtures.mjs";

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  await installServiceFixtures(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:4181", {
    waitUntil: "networkidle",
  });
  const card = page.getByRole("button", {
    name: "Open photograph 1 of",
    exact: false,
  });
  if (await card.count()) {
    const image = card.locator("img");
    assert.equal(await image.evaluate((img) => img.style.transform), "none");
    assert.equal(await image.evaluate((img) => img.style.willChange), "auto");
    for (let cycle = 0; cycle < 2; cycle++) {
      await card.scrollIntoViewIfNeeded();
      await image.evaluate((img) => img.decode());
      await page.waitForFunction(() =>
        document
          .querySelector(".captures-grid img")
          ?.style.transform.includes("translateY"),
      );
      assert.equal(
        await image.evaluate((img) => img.style.willChange),
        "transform",
      );
      const before = await image.evaluate((img) => img.style.transform);
      await page.evaluate(() => scrollBy(0, 120));
      await page.waitForFunction((previous) => {
        const transform =
          document.querySelector(".captures-grid img")?.style.transform;
        return transform?.includes("translateY") && transform !== previous;
      }, before);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(
        () =>
          document.querySelector(".captures-grid img")?.style.transform ===
          "none",
      );
      assert.equal(await image.evaluate((img) => img.style.willChange), "auto");
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (let cycle = 0; cycle < 2; cycle++) {
      await card.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () =>
          document.querySelector(".captures-grid img")?.style.willChange ===
          "transform",
      );
      assert.equal(await image.evaluate((img) => img.style.transform), "none");
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(
        () =>
          document.querySelector(".captures-grid img")?.style.willChange ===
          "auto",
      );
    }
    console.log(
      "PASS parallax and compositing prewarm, stop offscreen, and reactivate; reduced motion keeps static image sampling",
    );
  } else console.log("PASS parallax: photography disabled");
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
