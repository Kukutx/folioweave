import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";
import { checkBlogTools } from "./blog-tools.mjs";
import { checkPhotographyReveal } from "./photography-reveal.mjs";
import {
  measureMusicDelivery,
  measureMusicRuntime,
  checkMusicEngines,
} from "./music-quality.mjs";

const root = path.resolve(import.meta.dirname, "..");
await fs.mkdir(path.join(root, ".generated"), { recursive: true });
const sandbox = await fs.mkdtemp(path.join(root, ".generated/extension-qa-"));
let server;
let browser;
const report = [];
const musicQuality = process.argv.includes("--music-quality");
const musicReport = {
  measuredAt: new Date().toISOString(),
  platform: process.platform,
  physicalDevices:
    "Not tested; browser engine automation is not physical-device certification.",
};
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
// This disposable directory has no Git/deployment identity. Parent CI branch
// variables describe the real checkout, not this independently built snapshot.
for (const name of [
  "BOUNDARY_TARGET",
  "BOUNDARY_SHARED_BASE",
  "GITHUB_BASE_REF",
  "GITHUB_REF_NAME",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL",
])
  delete env[name];
// Each fixture owns its process tree, output, profile and generated modules.
function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: sandbox,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output = (output + chunk).slice(-20000);
    });
    child.stderr.on("data", (chunk) => {
      output = (output + chunk).slice(-20000);
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve(output) : reject(new Error(output)),
    );
  });
}
function stop() {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32")
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  else server.kill("SIGTERM");
}
async function start() {
  const port = await new Promise((resolve) => {
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "-p",
      String(port),
    ],
    { cwd: sandbox, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  server.stdout.on("data", (chunk) => {
    output = (output + chunk).slice(-8000);
  });
  server.stderr.on("data", (chunk) => {
    output = (output + chunk).slice(-8000);
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 45; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    const response = await fetch(base).catch(() => null);
    if (response?.ok) return base;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Fixture server failed to start: ${output}`);
}
async function build() {
  await run(path.join(sandbox, "scripts/content-build.mjs"));
  const output = await run(path.join(root, "node_modules/next/dist/bin/next"), [
    "build",
    "--webpack",
  ]);
  console.log(output.slice(-1500));
}

try {
  for (const entry of [
    "src",
    "scripts",
    "governance",
    "public",
    "content",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "portfolio.json",
    "portfolio.schema.json",
    "resume.schema.json",
  ])
    await fs.cp(path.join(root, entry), path.join(sandbox, entry), {
      recursive: true,
    });
  await fs.symlink(
    path.join(root, "node_modules"),
    path.join(sandbox, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const profilePath = path.join(sandbox, "portfolio.json");
  const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
  profile.features.demoRoutes = false;
  profile.site.identity.locale = "zh-Hant-HK";
  profile.features.work = false;
  profile.projects = [];
  await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));
  const post = (title, id) =>
    `---\nid: ${id}\ntitle: ${title}\ndate: 2026-10-08\ncover: ${profile.hero.portraits[0]}\ndescription: Plugin integration fixture\n---\n\n## Body\n\nReadable article content.\n\n## Body\n\n| Feature | Status |\n| --- | --- |\n| Shared content | Ready |\n\n[External](https://example.com)`;
  await fs.writeFile(
    path.join(sandbox, "content/blogs/first.md"),
    post("First article", "stable-first"),
  );
  await fs.writeFile(
    path.join(sandbox, "content/blogs/second.md"),
    post("Second article", "stable-second"),
  );
  const samples = 44100 * 30;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24);
  wav.writeUInt32LE(88200, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  await fs.mkdir(path.join(sandbox, "content/assets/portfolio/audio"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(sandbox, "content/assets/portfolio/audio/fixture.wav"),
    wav,
  );
  await fs.writeFile(
    path.join(sandbox, "music.json"),
    JSON.stringify({
      notes: { enabled: true },
      initialExpanded: true,
      tracks: [
        {
          id: "fixture",
          title: "Fixture track",
          src: "/portfolio/audio/fixture.wav",
          cover: "https://covers.example/fixture.webp",
        },
        {
          id: "remote",
          title: "Remote fixture track",
          src: "https://audio.example/music.wav",
          cover: "https://covers.example/fixture.webp",
        },
      ],
    }),
  );
  await fs.writeFile(
    path.join(sandbox, "comments.json"),
    JSON.stringify({
      provider: "giscus",
      repo: "example/discussions",
      repoId: "R_example",
      category: "General",
      categoryId: "DIC_example",
    }),
  );
  const cli = path.join(sandbox, "scripts/folio.mjs");
  if (musicQuality) {
    const directory = path.join(sandbox, "src/plugins/fixture-floating");
    await fs.mkdir(directory);
    await fs.writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        id: "fixture-floating",
        name: "Floating QA",
        version: "1.0.0",
        apiVersion: 1,
        entry: "fixture.tsx",
        slots: ["site.floating"],
        optionsSchema: { type: "object", additionalProperties: false },
      }),
    );
    await fs.writeFile(
      path.join(directory, "fixture.tsx"),
      '"use client";\nimport type { PluginProps } from "@/core/contracts";\nexport default function Fixture(_props: PluginProps<Record<string, never>>) { return <button type="button" onClick={() => { void import("./bridge").then(module => module.install()); }}>Load floating QA</button>; }',
    );
    await fs.copyFile(
      path.join(root, "qa/fixtures/floating-bridge.ts"),
      path.join(directory, "bridge.ts"),
    );
    await run(cli, ["plugin", "enable", "fixture-floating"]);
  }
  await run(cli, ["template", "create", "integration-fixture"]);
  const templateDirectory = path.join(
    sandbox,
    "src/templates/integration-fixture",
  );
  await fs.copyFile(
    path.join(root, "qa/fixtures/shared-media.tsx"),
    path.join(templateDirectory, "shared-media.tsx"),
  );
  const homePath = path.join(templateDirectory, "home.tsx");
  const sharedImages = Array.from({ length: 2 }, (_, index) => ({
    src: profile.hero.portraits[0],
    alt: `Shared image ${index + 1}`,
  }));
  await fs.writeFile(
    homePath,
    'import { SharedMediaFixture } from "./shared-media";\n' +
      (await fs.readFile(homePath, "utf8")).replace(
        "</main>",
        `<SharedMediaFixture images={${JSON.stringify(sharedImages)}} /></main>`,
      ),
  );
  const failureDirectory = path.join(sandbox, "src/plugins/fixture-failure");
  await fs.mkdir(failureDirectory);
  await fs.writeFile(
    path.join(failureDirectory, "manifest.json"),
    JSON.stringify({
      id: "fixture-failure",
      name: "Fixture",
      version: "1.0.0",
      apiVersion: 1,
      entry: "fixture.tsx",
      slots: ["article.after"],
      optionsSchema: { type: "object", additionalProperties: false },
    }),
  );
  await fs.writeFile(
    path.join(failureDirectory, "fixture.tsx"),
    '"use client";\nimport { useState } from "react";\nimport type { PluginProps } from "@/core/contracts";\nexport default function Fixture(_props: PluginProps<Record<string, never>>) { const [failed, setFailed] = useState(false); if (failed) throw new Error("Fixture plugin failure"); return <button type="button" onClick={() => setFailed(true)}>Trigger plugin failure</button>; }',
  );
  await run(cli, ["template", "use", "integration-fixture"]);
  await run(cli, ["plugin", "enable", "fixture-failure"]);
  await run(cli, ["plugin", "enable", "music", "--options", "music.json"]);
  await run(cli, [
    "plugin",
    "enable",
    "comments",
    "--options",
    "comments.json",
  ]);
  console.log("Building the independent template with both plugins enabled…");
  await build();
  let base = await start();
  browser = await chromium.launch({
    executablePath: resolveChromePath(),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  let giscusLoads = 0;
  let remoteAudioRequests = 0;
  await context.route("https://audio.example/**", async (route) => {
    remoteAudioRequests++;
    if (remoteAudioRequests === 1) {
      await route.fulfill({ status: 404, body: "Missing fixture" });
      return;
    }
    await route.fulfill({ contentType: "audio/wav", body: wav });
  });
  const musicCover = await fs.readFile(
    path.join(
      root,
      "public/media/5c0589_fdc7d062ceaa435582bfe4e4d4a48d06~mv2.webp",
    ),
  );
  await context.route("https://covers.example/**", (route) =>
    route.fulfill({ contentType: "image/webp", body: musicCover }),
  );
  await context.route("https://giscus.app/**", async (route) => {
    assert.match(new URL(route.request().url()).pathname, /\/widget$/);
    giscusLoads++;
    const message =
      giscusLoads === 1
        ? { error: "Service temporarily unavailable" }
        : giscusLoads === 2
          ? { error: "Discussion not found" }
          : { resizeHeight: 100 };
    await route.fulfill({
      contentType: "text/html",
      body: `<html><body>Fixture discussion<script>parent.postMessage({giscus:${JSON.stringify(message)}}, '*')</script></body></html>`,
    });
  });
  await context.addInitScript(() => {
    if (window !== window.top) return;
    window.__qaMessageListeners = new Set();
    const add = window.addEventListener;
    const remove = window.removeEventListener;
    window.addEventListener = function (name, listener, ...args) {
      if (name === "message") window.__qaMessageListeners.add(listener);
      return add.call(this, name, listener, ...args);
    };
    window.removeEventListener = function (name, listener, ...args) {
      if (name === "message") window.__qaMessageListeners.delete(listener);
      return remove.call(this, name, listener, ...args);
    };
  });
  const page = await context.newPage();
  const loadedScripts = [];
  page.on("response", (response) => {
    if (
      response.url().includes("/_next/static/") &&
      response.url().endsWith(".js")
    )
      loadedScripts.push(response.text());
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let audioRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("fixture.wav")) audioRequests++;
  });
  const response = await page.goto(base, { waitUntil: "networkidle" });
  assert.match(
    response.headers()["content-security-policy"],
    /frame-src 'self' https:\/\/giscus.app/,
  );
  assert.equal(
    await page.locator("html").getAttribute("data-template"),
    "integration-fixture",
  );
  assert.equal(await page.locator(".app, .nav, .hero-section").count(), 0);
  const carousel = page.locator("[data-shared-media] .media-carousel");
  assert.equal(
    await carousel
      .locator(".media-carousel-container")
      .evaluate((element) => getComputedStyle(element).position),
    "relative",
  );
  await carousel
    .getByRole("button", { name: "Next image", exact: true })
    .click();
  await carousel.locator('img[alt="Shared image 2"]').waitFor();
  await page
    .getByRole("button", { name: "Open shared gallery", exact: true })
    .click();
  const sharedDialog = page.getByRole("dialog", { name: "Photography viewer" });
  await sharedDialog.waitFor();
  assert.equal(
    await sharedDialog.evaluate((element) => getComputedStyle(element).display),
    "flex",
  );
  assert.equal(
    await sharedDialog.evaluate(
      (element) => getComputedStyle(element, "::before").backdropFilter,
    ),
    "blur(10px)",
  );
  await sharedDialog.getByText("2 / 2", { exact: true }).waitFor();
  // Simulate source data updates while the native modal makes the page inert.
  await page
    .getByRole("button", { name: "Keep one shared image" })
    .evaluate((button) => button.click());
  await sharedDialog.getByText("1 / 1", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Clear shared images" })
    .evaluate((button) => button.click());
  await sharedDialog.waitFor({ state: "detached" });
  assert.equal(await carousel.count(), 0);
  await page.getByRole("button", { name: "Restore shared images" }).click();
  await sharedDialog.getByText("2 / 2", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await sharedDialog.waitFor({ state: "detached" });
  assert.equal(await page.locator('[data-plugin="music"]').count(), 1);
  assert.ok(
    !(await Promise.all(loadedScripts)).some(
      (text) =>
        text.includes("giscus-widget") ||
        text.includes("Comments could not load"),
    ),
    "article plugin code must not load on the homepage",
  );
  assert.equal(
    audioRequests,
    0,
    "audio must not preload before a user requests playback",
  );
  const musicPlayer = page.locator('[data-plugin="music"]');
  assert.match(
    response.headers()["content-security-policy"],
    /media-src[^;]*https:\/\/audio\.example/,
  );
  assert.match(
    response.headers()["content-security-policy"],
    /img-src[^;]*https:\/\/covers\.example/,
  );
  assert.equal(remoteAudioRequests, 0);
  await musicPlayer
    .locator("img")
    .first()
    .evaluate((img) => img.decode());
  assert.equal(
    await musicPlayer
      .locator("img")
      .first()
      .evaluate((img) => img.naturalWidth > 0),
    true,
  );
  // The tracked design image changes only when asked for; a normal run keeps
  // its evidence with the other ignored QA screenshots.
  const runtimeShot = process.argv.includes("--screenshots")
    ? path.join(root, "docs/design/music-player-runtime.png")
    : path.join(root, "qa/screens/music-player-runtime.png");
  await fs.mkdir(path.dirname(runtimeShot), { recursive: true });
  await musicPlayer.screenshot({ path: runtimeShot });
  await page.setViewportSize({ width: 480, height: 240 });
  await musicPlayer
    .getByRole("button", { name: "播放列表", exact: true })
    .click();
  assert.ok(
    await musicPlayer
      .getByRole("region", { name: "播放列表", exact: true })
      .evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight;
      }),
    "landscape playlist stays inside the viewport",
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await musicPlayer.getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("audio")?.currentTime > 0.1,
  );
  await page.locator("audio").evaluate((audio) => {
    audio.dataset.instance = "persistent";
  });
  await musicPlayer
    .getByRole("button", { name: "收起播放器", exact: true })
    .click();
  assert.equal(await musicPlayer.getAttribute("data-expanded"), "false");
  assert.equal(
    await page.locator("audio").evaluate((audio) => audio.paused),
    false,
  );
  const progressControl = musicPlayer.locator('input[aria-label="播放进度"]');
  const hiddenProgress = await progressControl.inputValue();
  await page.waitForFunction(
    (elapsed) => document.querySelector("audio").currentTime > elapsed + 0.6,
    Number(hiddenProgress),
  );
  assert.equal(
    await progressControl.inputValue(),
    hiddenProgress,
    "hidden progress stops rendering while audio continues",
  );
  await musicPlayer
    .getByRole("button", { name: "展开播放器", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('input[aria-label="播放进度"]').value) >=
      document.querySelector("audio").currentTime - 0.5,
  );
  await musicPlayer
    .getByRole("button", { name: "播放列表", exact: true })
    .click();
  const notesSwitch = musicPlayer.getByRole("switch", {
    name: "彩色音符",
    exact: true,
  });
  assert.equal(await notesSwitch.isChecked(), true);
  await notesSwitch.uncheck();
  assert.equal(await musicPlayer.getAttribute("data-notes"), "false");
  await page.keyboard.press("Escape");
  assert.equal(
    await musicPlayer
      .getByRole("button", { name: "播放列表", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await musicPlayer
    .getByRole("button", { name: "播放列表", exact: true })
    .click();
  await musicPlayer
    .getByRole("button", { name: /Remote fixture track/ })
    .click();
  await musicPlayer.getByRole("status").waitFor();
  await musicPlayer.getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("audio")?.src ===
        "https://audio.example/music.wav" &&
      document.querySelector('[data-plugin="music"]').dataset.playing ===
        "true",
  );
  assert.ok(remoteAudioRequests >= 2);
  await page.getByRole("link", { name: "Writing", exact: true }).click();
  await page.getByRole("link", { name: "First article", exact: true }).click();
  await page.waitForURL(base + "/blogs/first");
  await page.locator("article table").waitFor();
  assert.equal(await page.locator("article table tbody tr").count(), 1);
  assert.equal(await page.locator("h2#body").count(), 1);
  assert.equal(await page.locator("h2#body-2").count(), 1);
  assert.match(
    await page
      .getByRole("link", { name: "External", exact: true })
      .getAttribute("rel"),
    /noopener/,
  );
  assert.equal(
    await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll(
        (nodes) =>
          nodes
            .map((node) => JSON.parse(node.textContent))
            .filter((value) => value["@type"] === "BlogPosting").length,
      ),
    1,
  );
  assert.equal(
    await page.locator("audio").getAttribute("data-instance"),
    "persistent",
  );
  assert.equal(
    await page.locator("audio").evaluate((audio) => audio.paused),
    false,
  );
  assert.equal(giscusLoads, 0, "comments must wait for reader interaction");
  await page
    .getByRole("button", { name: "Trigger plugin failure", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retry Fixture", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Trigger plugin failure", exact: true })
    .waitFor();
  const originalListeners = await page.evaluate(
    () => window.__qaMessageListeners.size,
  );
  await page
    .getByRole("button", { name: "Load comments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retry comments", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Retry comments", exact: true })
    .click();
  await page.locator('iframe[title="Comments"]').waitFor();
  await page.getByRole("status").waitFor({ state: "detached" });
  assert.equal(
    new URL(
      await page.locator('iframe[title="Comments"]').getAttribute("src"),
    ).searchParams.get("term"),
    "stable-first",
  );
  assert.equal(
    new URL(await page.locator('iframe[title="Comments"]').getAttribute("src"))
      .pathname,
    "/zh-TW/widget",
  );
  assert.equal(
    await page.getByRole("button", { name: "Retry comments" }).count(),
    0,
    "a new discussion is ready for its first comment",
  );
  assert.equal(
    await page.locator("#giscus-css").count(),
    0,
    "widget styles stay local",
  );
  assert.equal(
    await page.evaluate(() => window.__qaMessageListeners.size),
    originalListeners + 2,
    "retry releases both old message listeners",
  );
  await page.getByRole("link", { name: "Writing", exact: true }).click();
  await page.getByRole("link", { name: "Second article", exact: true }).click();
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(
    await page.evaluate(() => window.__qaMessageListeners.size),
    originalListeners,
    "navigation releases plugin and provider listeners",
  );
  await page
    .getByRole("button", { name: "Load comments", exact: true })
    .click();
  await page.locator('iframe[title="Comments"]').waitFor();
  assert.equal(
    new URL(
      await page.locator('iframe[title="Comments"]').getAttribute("src"),
    ).searchParams.get("term"),
    "stable-second",
  );
  assert.equal(
    await page.locator("audio").getAttribute("data-instance"),
    "persistent",
  );
  assert.deepEqual(errors, []);
  report.push(
    "Shared media works without Classic CSS and handles empty/shrinking data; client plugin failures can be retried; comments inherit the site locale.",
    "Independent template renders; audio persists through client navigation; comments retry, use stable ids and reset between articles.",
  );
  await context.close();
  if (musicQuality) {
    musicReport.enabled = await measureMusicDelivery(browser, base, musicCover);
    musicReport.runtime = await measureMusicRuntime(browser, base, musicCover);
    musicReport.engines = await checkMusicEngines(
      base,
      musicCover,
      path.join(sandbox, "public/portfolio/audio/fixture.wav"),
    );
    stop();
    await run(cli, ["plugin", "disable", "music"]);
    console.log(
      "Measuring the same independent template with only music disabled…",
    );
    await build();
    base = await start();
    musicReport.disabled = await measureMusicDelivery(
      browser,
      base,
      musicCover,
    );
    musicReport.incremental = Object.fromEntries(
      Object.keys(musicReport.enabled).map((key) => [
        key,
        musicReport.enabled[key] - musicReport.disabled[key],
      ]),
    );
    musicReport.method =
      "Same template, profile and QA bridge; only music toggled. Unique loaded JS/CSS decoded bodies; gzip sizes estimated locally. CDP timing is diagnostic, three 1200ms samples per state.";
    musicReport.budgets = { jsGzipBytes: 24000, cssGzipBytes: 8000 };
    await fs.writeFile(
      path.join(root, "qa/music-quality-report.json"),
      JSON.stringify(musicReport, null, 2) + "\n",
    );
    assert.ok(
      musicReport.incremental.jsGzipBytes <= musicReport.budgets.jsGzipBytes,
      "music incremental JS budget",
    );
    assert.ok(
      musicReport.incremental.cssGzipBytes <= musicReport.budgets.cssGzipBytes,
      "music incremental CSS budget",
    );
    await run(cli, ["plugin", "disable", "fixture-floating"]);
  }
  stop();
  const before = JSON.parse(await fs.readFile(profilePath, "utf8"));
  await run(cli, ["plugin", "disable", "music"]);
  await run(cli, ["plugin", "disable", "comments"]);
  await run(cli, ["plugin", "disable", "fixture-failure"]);
  await run(cli, ["template", "use", "classic"]);
  const after = JSON.parse(await fs.readFile(profilePath, "utf8"));
  assert.deepEqual(after.site, before.site);
  assert.deepEqual(after.projects, before.projects);
  assert.ok(after.plugins.music.options.tracks.length);
  assert.equal(
    (
      await fs.readFile(path.join(sandbox, "content/blogs/first.md"), "utf8")
    ).includes("stable-first"),
    true,
  );
  assert.equal(
    await fs
      .stat(path.join(sandbox, "public/portfolio/audio/fixture.wav"))
      .then(
        () => true,
        () => false,
      ),
    false,
  );
  await run(cli, ["doctor", "--json"]);
  console.log("Building Classic again with both plugins disabled…");
  await build();
  base = await start();
  const disabledPage = await browser.newPage();
  const disabledResponse = await disabledPage.goto(base, {
    waitUntil: "networkidle",
  });
  assert.doesNotMatch(
    disabledResponse.headers()["content-security-policy"],
    /giscus|audio\.example|covers\.example/,
  );
  assert.equal(await disabledPage.locator("[data-plugin]").count(), 0);
  assert.equal(
    await disabledPage.locator("html").getAttribute("data-template"),
    "classic",
  );
  await disabledPage.goto(base + "/blogs/first", { waitUntil: "networkidle" });
  const cover = disabledPage.locator(".blog-post-hero-image");
  await cover.evaluate((image) => image.decode());
  assert.ok(
    await cover.evaluate(
      (image) =>
        Math.abs(
          image.clientWidth / image.clientHeight -
            image.naturalWidth / image.naturalHeight,
        ) < 0.01,
    ),
    "a direct article visit must preserve cover proportions without homepage CSS",
  );
  assert.equal(await disabledPage.locator("article table tbody tr").count(), 1);
  assert.equal(await disabledPage.locator("h2#body-2").count(), 1);
  assert.equal(
    await disabledPage
      .locator('script[type="application/ld+json"]')
      .evaluateAll(
        (nodes) =>
          nodes
            .map((node) => JSON.parse(node.textContent))
            .filter((value) => value["@type"] === "BlogPosting").length,
      ),
    1,
  );
  report.push(
    "CLI switching preserves content/settings; disabling removes UI, published audio and external CSP sources.",
  );
  await checkBlogTools(disabledPage, base);
  await checkPhotographyReveal(disabledPage, base);
  console.log(report.join("\n"));
} finally {
  await browser?.close();
  stop();
  // Check the resolved path before recursively removing only this owned sandbox.
  if (
    path.dirname(sandbox) !== path.join(root, ".generated") ||
    !path.basename(sandbox).startsWith("extension-qa-")
  )
    throw new Error("Unsafe sandbox cleanup");
  await fs.rm(sandbox, { recursive: true, force: true });
}
