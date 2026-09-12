import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";
import { loadQaProfile } from "./profile.mjs";
import { freshWeather } from "./service-fixtures.mjs";

const profile = loadQaProfile();
const browser = await chromium.launch({
  executablePath: resolveChromePath(),
  headless: true,
});
const report = [];
try {
  for (const state of profile.features.weather
    ? ["fresh", "unavailable", "timeout", "malformed", "recovery"]
    : ["disabled"]) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    let requests = 0;
    await context.route(/\/api\/weather$/, async (route) => {
      requests++;
      if (state === "timeout") {
        await new Promise((resolve) => setTimeout(resolve, 6500));
        await route.abort().catch(() => {});
      } else
        await route.fulfill({
          status:
            state === "unavailable" || (state === "recovery" && requests === 1)
              ? 503
              : 200,
          contentType: "application/json",
          body: JSON.stringify(
            state === "unavailable" || (state === "recovery" && requests === 1)
              ? { status: "unavailable" }
              : state === "malformed"
                ? { status: "fresh", temperature: "wrong" }
                : freshWeather,
          ),
        });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:4181", {
      waitUntil: "networkidle",
    });
    if (state === "disabled") {
      assert.equal(await page.locator(".weather-label").count(), 0);
      assert.equal(requests, 0);
    } else {
      const requestDeadline = Date.now() + 5000;
      while (requests < 1 && Date.now() < requestDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(requests >= 1, "enabled widget did not request weather");
      await page.waitForFunction((fresh) => {
        const text =
          document.querySelector(".weather-label")?.textContent ?? "";
        return fresh
          ? text.includes("21°")
          : text.includes("—") && !text.includes("°");
      }, state === "fresh");
      if (state === "recovery") {
        await page.evaluate(() =>
          document.dispatchEvent(new Event("visibilitychange")),
        );
        await page.waitForFunction(() =>
          document.querySelector(".weather-label")?.textContent.includes("21°"),
        );
        assert.equal(requests, 2);
      }
    }
    assert.deepEqual(errors, [], `${state}: unhandled browser error`);
    report.push({ state, requests, passed: true });
    console.log(`PASS weather UI: ${state}`);
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(
    "qa/weather-states-report.json",
    JSON.stringify(report, null, 2),
  );
}
