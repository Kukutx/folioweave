import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const browser = await chromium.launch({
  executablePath: resolveChromePath(),
  headless: true,
});
const results = [];

async function scan(route, blockFonts = false) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });

  if (blockFonts) {
    await context.route(/\/fonts\/(?:google|satoshi)-.*\.woff2/, (request) =>
      request.abort(),
    );
  }

  const page = await context.newPage();
  await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const block = [...document.querySelectorAll("h3")]
      .find((element) => element.textContent?.includes("Blockbuster Tuesdays"))
      ?.parentElement?.querySelector("p");
    const firstWork = document.querySelector("#work .work-item");

    return {
      height: document.documentElement.scrollHeight,
      blockHeight: block?.getBoundingClientRect().height,
      workHeight: firstWork?.getBoundingClientRect().height,
      faces: [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => ({
          family: font.family,
          weight: font.weight,
          style: font.style,
        }))
        .filter((font) =>
          /Google Sans|Inter|Newsreader|Instrument|Satoshi/.test(font.family),
        ),
    };
  });

  const item = { route, blocked: blockFonts, ...data };
  results.push(item);
  console.log(route, blockFonts ? "blocked" : "normal", data);
  await context.close();
  return item;
}

const comparisons = [];
for (const route of ["/", "/district", "/clipt"]) {
  const normal = await scan(route, false);
  const blocked = await scan(route, true);
  const close = (a, b) =>
    a === undefined || b === undefined || Math.abs(a - b) <= 0.01;
  comparisons.push({
    route,
    heightEqual: normal.height === blocked.height,
    blockHeightEqual: close(normal.blockHeight, blocked.blockHeight),
    workHeightEqual: close(normal.workHeight, blocked.workHeight),
  });
}

await browser.close();
const failures = comparisons.filter(
  (item) =>
    !item.heightEqual || !item.blockHeightEqual || !item.workHeightEqual,
);
const summary = {
  checks: comparisons.length,
  passed: comparisons.length - failures.length,
  failed: failures.length,
};
await fs.writeFile(
  "qa/font-fallback-report.json",
  JSON.stringify({ base, summary, comparisons, results }, null, 2),
);
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
