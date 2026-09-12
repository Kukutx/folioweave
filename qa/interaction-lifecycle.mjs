import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const browser = await chromium.launch({
  executablePath: resolveChromePath(),
  headless: true,
});
const report = [];
await fs.mkdir("qa/screens/lifecycle", { recursive: true });
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktop.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(
    await page
      .locator(".nav")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
    "CSS must not retarget the navigation's scroll-linked Motion values",
  );
  assert.equal(
    await page.locator("[data-floating-home]").count(),
    0,
    "floating home control should stay hidden in the hero",
  );
  await page.locator("[data-designer-overlay]").waitFor();
  const before = await page
    .locator(".hero-bio p")
    .first()
    .getAttribute("style");
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    window.__lenis?.scrollTo(3000, { immediate: true });
    window.scrollTo(0, 3000);
  });
  await page.waitForTimeout(800);
  assert.equal(
    await page.locator(".hero-bio p").first().getAttribute("style"),
    before,
    "decoration mutated content styles",
  );
  assert.equal(
    await page.locator("[data-designer-overlay]").count(),
    0,
    "offscreen cursor remains active",
  );
  const floatingHome = page.locator("[data-floating-home]");
  await floatingHome.waitFor();
  assert.equal(await floatingHome.isVisible(), true);
  await floatingHome.click();
  await page.waitForFunction(() => scrollY < 4);
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator("[data-floating-home]").count(),
    0,
    "floating home control did not dismiss after returning to the hero",
  );
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await page.locator("main").count(), 1);
  for (const id of ["home", "about", "work", "photography", "contact"]) {
    if (await page.locator(`#${id}`).count())
      assert.equal(
        await page
          .locator(`#${id}`)
          .evaluate((el) => Boolean(el.closest("main"))),
        true,
        `${id} outside main`,
      );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#interlude").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  assert.equal(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === "running" &&
              animation.effect?.target?.closest?.(".star-field"),
          ).length,
    ),
    0,
    "reduced motion leaves running stars",
  );
  const transitionEvents = await page.evaluate(async () => {
    const events = [];
    const record = (event) => events.push(event.propertyName);
    document.addEventListener("transitionrun", record, true);
    try {
      const extent = document.documentElement.scrollHeight - innerHeight;
      await new Promise((resolve) => {
        const start = performance.now();
        const step = (now) => {
          const progress = Math.min(1, (now - start) / 2000);
          scrollTo(0, extent * progress);
          if (progress < 1) requestAnimationFrame(step);
          else requestAnimationFrame(() => requestAnimationFrame(resolve));
        };
        requestAnimationFrame(step);
      });
      return events;
    } finally {
      document.removeEventListener("transitionrun", record, true);
    }
  });
  assert.deepEqual(
    transitionEvents,
    [],
    "reduced motion created CSS transition work",
  );
  if (await page.locator("#photography").count()) {
    const heroScope = page.locator("[data-theme-scope]").first();
    const offscreenStyle = await heroScope.getAttribute("style");
    await page
      .locator("#photography")
      .evaluate((el) =>
        scrollTo(0, el.getBoundingClientRect().top + scrollY - 100),
      );
    await page.waitForFunction(() => {
      const scope = document
        .querySelector("#photography")
        ?.closest("[data-theme-scope]");
      return scope && getComputedStyle(scope).color === "rgb(255, 255, 255)";
    });
    assert.equal(
      await heroScope.getAttribute("style"),
      offscreenStyle,
      "offscreen content remained subscribed to the foreground animation",
    );
    assert.equal(
      await page.locator(".app").evaluate((el) => el.style.color),
      "",
      "foreground animation must not invalidate document-wide inheritance",
    );
  }
  report.push(
    "desktop: interruption cleanup, floating home return, one main landmark, live motion preference, zero reduced-motion CSS transitions",
  );
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const phone = await mobile.newPage();
  await phone.goto(base, { waitUntil: "networkidle" });
  const toggle = phone.locator('button[aria-controls="mobile-navigation"]');
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  const menu = phone.locator("#mobile-navigation");
  assert.equal(
    await menu.evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  await phone.keyboard.press("Escape");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(
    await toggle.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await phone.locator("main").evaluate((el) => el.inert), false);
  await toggle.click();
  const sectionLink = menu.locator('a[href^="#"]').first();
  const hash = await sectionLink.getAttribute("href");
  await sectionLink.click();
  await phone.waitForTimeout(250);
  assert.equal(new URL(phone.url()).hash, hash);
  await phone.reload({ waitUntil: "networkidle" });
  assert.ok(
    (await phone.evaluate(() => scrollY)) > 100,
    "deep link reset to top",
  );
  await phone.screenshot({ path: "qa/screens/lifecycle/mobile-anchor.png" });
  report.push(
    "mobile: Escape, focus restoration, inert cleanup, hash navigation and reload",
  );
  await mobile.close();

  const plain = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const documentPage = await plain.newPage();
  await documentPage.goto(base, { waitUntil: "networkidle" });
  const invisible = await documentPage
    .locator("main h1, main h2, #work .work-item")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          for (
            let current = element;
            current;
            current = current.parentElement
          ) {
            const style = getComputedStyle(current);
            if (Number(style.opacity) === 0 || style.visibility === "hidden")
              return true;
          }
          return false;
        })
        .map((element) => element.textContent.slice(0, 80)),
    );
  assert.deepEqual(
    invisible,
    [],
    "server-rendered content depends on JavaScript visibility",
  );
  report.push("no JavaScript: headings and works visible without hydration");
  assert.deepEqual(errors, []);
  await plain.close();
} finally {
  await browser.close();
  await fs.writeFile(
    "qa/interaction-lifecycle-report.json",
    JSON.stringify(report, null, 2),
  );
}
console.log(report.join("\n"));
