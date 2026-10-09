import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";
import { prepareRefractFixture } from "./refract-fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
const existingFixture = process.argv
  .find((argument) => argument.startsWith("--fixture="))
  ?.slice(10);
const retain = process.argv.includes("--retain") || Boolean(existingFixture);
const selection = process.argv
  .find((argument) => argument.startsWith("--style="))
  ?.slice(8);
assert.ok(
  !selection || ["light", "dark"].includes(selection),
  "Use --style=light or --style=dark",
);
assert.ok(
  !existingFixture || selection,
  "--fixture requires an explicit --style",
);

async function reuseFixture(directory, style) {
  assert.ok(
    path.isAbsolute(directory),
    "--fixture must be an absolute project-local path",
  );
  const resolved = path.resolve(directory);
  const temporaryRoot = path.join(root, ".generated");
  assert.equal(
    path.dirname(resolved),
    temporaryRoot,
    "Fixture must remain directly under this project's .generated",
  );
  assert.match(
    path.basename(resolved),
    /^refract-qa-[a-zA-Z0-9]+$/,
    "Only owned Refract QA snapshots can be reused",
  );
  assert.equal(
    (await fs.realpath(resolved)).toLowerCase(),
    resolved.toLowerCase(),
    "Fixture cannot redirect through a symlink",
  );
  const profile = JSON.parse(
    await fs.readFile(path.join(resolved, "portfolio.json"), "utf8"),
  );
  assert.equal(
    profile.template?.id,
    `refract-${style}`,
    "Fixture style must match --style",
  );
  assert.ok(
    (await fs.readFile(path.join(resolved, ".next/BUILD_ID"), "utf8")).trim(),
    "Fixture needs a completed production build",
  );
  return { directory: resolved, profile };
}
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
for (const key of [
  "BOUNDARY_TARGET",
  "BOUNDARY_SHARED_BASE",
  "GITHUB_BASE_REF",
  "GITHUB_REF_NAME",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL",
])
  delete env[key];
const run = (command, args, directory, shell = false) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: directory,
      env,
      shell,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output = (output + chunk).slice(-24000);
    });
    child.stderr.on("data", (chunk) => {
      output = (output + chunk).slice(-24000);
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve(output) : reject(new Error(output)),
    );
  });
const freePort = () =>
  new Promise((resolve) => {
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
const browser = await chromium.launch({
  executablePath: resolveChromePath(),
  headless: true,
});

async function checkScene(base, style, directory, { width, fallback }) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "no-preference",
  });
  if (fallback)
    await context.addInitScript(() => {
      Object.defineProperty(window, "Worker", {
        configurable: true,
        value: undefined,
      });
    });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForSelector(
      `canvas[data-render-thread="${fallback ? "main" : "worker"}"]`,
      { timeout: 20000 },
    );
    await page.waitForSelector('.portfolio-experience[data-intro="complete"]', {
      timeout: 12000,
    });
    assert.ok(
      await page.locator("canvas").evaluate((canvas) => {
        const bytes = canvas
          .getContext("2d")
          .getImageData(0, 0, canvas.width, canvas.height).data;
        return bytes.some((value, index) => index % 4 === 3 && value > 0);
      }),
      "The scene rendered actual pixels",
    );
    if (width < 1200) {
      const menu = page.locator(".menu-toggle");
      await menu.click();
      await page.waitForFunction(
        () => document.body.style.position === "fixed",
      );
      assert.equal(await menu.getAttribute("aria-expanded"), "true");
      const controls = await menu.getAttribute("aria-controls");
      assert.equal(
        await page.locator(`[id=${JSON.stringify(controls)}]`).count(),
        1,
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document.body.style.position !== "fixed" &&
          document.documentElement.style.overflow !== "hidden",
      );
      // Escape releases scrolling immediately; the approved drawer finishes its
      // closing animation afterwards. Capture the settled state, not that frame.
      await page.waitForFunction(() => {
        const header = document.querySelector(".site-header");
        const navigation = document.querySelector("#main-navigation");
        if (!header || !navigation) return false;
        const progress = Number.parseFloat(
          getComputedStyle(header).getPropertyValue("--menu-progress"),
        );
        return (
          progress < 0.001 &&
          navigation.inert &&
          getComputedStyle(navigation).visibility === "hidden"
        );
      });
      assert.equal(
        await page
          .getByRole("button", { name: "Open navigation", exact: true })
          .evaluate((button) => button === document.activeElement),
        true,
      );
    }
    if (retain && !fallback) {
      const screenshots = path.join(directory, "screens");
      await fs.mkdir(screenshots, { recursive: true });
      await page.screenshot({
        path: path.join(screenshots, `${style}-${width}-home.png`),
      });
    }
    await page.evaluate(() =>
      document
        .getElementById("overview")
        .scrollIntoView({ behavior: "instant" }),
    );
    await page.waitForSelector(
      '.portfolio-experience[data-nav-visible="true"]',
    );
    const pause = page.getByRole("button", {
      name: "Pause animation",
      exact: true,
    });
    await pause.focus();
    await pause.press("Space");
    assert.equal(
      await page
        .getByRole("button", { name: "Resume animation", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    const slider = page.getByRole("slider", { name: "Page chapters" });
    await slider.focus();
    const before = await page.evaluate(() => scrollY);
    await slider.press("PageDown");
    await page.waitForFunction((previous) => scrollY > previous + 10, before);
    assert.ok((await slider.getAttribute("aria-valuetext"))?.length);
    const resume = page.getByRole("button", {
      name: "Resume animation",
      exact: true,
    });
    await resume.focus();
    await resume.press("Space");
    assert.equal(
      await page
        .getByRole("button", { name: "Pause animation", exact: true })
        .getAttribute("aria-pressed"),
      "false",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await page.goto(base + "/blogs", { waitUntil: "networkidle" });
    assert.equal(
      await page.locator("canvas").count(),
      0,
      "Scene unmounts on writing routes",
    );
    assert.deepEqual(
      errors,
      [],
      `${style} ${width} ${fallback ? "fallback" : "worker"}: interaction errors`,
    );
  } finally {
    await context.close();
  }
}

try {
  for (const style of selection ? [selection] : ["light", "dark"]) {
    const fixture = existingFixture
      ? await reuseFixture(existingFixture, style)
      : await prepareRefractFixture({ style, prefix: "refract-qa-" });
    let server;
    try {
      const cli = JSON.parse(
        await run(
          process.execPath,
          ["scripts/folio.mjs", "templates", "--json"],
          fixture.directory,
        ),
      );
      assert.equal(cli.find((item) => item.active)?.id, `refract-${style}`);
      assert.ok(cli.some((item) => item.id === "classic"));
      const before = await fs.readFile(
        path.join(fixture.directory, "portfolio.json"),
        "utf8",
      );
      await run(
        process.execPath,
        [
          "scripts/folio.mjs",
          "template",
          "use",
          style === "light" ? "refract-dark" : "refract-light",
          "--dry-run",
        ],
        fixture.directory,
      );
      assert.equal(
        await fs.readFile(
          path.join(fixture.directory, "portfolio.json"),
          "utf8",
        ),
        before,
      );
      if (!existingFixture) {
        console.log(
          `Building Refract ${style} with the default npm build pipeline…`,
        );
        const build = await run(
          process.platform === "win32" ? "npm.cmd" : "npm",
          ["run", "build"],
          fixture.directory,
          process.platform === "win32",
        );
        console.log(build.slice(-1800));
      } else
        console.log(
          `Verifying retained Refract ${style} production build: ${fixture.directory}`,
        );
      const port = await freePort();
      const base = `http://127.0.0.1:${port}`;
      server = spawn(
        process.execPath,
        [
          path.join(root, "node_modules/next/dist/bin/next"),
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
        ],
        {
          cwd: fixture.directory,
          env,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      server.stdout.on("data", (chunk) => {
        output = (output + chunk).slice(-6000);
      });
      server.stderr.on("data", (chunk) => {
        output = (output + chunk).slice(-6000);
      });
      for (let attempt = 0; attempt < 60; attempt++) {
        if (server.exitCode !== null) throw new Error(output);
        if (
          (
            await fetch(base, { signal: AbortSignal.timeout(2000) }).catch(
              () => null,
            )
          )?.ok
        )
          break;
        if (attempt === 59)
          throw new Error("Refract fixture did not start: " + output);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      for (const width of [1440, 390, 320]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          for (const route of [
            "/",
            "/blogs",
            "/blogs/designing-with-constraints",
            "/blogs/tag/design",
          ]) {
            const response = await page.goto(base + route, {
              waitUntil: "networkidle",
            });
            assert.equal(response.status(), 200, route);
            assert.equal(
              await page.locator("html").getAttribute("data-template"),
              `refract-${style}`,
            );
            assert.ok((await page.locator("h1").first().innerText()).trim());
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth + 1,
              ),
              false,
              `${style} ${width} ${route}: horizontal overflow`,
            );
            assert.equal(
              await page.locator("[data-plugin]").count(),
              0,
              "Demo plugins are disabled",
            );
            assert.doesNotMatch(
              await page.locator("body").innerText(),
              /Weijie|wj714|berkeley\.edu|wzhang01/i,
            );
            if (route === "/") {
              assert.equal(await page.locator("#work").count(), 1);
              assert.equal(await page.locator("#about").count(), 1);
              for (const href of await page
                .locator('a[href^="#"]')
                .evaluateAll((links) =>
                  links.map((link) => link.getAttribute("href")),
                ))
                if (href.length > 1)
                  assert.equal(
                    await page
                      .locator(`[id=${JSON.stringify(href.slice(1))}]`)
                      .count(),
                    1,
                    `Missing anchor ${href}`,
                  );
            }
            if (route === "/blogs/designing-with-constraints") {
              assert.ok(await page.locator("article table").count());
              await page.getByText("On this page", { exact: true }).click();
              await page
                .getByRole("link", {
                  name: "Leave room to explore",
                  exact: true,
                })
                .click();
              assert.ok(page.url().endsWith("#leave-room-to-explore"));
              await page
                .getByRole("link", { name: "All writing", exact: false })
                .first()
                .click();
              await page.waitForURL(base + "/blogs");
            }
          }
          assert.deepEqual(errors, [], `${style} ${width}: browser errors`);
        } finally {
          await context.close();
        }
      }
      for (const route of [
        "/manifest.webmanifest",
        "/robots.txt",
        "/sitemap.xml",
      ])
        assert.ok((await fetch(base + route)).ok, route);
      assert.equal((await fetch(base + "/clipt")).status, 404);
      for (const mode of [
        { width: 1440, fallback: false },
        { width: 1440, fallback: true },
        { width: 390, fallback: false },
      ])
        await checkScene(base, style, fixture.directory, mode);
      console.log(
        `Refract ${style}: CLI, production routes, article semantics, 1440/390/320px layouts, worker/fallback drawing, timeline seek/pause, mobile menu Escape and live reduced motion passed.`,
      );
    } finally {
      if (server && server.exitCode === null) {
        const exited = new Promise((resolve) => server.once("exit", resolve));
        if (process.platform === "win32")
          spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true,
          });
        else server.kill("SIGTERM");
        await exited;
      }
      if (retain)
        console.log(
          `Retained Refract ${style} fixture for review: ${fixture.directory}`,
        );
      else await fixture.cleanup();
    }
  }
} finally {
  await browser.close();
}
