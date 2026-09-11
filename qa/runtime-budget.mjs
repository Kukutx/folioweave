import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import { chromium } from "playwright-core";
import { installServiceFixtures } from "./service-fixtures.mjs";

// Synthetic regression budgets, NOT field CWV / INP or a device benchmark.
const profiles = [
  {
    name: "native",
    cpuSlowdown: 1,
    latencyMs: 0,
    downloadBytesPerSecond: -1,
    uploadBytesPerSecond: -1,
    budgets: {
      cls: 0.1,
      lcpMs: 2500,
      longestTaskMs: 200,
      eventP95Ms: 200,
      frameP95Ms: 50,
    },
  },
  {
    name: "constrained",
    cpuSlowdown: 4,
    latencyMs: 150,
    downloadBytesPerSecond: 200000,
    uploadBytesPerSecond: 100000,
    budgets: {
      cls: 0.1,
      lcpMs: 6000,
      longestTaskMs: 500,
      eventP95Ms: 300,
      frameP95Ms: 100,
    },
  },
];
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[
    Math.max(0, Math.ceil(values.length * p) - 1)
  ] ?? 0;
const report = [];
const failures = [];
const summaries = [];
const warnings = [];
const trace = process.argv.includes("--trace");
const diagnostic = trace || process.argv.includes("--diagnostic");
const motionOption = process.argv.find((arg) => arg.startsWith("--motion="));
assert.ok(
  !motionOption || diagnostic,
  "--motion is only available for diagnostics",
);
assert.ok(
  !motionOption ||
    ["--motion=normal", "--motion=reduce"].includes(motionOption),
  "Unknown motion diagnostic",
);
const diagnosticMotion =
  motionOption === "--motion=normal" ? "no-preference" : "reduce";
const viewportOption = process.argv.find((arg) =>
  arg.startsWith("--viewport="),
);
assert.ok(
  !viewportOption || diagnostic,
  "--viewport is only available for diagnostics",
);
assert.ok(
  !viewportOption ||
    ["--viewport=mobile", "--viewport=desktop"].includes(viewportOption),
  "Unknown viewport diagnostic",
);
const diagnosticWidth = viewportOption === "--viewport=mobile" ? 390 : 1440;
const profileOption = process.argv.find((arg) => arg.startsWith("--profile="));
assert.ok(
  !profileOption || diagnostic,
  "--profile is only available for diagnostics",
);
assert.ok(
  !profileOption ||
    ["--profile=native", "--profile=constrained"].includes(profileOption),
  "Unknown profile diagnostic",
);
const diagnosticProfile =
  profileOption === "--profile=native" ? "native" : "constrained";
async function viewerReady(page, dialog) {
  await dialog
    .locator("img")
    .last()
    .evaluate((img) => img.decode());
  await page.waitForFunction(() => {
    const viewer = document.querySelector(".gallery-overlay[open]");
    const images = viewer?.querySelectorAll("img");
    return (
      images?.length === 1 &&
      getComputedStyle(viewer).opacity === "1" &&
      getComputedStyle(images[0]).opacity === "1"
    );
  });
}
const browser = await chromium.launch({ headless: true });
const environment = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  browser: browser.version(),
  logicalCpus: os.cpus().length,
  totalMemoryBytes: os.totalmem(),
};
try {
  for (const conditions of diagnostic
    ? profiles.filter((profile) => profile.name === diagnosticProfile)
    : profiles) {
    const budgets = conditions.budgets;
    for (const width of diagnostic ? [diagnosticWidth] : [390, 1440])
      for (const reducedMotion of diagnostic
        ? [diagnosticMotion]
        : ["reduce", "no-preference"]) {
        for (let sample = 1; sample <= (diagnostic ? 1 : 3); sample++) {
          const freeMemoryBefore = os.freemem();
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            isMobile: width < 768,
            hasTouch: width < 768,
            reducedMotion,
          });
          await installServiceFixtures(context);
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          const cdp = await context.newCDPSession(page);
          const traceEvents = [];
          if (trace) {
            cdp.on("Tracing.dataCollected", ({ value }) =>
              traceEvents.push(...value),
            );
            await cdp.send("Tracing.start", {
              categories: "devtools.timeline,v8.execute,blink.user_timing",
              transferMode: "ReportEvents",
            });
            await cdp.send("Profiler.enable");
            await cdp.send("Profiler.start");
          }
          await cdp.send("Emulation.setCPUThrottlingRate", {
            rate: conditions.cpuSlowdown,
          });
          await cdp.send("Network.enable");
          await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: conditions.latencyMs,
            downloadThroughput: conditions.downloadBytesPerSecond,
            uploadThroughput: conditions.uploadBytesPerSecond,
          });
          await context.addInitScript(() => {
            performance.mark("qa:load");
            window.__runtimeMetrics = {
              cls: 0,
              lcp: 0,
              longTasks: [],
              interactions: [],
              eventDetails: [],
              shifts: [],
              lcpDetails: null,
            };
            let sessionStart = 0,
              lastShift = 0,
              sessionValue = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (entry.hadRecentInput) continue;
                window.__runtimeMetrics.shifts.push({
                  value: entry.value,
                  time: entry.startTime,
                  sources: entry.sources.map((source) => ({
                    node: source.node?.outerHTML?.slice(0, 220),
                    before: source.previousRect,
                    after: source.currentRect,
                  })),
                });
                if (
                  sessionValue === 0 ||
                  entry.startTime - lastShift > 1000 ||
                  entry.startTime - sessionStart > 5000
                ) {
                  sessionStart = entry.startTime;
                  sessionValue = 0;
                }
                lastShift = entry.startTime;
                sessionValue += entry.value;
                window.__runtimeMetrics.cls = Math.max(
                  window.__runtimeMetrics.cls,
                  sessionValue,
                );
              }
            }).observe({ type: "layout-shift", buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                window.__runtimeMetrics.lcp = entry.startTime;
                window.__runtimeMetrics.lcpDetails = {
                  startTime: entry.startTime,
                  renderTime: entry.renderTime,
                  loadTime: entry.loadTime,
                  size: entry.size,
                  url: entry.url || null,
                  element: entry.element?.outerHTML?.slice(0, 320) ?? null,
                };
              }
            }).observe({ type: "largest-contentful-paint", buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries())
                window.__runtimeMetrics.longTasks.push({
                  duration: entry.duration,
                  startTime: entry.startTime,
                  phase:
                    performance
                      .getEntriesByType("mark")
                      .filter(
                        (mark) =>
                          mark.name.startsWith("qa:") &&
                          mark.startTime <= entry.startTime,
                      )
                      .at(-1)?.name ?? "qa:load",
                });
            }).observe({ type: "longtask", buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries())
                if (entry.interactionId) {
                  window.__runtimeMetrics.interactions.push(entry.duration);
                  window.__runtimeMetrics.eventDetails.push({
                    id: entry.interactionId,
                    name: entry.name,
                    duration: entry.duration,
                    inputDelay: entry.processingStart - entry.startTime,
                    processing: entry.processingEnd - entry.processingStart,
                    presentation:
                      entry.startTime + entry.duration - entry.processingEnd,
                    target: entry.target?.outerHTML?.slice(0, 180),
                  });
                }
            }).observe({
              type: "event",
              buffered: true,
              durationThreshold: 16,
            });
          });
          await page.goto(process.env.BASE_URL || "http://127.0.0.1:4181", {
            waitUntil: "networkidle",
            timeout: 60000,
          });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(1000);
          await page.evaluate(() => performance.mark("qa:hero-actions"));
          if (width < 768)
            for (let i = 0; i < 3; i++) {
              await page.locator(".mobile-menu-toggle").click();
              await page.keyboard.press("Escape");
            }
          for (let i = 0; i < 3; i++)
            await page.locator(".card-polaroid").click();
          const frames = await page.evaluate(
            () =>
              new Promise((resolve) => {
                performance.mark("qa:scroll");
                const values = [];
                const start = performance.now();
                let last = start;
                const extent =
                  document.documentElement.scrollHeight - innerHeight;
                const step = (now) => {
                  values.push(now - last);
                  last = now;
                  const progress = Math.min(1, (now - start) / 4000);
                  window.scrollTo(0, extent * progress);
                  if (progress < 1) requestAnimationFrame(step);
                  else {
                    performance.mark("qa:scroll-end");
                    resolve(values.slice(1));
                  }
                };
                requestAnimationFrame(step);
              }),
          );
          const photo = page.getByRole("button", {
            name: "Open photograph 1 of",
            exact: false,
          });
          await page.evaluate(() => performance.mark("qa:gallery"));
          if (await photo.count())
            for (let i = 0; i < 3; i++) {
              await photo.scrollIntoViewIfNeeded();
              // Interact with the loaded photograph, not a still-loading lazy-image
              // placeholder reached by the synthetic full-document scroll sweep.
              await photo.locator("img").evaluate((img) => img.decode());
              await photo.click();
              const dialog = page.getByRole("dialog", {
                name: "Photography viewer",
              });
              await dialog.waitFor();
              await viewerReady(page, dialog);
              await page.keyboard.press("ArrowRight");
              await viewerReady(page, dialog);
              await page.keyboard.press("Escape");
              await dialog.waitFor({ state: "detached" });
            }
          await page.waitForTimeout(500);
          const metrics = await page.evaluate(() => window.__runtimeMetrics);
          const item = {
            profile: conditions.name,
            width,
            reducedMotion,
            sample,
            hostMemory: {
              freeBeforeBytes: freeMemoryBefore,
              freeAfterBytes: os.freemem(),
            },
            ...metrics,
            longestTaskMs: Math.max(
              0,
              ...metrics.longTasks.map((task) => task.duration),
            ),
            eventP95Ms: percentile(metrics.interactions, 0.95),
            frameP95Ms: percentile(frames, 0.95),
            frameSamples: frames.length,
            errors,
          };
          report.push(item);
          if (trace) {
            const { profile } = await cdp.send("Profiler.stop");
            await fs.writeFile(
              `qa/runtime-${width}-${reducedMotion}-${sample}-cpu-report.json`,
              JSON.stringify(profile),
            );
            const ended = new Promise((resolve) =>
              cdp.once("Tracing.tracingComplete", resolve),
            );
            await cdp.send("Tracing.end");
            await ended;
            await fs.writeFile(
              `qa/runtime-${width}-${reducedMotion}-${sample}-trace-report.json`,
              JSON.stringify(traceEvents),
            );
          }
          console.log(
            JSON.stringify({
              profile: conditions.name,
              width,
              reducedMotion,
              sample,
              cls: metrics.cls,
              lcp: metrics.lcp,
              lcpDetails: metrics.lcpDetails,
              longestTaskMs: item.longestTaskMs,
              longestTask:
                [...metrics.longTasks].sort(
                  (a, b) => b.duration - a.duration,
                )[0] ?? null,
              eventP95Ms: item.eventP95Ms,
              frameP95Ms: item.frameP95Ms,
            }),
          );
          assert.deepEqual(errors, []);
          assert.ok(
            frames.length >= 20 && metrics.lcp > 0,
            "missing performance samples",
          );
          await context.close();
        }
        const samples = report.filter(
          (item) =>
            item.profile === conditions.name &&
            item.width === width &&
            item.reducedMotion === reducedMotion,
        );
        const median = (key) =>
          percentile(
            samples.map((item) => item[key]),
            0.5,
          );
        const summary = {
          profile: conditions.name,
          width,
          reducedMotion,
          samples: samples.length,
          cls: Math.max(...samples.map((item) => item.cls)),
          lcp: median("lcp"),
          longestTaskMs: median("longestTaskMs"),
          eventP95Ms: median("eventP95Ms"),
          frameP95Ms: median("frameP95Ms"),
        };
        summaries.push(summary);
        if (conditions.name === "constrained" && summary.eventP95Ms > 200)
          warnings.push({
            profile: conditions.name,
            width,
            reducedMotion,
            eventP95Ms: summary.eventP95Ms,
            message:
              "Above the 200ms native-environment interaction target; constrained budget is not an INP claim.",
          });
        const checks = {
          cls: summary.cls <= budgets.cls,
          lcp: summary.lcp <= budgets.lcpMs,
          longestTask: summary.longestTaskMs <= budgets.longestTaskMs,
          eventP95: summary.eventP95Ms <= budgets.eventP95Ms,
          frameP95: summary.frameP95Ms <= budgets.frameP95Ms,
        };
        for (const [metric, passed] of Object.entries(checks))
          if (!passed)
            failures.push({
              profile: conditions.name,
              width,
              reducedMotion,
              metric,
            });
      }
  }
} finally {
  await browser.close();
  await fs.writeFile(
    diagnostic
      ? "qa/runtime-diagnostic-report.json"
      : "qa/runtime-budget-report.json",
    JSON.stringify(
      { environment, profiles, summaries, report, warnings, failures },
      null,
      2,
    ),
  );
}
if (warnings.length) console.warn(JSON.stringify({ warnings }, null, 2));
assert.deepEqual(failures, [], "synthetic performance budgets exceeded");
