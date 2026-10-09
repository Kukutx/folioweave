import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";

// Runs the file:// sample itself, without building or changing an author profile.
const root = path.resolve(import.meta.dirname, "..");
const url = pathToFileURL(
  path.join(root, "docs/design/music-player-concept.html"),
).href;
const capture = process.argv.includes("--screenshots");
const browser = await chromium.launch({
  headless: true,
  executablePath: resolveChromePath(),
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [],
    requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.url().startsWith("https:")) requests.push(request.url());
  });
  await page.goto(url);
  assert.match(await page.title(), /音乐播放器样机/);
  assert.equal(
    await page
      .getByRole("heading", { name: "音乐播放器", exact: true })
      .count(),
    1,
  );
  const choose = (setting, value) =>
    page.locator(`[data-setting="${setting}"] [data-value="${value}"]`).click();
  const expanded = (value) =>
    page.waitForFunction(
      (value) =>
        document.querySelector("#music").dataset.expanded === String(value),
      value,
    );
  let layouts = 0;
  assert.equal(
    await page.locator("#music").getAttribute("data-expanded"),
    "false",
  );
  await page.locator("#record-control").click();
  await expanded(true);
  for (const width of [1440, 820, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const position of ["right", "center"])
      for (const skin of ["capsule", "square"])
        for (const finish of ["graphite", "porcelain", "cobalt"]) {
          await choose("position", position);
          await choose("skin", skin);
          await choose("finish", finish);
          const geometry = await page.evaluate(() => {
            const box = (id) => {
              const r = document.getElementById(id).getBoundingClientRect();
              return {
                x: r.x,
                right: r.right,
                bottom: r.bottom,
                height: r.height,
              };
            };
            return {
              shell: box("shell"),
              record: box("record-control"),
              metadata: box("metadata"),
              last: box("queue-toggle"),
              stage: box("stage"),
              radius: getComputedStyle(document.getElementById("shell"))
                .borderTopLeftRadius,
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          assert.equal(geometry.shell.height, 56);
          assert.ok(
            Math.abs(
              geometry.stage.bottom -
                geometry.shell.bottom -
                (width <= 760 ? 18 : 24),
            ) <= 2,
            `${position} remains anchored at the bottom of the stage`,
          );
          if (skin === "capsule") {
            assert.equal(geometry.radius, "28px");
            assert.equal(geometry.record.height, 48);
          }
          assert.ok(
            geometry.record.right <= geometry.metadata.x,
            "artwork stays left",
          );
          assert.ok(geometry.last.right < geometry.shell.right, "controls fit");
          assert.ok(
            geometry.shell.x >= geometry.stage.x &&
              geometry.shell.right <= geometry.stage.right,
          );
          assert.equal(geometry.overflow, false);
          await page.locator("#queue-toggle").click();
          assert.equal(
            await page
              .locator("#queue [aria-current='true']")
              .evaluate((el) => el === document.activeElement),
            true,
            "queue receives keyboard focus",
          );
          const panelFits = await page.evaluate(() => {
            const a = document
                .getElementById("queue-panel")
                .getBoundingClientRect(),
              b = document.getElementById("stage").getBoundingClientRect();
            return (
              a.top >= b.top &&
              a.bottom <= b.bottom &&
              a.height > 70 &&
              a.width > 200
            );
          });
          assert.ok(panelFits, `panel fits ${width}/${position}/${skin}`);
          await page.keyboard.press("Escape");
          assert.equal(
            await page
              .locator("#queue-toggle")
              .evaluate((el) => el === document.activeElement),
            true,
          );
          await page.locator("#record-control").click();
          await expanded(false);
          assert.equal(await page.locator("#transport").isVisible(), false);
          assert.equal(
            await page.locator("#transport").evaluate((el) => el.inert),
            true,
          );
          if (position === "center") {
            assert.equal(
              await page.locator("#shell").evaluate((el) => el.inert),
              true,
            );
            assert.equal(
              await page
                .locator("#reveal-control")
                .evaluate((el) => el === document.activeElement),
              true,
            );
            assert.equal(
              await page.locator("#record-control").isVisible(),
              false,
            );
          }
          await page.keyboard.press("Enter");
          await expanded(true);
          layouts++;
        }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await choose("skin", "capsule");
  await choose("position", "right");
  await choose("finish", "graphite");
  await page.locator("#volume-toggle").click();
  assert.equal(
    await page
      .locator("#volume")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.locator("audio").evaluate((el) => Math.round(el.volume * 100)),
    71,
  );
  await page.keyboard.press("Escape");

  // The optional effect has no activity until playback, and honors live OS changes.
  assert.equal(await page.locator("#notes-enabled").isChecked(), false);
  await page.locator("#notes-enabled").check();
  await page.getByRole("button", { name: "演示播放", exact: true }).click();
  assert.equal(await page.locator(".music-notes").isVisible(), false);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(
    () => document.querySelector("#music").dataset.motion === "true",
  );
  await page.waitForFunction(() =>
    document
      .querySelector(".music-note")
      .getAnimations()
      .some((a) => a.playState === "running"),
  );
  const noteCount = await page.locator(".music-note").count();
  assert.equal(noteCount, 4);
  await page.locator('[data-note-color="2"]').fill("#9865ad");
  assert.equal(
    await page
      .locator(".music-note")
      .nth(1)
      .evaluate((el) => getComputedStyle(el).color),
    "rgb(152, 101, 173)",
  );
  await page.locator("#record-control").click();
  await expanded(false);
  assert.equal(
    await page.locator(".music-notes").isVisible(),
    true,
    "notes work on the collapsed record",
  );
  await page.locator("#record-control").click();
  await expanded(true);
  await choose("position", "center");
  await page.locator("#record-control").click();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.getElementById("shell")).visibility ===
      "hidden",
  );
  const dock = await page.evaluate(() => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    const notes = document
      .querySelector(".music-notes")
      .getBoundingClientRect();
    const handle = document.getElementById("reveal-control");
    return {
      bottomGap: stage.bottom - handle.getBoundingClientRect().bottom,
      notesGap: stage.bottom - notes.bottom,
      focused: document.activeElement === handle,
      glow: getComputedStyle(document.querySelector(".edge-glow")).display,
    };
  });
  assert.ok(
    Math.abs(dock.bottomGap) <= 1,
    "double chevron stays at bottom edge",
  );
  assert.ok(Math.abs(dock.notesGap) <= 1, "center notes originate from bottom");
  assert.equal(dock.focused, true);
  assert.equal(dock.glow, "block");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".edge-glow").isVisible(), false);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator("#reveal-control").click();
  await choose("position", "right");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  assert.equal(await page.locator(".music-notes").isVisible(), false);
  assert.equal(
    await page
      .locator(".music-note")
      .first()
      .evaluate((el) => el.getAnimations().length),
    0,
  );
  await page.getByRole("button", { name: "演示播放", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(
    await page.locator("#music").getAttribute("data-motion"),
    "false",
  );
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.querySelector("#music").dataset.motion === "false",
  );
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.locator("#notes-enabled").uncheck();

  // Scrolling the mobile preview away should stop decorative work without
  // changing playback intent. Returning to it resumes only the decoration.
  await page.setViewportSize({ width: 390, height: 500 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator("#notes-enabled").check();
  await page.getByRole("button", { name: "演示播放", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#music").dataset.motion === "true",
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(
    () => document.querySelector("#music").dataset.inView === "false",
  );
  assert.equal(
    await page.locator("#music").getAttribute("data-motion"),
    "false",
  );
  assert.equal(
    await page.getByRole("button", { name: "暂停", exact: true }).count(),
    1,
  );
  await page.locator("#music").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.querySelector("#music").dataset.motion === "true",
  );
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.locator("#notes-enabled").uncheck();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  // A real decoded media element must survive skin, docking and disclosure changes.
  const wav = Buffer.alloc(44 + 8000 * 2 * 30);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  await page.locator("#audio-files").setInputFiles({
    name: "Local fixture.wav",
    mimeType: "audio/wav",
    buffer: wav,
  });
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("audio").currentTime > 0.1,
  );
  await page.evaluate(() => {
    window.testAudio = document.querySelector("audio");
    window.testSource = window.testAudio.src;
  });
  await choose("skin", "square");
  await choose("position", "center");
  await page.locator("#record-control").click();
  assert.ok(
    await page.evaluate(
      () =>
        window.testAudio === document.querySelector("audio") &&
        !window.testAudio.paused &&
        window.testAudio.src === window.testSource,
    ),
  );
  await page.locator("#reveal-control").click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  assert.equal(await page.locator("#next").isDisabled(), true);

  // Cancel a delayed play request; its later rejection must not corrupt the UI.
  await page.evaluate(() => {
    window.testOriginalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = () =>
      new Promise((resolve, reject) => {
        window.testRejectPlay = reject;
      });
  });
  await page.getByRole("button", { name: "播放", exact: true }).click();
  assert.equal(
    await page.locator("#music").getAttribute("data-buffering"),
    "true",
  );
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.evaluate(() => {
    window.testRejectPlay(
      new DOMException("Late rejection", "NotAllowedError"),
    );
    HTMLMediaElement.prototype.play = window.testOriginalPlay;
  });
  assert.equal(await page.locator("#player-message").isVisible(), false);
  assert.equal(
    await page.locator("#music").getAttribute("data-buffering"),
    "false",
  );

  // BFCache navigation must not revoke an imported audio Blob that the page still owns.
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    ),
  );
  assert.equal(
    await page.evaluate(async () => (await fetch(window.testSource)).ok),
    true,
  );
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("audio").paused);
  await page.getByRole("button", { name: "暂停", exact: true }).click();

  await page.locator(".advanced summary").click();
  await page.locator("#reset-demo").click();
  assert.deepEqual(errors, []);
  assert.equal(
    await page.evaluate(async () => {
      try {
        await fetch(window.testSource);
        return false;
      } catch {
        return true;
      }
    }),
    true,
  );
  // Only this deliberately revoked URL may fail. Earlier asset/runtime errors
  // were asserted above, and subsequent interactions must stay error-free.
  const revokedSource = await page.evaluate(() => window.testSource);
  assert.ok(
    errors.every((message) => message.includes(revokedSource)),
    JSON.stringify(errors),
  );
  errors.length = 0;
  assert.deepEqual(
    requests,
    [],
    "no external requests before entering a direct URL",
  );

  if (capture) {
    await choose("skin", "capsule");
    await choose("position", "right");
    await page.locator("h1").click();
    await page.locator("#music").screenshot({
      path: path.join(root, "docs/design/music-player-capsule.png"),
    });
    await page.locator("#stage").screenshot({
      path: path.join(root, "docs/design/music-player-right.png"),
    });
    await choose("position", "center");
    await page.locator("#stage").screenshot({
      path: path.join(root, "docs/design/music-player-bottom.png"),
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#notes-enabled").check();
    await page.getByRole("button", { name: "演示播放", exact: true }).click();
    await page.locator("#record-control").hover();
    await page.waitForTimeout(900);
    const box = await page.locator("#music").boundingBox();
    await page.screenshot({
      path: path.join(root, "docs/design/music-player-motion.png"),
      clip: {
        x: box.x - 8,
        y: box.y - 94,
        width: box.width + 16,
        height: box.height + 106,
      },
    });
  }
  assert.equal(await page.locator(".music-note").count(), noteCount);
  assert.deepEqual(errors, []);
  console.log(
    `PASS: ${layouts} responsive layouts; focus/escape; optional note colors and motion lifecycle; real audio continuity; cancel pending playback; BFCache Blob retention and replacement cleanup; no unexpected console errors.`,
  );
} finally {
  await browser.close();
}
