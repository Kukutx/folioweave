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
    eventTargetMs: 200,
    budgets: {
      cls: 0.1,
      lcpMs: 2500,
      longestTaskMs: 200,
      interactionWorkP95Ms: 50,
      frameP95Ms: 50,
    },
  },
  {
    name: "constrained",
    cpuSlowdown: 4,
    latencyMs: 150,
    downloadBytesPerSecond: 200000,
    uploadBytesPerSecond: 100000,
    eventTargetMs: 200,
    budgets: {
      cls: 0.1,
      lcpMs: 6000,
      longestTaskMs: 500,
      interactionWorkP95Ms: 100,
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
async function afterPaint(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function viewerReady(page, dialog, { neighbors = false } = {}) {
  await dialog.locator("img").evaluateAll(async (images) => {
    const visible = images.find((image) => getComputedStyle(image).opacity === "1");
    if (!visible) throw new Error("Lightbox has no visible image");
    await visible.decode();
  });
  await page.waitForFunction((requireNeighbors) => {
    const viewer = document.querySelector(".gallery-overlay[open]");
    const images = [...(viewer?.querySelectorAll("img") ?? [])];
    const visible = images.filter(
      (image) => getComputedStyle(image).opacity === "1",
    );
    return (
      viewer &&
      visible.length === 1 &&
      getComputedStyle(viewer).opacity === "1" &&
      visible[0].complete &&
      visible[0].naturalWidth > 0 &&
      (!requireNeighbors || viewer.dataset.neighborPreloadReady === "true")
    );
  }, neighbors);
}
const browserProbe = await chromium.launch({ headless: true });
const browserVersion = browserProbe.version();
await browserProbe.close();
const environment = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  browser: browserVersion,
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
          const browser = await chromium.launch({ headless: true });
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
          // Keep navigation/LCP cold, then restore normal browser caching for
          // interaction measurements. Re-fetching already displayed thumbnails
          // on every lightbox transition measures forced cache misses, not the
          // page's real interaction cost.
          await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
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
              // The lightbox warms adjacent images after the opening frame.
              // Start keyboard interaction timing only after that warm-up
              // completes, so this measures app presentation work rather than
              // a synthetic race with image fetch/decode.
              await viewerReady(page, dialog, { neighbors: true });
              await page.keyboard.press("ArrowRight");
              await afterPaint(page);
              await viewerReady(page, dialog);
              await page.keyboard.press("Escape");
              await afterPaint(page);
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
            // Event Timing's presentation component is highly sensitive to the
            // headless CI compositor. Gate queue + handler work separately,
            // while frame/LCP/long-task budgets continue to cover rendering.
            interactionWorkP95Ms: percentile(
              metrics.eventDetails.map(
                (event) => event.inputDelay + event.processing,
              ),
              0.95,
            ),
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
              interactionWorkP95Ms: item.interactionWorkP95Ms,
              frameP95Ms: item.frameP95Ms,
            }),
          );
          assert.deepEqual(errors, []);
          assert.ok(
            frames.length >= 20 && metrics.lcp > 0,
            "missing performance samples",
          );
          await context.close();
          await browser.close();
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
          interactionWorkP95Ms: median("interactionWorkP95Ms"),
          frameP95Ms: median("frameP95Ms"),
        };
        summaries.push(summary);
        if (summary.eventP95Ms > conditions.eventTargetMs)
          warnings.push({
            profile: conditions.name,
            width,
            reducedMotion,
            eventP95Ms: summary.eventP95Ms,
            message:
              "Above the 200ms synthetic Event Timing target; CI gates deterministic interaction work plus frame/LCP/long-task budgets because headless presentation scheduling is host-sensitive.",
          });
        const checks = {
          cls: summary.cls <= budgets.cls,
          lcp: summary.lcp <= budgets.lcpMs,
          longestTask: summary.longestTaskMs <= budgets.longestTaskMs,
          interactionWorkP95:
            summary.interactionWorkP95Ms <= budgets.interactionWorkP95Ms,
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
