import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";
import { loadQaProfile } from "./profile.mjs";
import { installServiceFixtures } from "./service-fixtures.mjs";

const profile = loadQaProfile();
if (!profile.features.photography) {
  console.log("PASS gallery loading: photography disabled");
  process.exit(0);
}
const first = profile.photography.images[0].src;
const lightboxImage = (url) =>
  url.pathname === "/_next/image" && url.searchParams.get("url") === first;
let releaseImage;
const imageGate = new Promise((resolve) => {
  releaseImage = resolve;
});
const browser = await chromium.launch({
  executablePath: resolveChromePath(),
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await installServiceFixtures(context, profile);
  const page = await context.newPage();
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:4181", {
    waitUntil: "networkidle",
  });
  const photo = page.getByRole("button", {
    name: "Open photograph 1 of",
    exact: false,
  });
  await photo.scrollIntoViewIfNeeded();
  await photo.locator("img").evaluate((img) => img.decode());

  // The lightbox may legitimately use the same optimized candidate as the
  // thumbnail for portrait photos. Disable cache only after the thumbnail is
  // ready so the newly mounted lightbox image still exercises its undecoded
  // geometry without depending on a fixed Next/Image width.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await context.route(lightboxImage, async (route) => {
    await imageGate;
    await route.continue().catch(() => {});
  });
  const requested = page.waitForRequest((request) =>
    lightboxImage(new URL(request.url())),
  );
  await photo.click();
  await requested;
  const dialog = page.getByRole("dialog", { name: "Photography viewer" });
  assert.deepEqual(
    await dialog.evaluate((el) => ({
      contentFilter: getComputedStyle(el).backdropFilter,
      backdropFilter: getComputedStyle(el, "::before").backdropFilter,
    })),
    { contentFilter: "none", backdropFilter: "blur(10px)" },
    "blur belongs to the independent backdrop, not the moving image subtree",
  );
  const image = dialog.locator("img");
  const before = await image.boundingBox();
  assert.equal(
    await image.evaluate((img) => img.naturalWidth),
    0,
    "test must inspect the undecoded image",
  );
  assert.ok(
    before.width > 300 && before.height > 300,
    "image fell back to a default placeholder size",
  );
  releaseImage();
  await image.evaluate((img) => img.decode());
  const after = await image.boundingBox();
  const deltas = Object.fromEntries(
    Object.keys(before).map((key) => [key, Math.abs(after[key] - before[key])]),
  );
  assert.ok(
    Object.values(deltas).every((value) => value <= 1),
    `image decode changes layout: ${JSON.stringify(deltas)}`,
  );
  await fs.writeFile(
    "qa/gallery-loading-report.json",
    JSON.stringify({ before, after, deltas }, null, 2),
  );
  console.log("PASS undecoded gallery image reserves its final geometry");
} finally {
  releaseImage();
  await browser.close();
}
