import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import { qaTemplate } from "./template.mjs";
const FONT_SENTINEL_ROUTES = Object.freeze(["/district", "/clipt"]);

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const portfolio = JSON.parse(
  await fs.readFile(new URL("../portfolio.json", import.meta.url), "utf8"),
);
const demoRoutesEnabled = portfolio.features?.demoRoutes !== false;
const template = qaTemplate();
const routes = [
  "/",
  ...(demoRoutesEnabled ? FONT_SENTINEL_ROUTES : []),
  ...template.pages.map((page) => page.href),
];
// Classic's own families; any other template's web fonts are all of its faces.
const webFamily = template.classic
  ? /Google Sans|Inter|Newsreader|Instrument|Satoshi|Caveat/
  : /./;
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
    // Every web font, whether served from /fonts or bundled under /_next.
    await context.route(/\.woff2?(?:\?|$)/, (request) => request.abort());
  }

  const page = await context.newPage();
  await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.load('400 24px "Caveat Portfolio"').catch(() => []));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  const data = await page.evaluate((families) => {
    const block = [...document.querySelectorAll("h3")]
      .find((element) => element.textContent?.includes("Blockbuster Tuesdays"))
      ?.parentElement?.querySelector("p");
    const firstWork = document.querySelector("#work .work-item");

    return {
      height: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      contentVisible: Boolean(document.querySelector("h1")?.getBoundingClientRect().height),
      blockHeight: block?.getBoundingClientRect().height,
      workHeight: firstWork?.getBoundingClientRect().height,
      faces: [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => ({
          family: font.family,
          weight: font.weight,
          style: font.style,
        }))
        .filter((font) => new RegExp(families).test(font.family)),
    };
  }, webFamily.source);

  const item = { route, blocked: blockFonts, ...data };
  results.push(item);
  console.log(route, blockFonts ? "blocked" : "normal", data);
  await context.close();
  return item;
}

const comparisons = [];
for (const route of routes) {
  const normal = await scan(route, false);
  const blocked = await scan(route, true);
  const close = (a, b) =>
    a === undefined || b === undefined || Math.abs(a - b) <= 0.01;
  comparisons.push({
    route,
    fontsBlocked: blocked.faces.length === 0,
    contentVisible: normal.contentVisible && blocked.contentVisible,
    overflow: normal.overflow || blocked.overflow,
    heightEqual: normal.height === blocked.height,
    blockHeightEqual: close(normal.blockHeight, blocked.blockHeight),
    workHeightEqual: close(normal.workHeight, blocked.workHeight),
  });
}

await browser.close();
const failures = comparisons.filter(
  (item) =>
    !item.fontsBlocked || !item.contentVisible || item.overflow,
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
