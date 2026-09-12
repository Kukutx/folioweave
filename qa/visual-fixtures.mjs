import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";
import { publishedPortfolio } from "../src/portfolio/content-policy.mjs";
import { installServiceFixtures } from "./service-fixtures.mjs";

const root = process.cwd();
const minimalHome = process.argv.includes("--minimal-home");
// Webpack's Next entry resolver needs the app and dependencies on the same
// Windows drive. Use a sibling sandbox, not a potentially cross-drive TEMP.
const temporary = await fs.mkdtemp(path.join(path.dirname(root), ".folioweave-visual-"));
const screens = path.join(root, "qa/screens/fixtures");
await fs.mkdir(screens, { recursive: true });
// A disposable copy keeps fixtures, personal test data, and development routes
// out of the real app, its build output, and its Git index.
for (const entry of ["src", "public", "tsconfig.json", "package.json", "next.config.ts"]) {
  await fs.cp(path.join(root, entry), path.join(temporary, entry), { recursive: true });
}
await fs.symlink(path.join(root, "node_modules"), path.join(temporary, "node_modules"), process.platform === "win32" ? "junction" : "dir");
if (!minimalHome) await fs.copyFile(path.join(root, "qa/fixtures/visual-page.tsx"), path.join(temporary, "src/app/page.tsx"));
if (!minimalHome) await fs.copyFile(path.join(root, "qa/fixtures/carousel-states.tsx"), path.join(temporary, "src/app/carousel-states.tsx"));
const config = JSON.parse(await fs.readFile("portfolio.json", "utf8"));
if (minimalHome) {
  for (const name of Object.keys(config.features)) config.features[name] = false;
  config.hero.greetings = config.hero.greetings.slice(0, 1);
  config.hero.portraits = config.hero.portraits.slice(0, 1);
} else {
  config.about.galleryImages = Array.from({ length: 6 }, (_, i) => ({ src: config.hero.portraits[0], alt: `Fixture portrait ${i + 1}` }));
}
const profilePath = path.join(temporary, "qa-profile.json");
await fs.writeFile(profilePath, JSON.stringify(config));
await fs.writeFile(path.join(temporary, "src/portfolio/config.generated.ts"), `import type { PortfolioConfig } from './schema.generated';\nexport default ${JSON.stringify(minimalHome ? publishedPortfolio(config) : config)} satisfies PortfolioConfig;\n`);
const port = await new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.on("error", reject);
  socket.listen(0, "127.0.0.1", () => { const port = socket.address().port; socket.close(() => resolve(port)); });
});
const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", String(port)], {
  cwd: temporary, env: { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (chunk) => { output = (output + chunk).slice(-12000); });
server.stderr.on("data", (chunk) => { output = (output + chunk).slice(-12000); });
let browser;
const report = [];
try {
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    let response;
    try { response = await fetch(base, { signal: AbortSignal.timeout(60000) }); } catch { /* server starting */ }
    if (response?.ok) { ready = true; break; }
    if (response && response.status >= 500) throw new Error(`Fixture compilation failed:\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, output);
  if (minimalHome) {
    for (const script of ["functionality.mjs", "quality.mjs", "resume-state.mjs"]) {
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(root, "qa", script)], {
          cwd: root,
          env: { ...process.env, BASE_URL: base, QA_PROFILE_PATH: profilePath },
          stdio: "inherit",
        });
        child.once("error", reject);
        child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Minimal profile: ${script} failed (${code})`)));
      });
    }
    report.push({ profile: "minimal-home", optionalFeatures: "all disabled", greetings: 1, portraits: 1 });
  } else {
  // agent-browser cannot launch Chrome on this host; use the project's working
  // Playwright launcher for the same load, overlay, console and screenshot checks.
  browser = await chromium.launch({ executablePath: resolveChromePath(), headless: true, args: ["--disable-gpu", "--no-sandbox"] });
  for (const width of [390, 820, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await installServiceFixtures(context, config, base);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(base, { waitUntil: "networkidle" });
    assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0, "development error overlay");
    const carousel = page.locator("#fixture-carousel");
    await carousel.scrollIntoViewIfNeeded();
    await carousel.locator("img").evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(screens, `${width}-carousel-portrait.png`) });
    await carousel.getByRole("button", { name: "Next image", exact: true }).click();
    await page.waitForTimeout(500);
    assert.equal(await carousel.locator("img").getAttribute("alt"), "Landscape test artwork");
    await carousel.locator("img").evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(screens, `${width}-carousel-landscape.png`) });
    if (width === 1440) {
      await carousel.getByRole("button", { name: "Clear carousel", exact: true }).click();
      assert.equal(await carousel.locator("img").count(), 0);
      await carousel.getByRole("button", { name: "Load carousel", exact: true }).click();
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.activeElement?.blur());
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForFunction(() => [...document.querySelectorAll("#fixture-carousel img")].some((img) => img.alt === "Landscape test artwork"));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(500);
      const paused = await carousel.locator("img").getAttribute("alt");
      await page.waitForTimeout(3500);
      assert.equal(await carousel.locator("img").getAttribute("alt"), paused, "live reduced motion must stop carousel autoplay");
    }
    assert.equal(await page.locator("#fixture-single").getByRole("button", { name: "Next image", exact: true }).count(), 0);
    assert.equal(await page.locator("#fixture-empty img").count(), 0);
    assert.equal(await page.locator(".story-photo-wrapper").count(), 6);
    if (width === 1440) {
      const photo = page.locator(".story-photo-wrapper").first();
      await photo.scrollIntoViewIfNeeded();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await photo.hover({ position: { x: 60, y: 80 } });
      await page.waitForFunction(() => document.querySelector(".story-photo-wrapper img")?.style.transform === "scale(1.1)");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => {
        const root = document.querySelector(".story-photo-wrapper");
        const tilt = root?.firstElementChild?.firstElementChild;
        const tiltTransform = tilt?.style.transform;
        return (
          root?.querySelector("img")?.style.transform === "none" &&
          (tiltTransform === "none" ||
            tiltTransform === "rotateX(0deg) rotateY(0deg)")
        );
      });
      await page.mouse.move(0, 0);
    }
    const cover = page.locator(".blog-post-hero-image");
    await cover.scrollIntoViewIfNeeded();
    await cover.evaluate((img) => img.decode());
    const ratioError = await cover.evaluate((img) => Math.abs(img.clientWidth / img.clientHeight - img.naturalWidth / img.naturalHeight));
    assert.ok(ratioError < 0.01, "portrait blog cover stretched");
    await page.screenshot({ path: path.join(screens, `${width}-blog-cover.png`) });
    const markdownImage = page.locator(".markdown-blog-image");
    await markdownImage.scrollIntoViewIfNeeded();
    await markdownImage.evaluate((img) => img.decode());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, "fixture page horizontal overflow");
    assert.deepEqual(errors, []);
    report.push({ width, ratioError, overflow, errors, aboutPhotos: 6, carousel: "empty / single / multiple passed" });
    console.log(`PASS reusable visual fixtures at ${width}px`);
    await context.close();
  }
  }
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await browser?.close();
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
  await fs.writeFile(path.join(root, minimalHome ? "qa/profile-matrix-report.json" : "qa/visual-fixtures-report.json"), JSON.stringify({ report, temporary }, null, 2));
  // Keep the disposable directory for failure diagnosis; never recursively
  // remove a tree containing a junction to the user's dependencies.
  console.log(`Fixture sandbox retained for inspection: ${temporary}`);
}
