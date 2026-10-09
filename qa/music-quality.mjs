import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { chromium, firefox, webkit } from "playwright-core";

const musicSelector = '[data-plugin="music"]';
const button = (page, name) =>
  page.locator(musicSelector).getByRole("button", { name, exact: true });
async function prepare(context, base, cover) {
  await context.route("https://covers.example/**", (route) =>
    route.fulfill({ contentType: "image/webp", body: cover }),
  );
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  return page;
}

export async function measureMusicDelivery(browser, base, cover) {
  const context = await browser.newContext();
  try {
    const resources = new Map();
    const responses = [];
    context.on("response", (response) => {
      const url = response.url();
      if (/\/_next\/static\/.*\.(?:js|css)(?:\?|$)/.test(url))
        responses.push(
          response.body().then((body) => resources.set(url, body)),
        );
    });
    const page = await prepare(context, base, cover);
    await Promise.all(responses);
    const totals = { jsBytes: 0, jsGzipBytes: 0, cssBytes: 0, cssGzipBytes: 0 };
    for (const [url, body] of resources) {
      const type = /\.css(?:\?|$)/.test(url) ? "css" : "js";
      totals[`${type}Bytes`] += body.length;
      totals[`${type}GzipBytes`] += gzipSync(body).length;
    }
    totals.audioRequests = await page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .filter((entry) => /\.wav(?:\?|$)/.test(entry.name)).length,
    );
    assert.equal(totals.audioRequests, 0);
    return totals;
  } finally {
    await context.close();
  }
}

export async function checkMusicEngines(base, cover, fixtureFile) {
  // Only the generated file inside this QA-owned sandbox may be made unavailable.
  const relative = path
    .relative(path.resolve(import.meta.dirname, "../.generated"), fixtureFile)
    .replaceAll("\\", "/");
  assert.match(
    relative,
    /^extension-qa-[^/]+\/public\/portfolio\/audio\/fixture\.wav$/,
  );
  const results = [];
  for (const engine of [chromium, firefox, webkit]) {
    console.log(
      `Music quality: ${engine.name()} playback, recovery, motion and coexistence…`,
    );
    const browser = await engine.launch({ headless: true });
    let unavailable = false;
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const errors = [];
      context.on("page", (page) =>
        page.on("pageerror", (error) => errors.push(error.message)),
      );
      let requests = 0;
      // Windows WebKit media can bypass Playwright routing. A real missing
      // server-side file exercises failure/retry in every engine.
      await fs.rename(fixtureFile, fixtureFile + ".unavailable");
      unavailable = true;
      await context.route("**/portfolio/audio/fixture.wav", async (route) => {
        requests++;
        await new Promise((resolve) => setTimeout(resolve, 350));
        await route.continue();
      });
      const page = await prepare(context, base, cover);
      assert.equal(requests, 0, "no preload before intent");
      await button(page, "播放").click();
      await page.locator(musicSelector).getByRole("status").waitFor();
      await fs.rename(fixtureFile + ".unavailable", fixtureFile);
      unavailable = false;
      // Record what the element reports, so a failure names the engine's
      // behaviour instead of only timing out.
      await page.evaluate(() => {
        const audio = document.querySelector("audio");
        window.musicEvents = [];
        for (const name of [
          "loadstart",
          "emptied",
          "abort",
          "error",
          "stalled",
          "suspend",
          "waiting",
          "canplay",
          "play",
          "playing",
          "pause",
          "ended",
        ])
          audio.addEventListener(name, () =>
            window.musicEvents.push(
              `${name}@${audio.currentTime.toFixed(2)}${audio.error ? `!${audio.error.code}` : ""}`,
            ),
          );
      });
      await button(page, "播放").click();
      // One condition, not a wait followed by a read: a brief stall between
      // the two would report a player that is in fact playing.
      await page
        .waitForFunction(
          (selector) =>
            document.querySelector("audio").currentTime > 0.1 &&
            document.querySelector(selector).getAttribute("data-playing") ===
              "true",
          musicSelector,
        )
        .catch(async (error) => {
          const state = await page.evaluate((selector) => {
            const audio = document.querySelector("audio");
            const player = document.querySelector(selector);
            return {
              events: window.musicEvents,
              currentTime: audio.currentTime,
              paused: audio.paused,
              ended: audio.ended,
              readyState: audio.readyState,
              networkState: audio.networkState,
              error: audio.error && {
                code: audio.error.code,
                message: audio.error.message,
              },
              playing: player.getAttribute("data-playing"),
              status: player.querySelector('[role="status"]')?.textContent,
            };
          }, musicSelector);
          throw new Error(
            `${engine.name()} did not reach a playing state: ${JSON.stringify(state)}`,
            { cause: error },
          );
        });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(
        () =>
          document.querySelector('[data-plugin="music"]').dataset.motion ===
          "false",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForFunction(
        () =>
          document.querySelector('[data-plugin="music"]').dataset.motion ===
          "true",
      );
      await button(page, "播放列表").click();
      await page.keyboard.press("Escape");
      assert.ok(
        await button(page, "播放列表").evaluate(
          (el) => el === document.activeElement,
        ),
      );
      await page.getByRole("button", { name: "Load floating QA" }).click();
      await page.waitForFunction(() => Boolean(window.musicQA));
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
        { width: 480, height: 240 },
      ]) {
        await page.setViewportSize(viewport);
        await page.evaluate(() => window.musicQA.mount());
        await page.waitForFunction(() =>
          [...document.querySelectorAll("[data-qa-float]")].every(
            (el) => el.dataset.floatingCrowded === "false",
          ),
        );
        const boxes = await page
          .locator(`${musicSelector}, [data-qa-float]`)
          .evaluateAll((nodes) =>
            nodes.map((el) => {
              const { x, y, width, height } = el.getBoundingClientRect();
              return { x, y, width, height };
            }),
          );
        for (const [i, a] of boxes.entries())
          for (const b of boxes.slice(i + 1))
            assert.ok(
              a.x + a.width <= b.x ||
                b.x + b.width <= a.x ||
                a.y + a.height <= b.y ||
                b.y + b.height <= a.y,
              `${engine.name()} floating controls overlap`,
            );
        await button(page, "播放列表").click();
        await page.evaluate(() => window.musicQA.claim());
        await page.waitForFunction(
          () => !document.querySelector('[data-plugin="music"]').dataset.panel,
        );
        assert.equal(
          await page.locator('[data-qa-float="0"]').getAttribute("data-open"),
          "true",
        );
        await button(page, "播放列表").click();
        await page.waitForFunction(
          () =>
            document.querySelector('[data-qa-float="0"]').dataset.open ===
            "false",
        );
        const popup = await page
          .locator(musicSelector)
          .getByRole("region")
          .boundingBox();
        assert.ok(
          popup.y >= 0 && popup.y + popup.height <= viewport.height + 1,
        );
        await page.keyboard.press("Escape");
        await button(page, "收起播放器").click();
        await button(page, "展开播放器").click();
        await page.evaluate(() => window.musicQA.remove());
        assert.equal(await page.locator("[data-qa-float]").count(), 0);
      }
      assert.deepEqual(errors, []);
      results.push({
        engine: engine.name(),
        version: browser.version(),
        passed: true,
        viewports: 3,
        cases: [
          "no-preload",
          "unavailable-file-retry",
          ...(requests > 0 ? ["delayed-media"] : []),
          "decoded-playback",
          "reduced-motion",
          "keyboard-focus",
          "floating-collision",
          "panel-exclusion",
          "cleanup",
        ],
      });
      await context.close();
    } finally {
      if (unavailable)
        await fs.rename(fixtureFile + ".unavailable", fixtureFile);
      await browser.close();
    }
  }
  return results;
}

export async function measureMusicRuntime(browser, base, cover) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await prepare(context, base, cover);
    const session = await context.newCDPSession(page);
    await session.send("Performance.enable");
    const metrics = async () =>
      Object.fromEntries(
        (await session.send("Performance.getMetrics")).metrics.map(
          ({ name, value }) => [name, value],
        ),
      );
    await button(page, "播放").click();
    await page.waitForFunction(
      () => document.querySelector("audio").currentTime > 0.1,
    );
    const results = [];
    for (const mode of ["notes-off", "notes-on", "paused"]) {
      await button(page, "播放列表").click();
      await page
        .getByRole("switch", { name: "彩色音符" })
        .setChecked(mode !== "notes-off");
      await page.keyboard.press("Escape");
      if (mode === "paused") await button(page, "暂停").click();
      await page.waitForTimeout(450);
      const samples = [];
      for (let i = 0; i < 3; i++) {
        const before = await metrics();
        await page.waitForTimeout(1200);
        const after = await metrics();
        samples.push({
          scriptMs: +(
            1000 *
            (after.ScriptDuration - before.ScriptDuration)
          ).toFixed(3),
          taskMs: +(1000 * (after.TaskDuration - before.TaskDuration)).toFixed(
            3,
          ),
          layoutMs: +(
            1000 *
            (after.LayoutDuration - before.LayoutDuration)
          ).toFixed(3),
        });
      }
      const dom = await page.locator(musicSelector).evaluate((el) => ({
        elements: el.querySelectorAll("*").length,
        runningAnimations: el
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
      }));
      if (mode === "paused") assert.equal(dom.runningAnimations, 0);
      assert.ok(dom.elements < 100, "closed playlist has bounded DOM");
      results.push({ mode, sampleMs: 1200, samples, ...dom });
    }
    assert.equal(
      results[1].elements - results[0].elements,
      9,
      "notes add one wrapper, four SVGs and four paths",
    );
    return results;
  } finally {
    await context.close();
  }
}
