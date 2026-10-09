import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";
import { installServiceFixtures } from "./service-fixtures.mjs";
import { loadQaProfile } from "./profile.mjs";
import { publicationRoutes } from "./blog-routes.mjs";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const profile = loadQaProfile();
const routes = (await publicationRoutes()).filter((route) =>
  ["/", "/blogs", "/brink/privacy"].includes(route),
);
const browser = await chromium.launch({
  executablePath: resolveChromePath(),
  headless: true,
});
const report = [];
try {
  for (const route of routes) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    try {
      await installServiceFixtures(context, profile, base);
      const page = await context.newPage();
      const responses = [];
      page.on("response", (response) => {
        if (
          response.url().includes("/_next/static/") &&
          /\.(js|css)(\?|$)/.test(response.url())
        ) {
          responses.push(
            response.body().then((bytes) => ({
              file: new URL(response.url()).pathname,
              gzipBytes: gzipSync(bytes).length,
              home:
                response.url().endsWith(".js") &&
                bytes.includes("mobile-menu-toggle") &&
                bytes.includes("card-polaroid"),
              blog:
                response.url().endsWith(".css") &&
                bytes.includes(".writing-container"),
            })),
          );
        }
      });
      const document = await page.goto(base + route, {
        waitUntil: "networkidle",
      });
      // Next Link may prefetch another route after hydration. Test the current
      // document's dependency graph, not the user's possible next navigation.
      const direct = new Set(
        [
          ...(await document.text()).matchAll(
            /(?:src|href)="(\/_next\/static\/[^"?]+\.(?:js|css))/g,
          ),
        ].map((match) => match[1]),
      );
      const received = await Promise.all(responses);
      const assets = received.filter((asset) => direct.has(asset.file));
      assert.ok(
        assets.some((asset) => asset.file.endsWith(".js")),
        "must observe real scripts",
      );
      if ((profile.template?.id ?? "classic") === "classic") {
        assert.equal(
          assets.some((asset) => asset.home),
          route === "/",
          `${route}: homepage module ownership`,
        );
        assert.equal(
          assets.some((asset) => asset.blog),
          route === "/blogs",
          `${route}: article CSS ownership`,
        );
      }
      const item = {
        route,
        jsGzipBytes: assets
          .filter((asset) => asset.file.endsWith(".js"))
          .reduce((total, asset) => total + asset.gzipBytes, 0),
        assets,
        prefetched: received.filter((asset) => !direct.has(asset.file)),
      };
      report.push(item);
      console.log(
        `${route}: ${(item.jsGzipBytes / 1024).toFixed(1)} KiB gzip JS; module ownership passed`,
      );
    } finally {
      await context.close();
    }
  }
} catch (error) {
  await fs.writeFile(
    "qa/route-loading-report.json",
    JSON.stringify({ report, error: error.message }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
