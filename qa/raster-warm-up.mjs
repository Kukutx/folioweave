import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";
import { installServiceFixtures } from "./service-fixtures.mjs";

// Classic paints every section once, out of sight, while the page is idle, so
// the GPU programs exist before a first scroll needs them. This holds it to its
// promises: nobody can see, reach or address the copy, it never loads what the
// page has not loaded, it yields to the visitor, and it leaves nothing behind.
const browser = await chromium.launch({
  executablePath: resolveChromePath(),
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  await installServiceFixtures(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:4181", {
    waitUntil: "load",
  });
  const survey = () =>
    page.evaluate(() => {
      const ids = Array.from(
        document.querySelectorAll("[id]"),
        (node) => node.id,
      );
      return {
        sections: document.querySelectorAll("[data-theme-scope]").length,
        cameras: document.querySelectorAll(".instax-container").length,
        duplicateIds: ids.length - new Set(ids).size,
        // Every address an image the page has not loaded could be fetched
        // from, for images far enough below that the browser's own lazy
        // loading leaves them alone.
        deferred: Array.from(document.images)
          .filter(
            (image) =>
              (!image.complete || !image.naturalWidth) &&
              image.getBoundingClientRect().top + scrollY > 5000,
          )
          .flatMap((image) => [
            image.getAttribute("src") ?? "",
            ...(image.getAttribute("srcset") ?? "")
              .split(",")
              .map((candidate) => candidate.trim().split(/s+/)[0]),
          ])
          .filter(Boolean)
          .map((address) => new URL(address, location.href).href),
      };
    });
  const before = await survey();
  const fetched = [];
  page.on("request", (request) => fetched.push(request.url()));
  await page.waitForSelector("[data-raster-warm-up-stage]", {
    state: "attached",
    timeout: 20000,
  });
  const stage = await page.evaluate(() => {
    const host = document.querySelector("[data-raster-warm-up-stage]");
    const style = getComputedStyle(host);
    const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return {
      state: document.querySelector("[data-raster-warm-up]").dataset
        .rasterWarmUp,
      closed: host.shadowRoot === null,
      hidden: host.getAttribute("aria-hidden"),
      inert: host.inert,
      pointerEvents: style.pointerEvents,
      faint: Number(style.opacity) > 0 && Number(style.opacity) < 0.01,
      children: host.childElementCount,
      reachable: hit === host || host.contains(hit),
    };
  });
  assert.deepEqual(stage, {
    state: "running",
    closed: true,
    hidden: "true",
    inert: true,
    pointerEvents: "none",
    faint: true,
    children: 0,
    reachable: false,
  });
  // The page itself is as it was: one of everything, every id still unique.
  const during = await survey();
  assert.deepEqual(
    { ...during, deferred: 0 },
    { ...before, deferred: 0, duplicateIds: 0 },
  );

  // The visitor comes first: the stage steps aside at once and returns only
  // after they have been still for a while.
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(() => {
    const host = document.querySelector("[data-raster-warm-up-stage]");
    return !host || host.style.display === "none";
  });
  await page.mouse.wheel(0, -120);

  await page.waitForSelector('[data-raster-warm-up="done"]', {
    state: "attached",
    timeout: 120000,
  });
  const after = await survey();
  assert.equal(
    await page.locator("[data-raster-warm-up-stage]").count(),
    0,
    "The stage outlived the warm-up",
  );
  assert.deepEqual(
    {
      sections: after.sections,
      cameras: after.cameras,
      ids: after.duplicateIds,
    },
    { sections: before.sections, cameras: before.cameras, ids: 0 },
  );
  // Nothing was fetched early: the copies leave unloaded images unloaded.
  assert.deepEqual(
    fetched.filter((address) => before.deferred.includes(address)),
    [],
    "The warm-up fetched an image the page had not asked for",
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS raster warm-up: ${before.sections} sections painted out of sight and out of reach, yields to input, loads nothing early, leaves nothing behind`,
  );
} finally {
  await browser.close();
}
