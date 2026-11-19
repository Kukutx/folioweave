// Capture each template's gallery picture from the canonical demo profile.
//
//   npm run templates:previews [-- <template-id>...]
//
// Starts one preview sandbox at a time (see template-preview.mjs), lets the
// opening settle with reduced motion, saves preview.webp next to the manifest
// and names it there. Pictures show the demo profile, never an author's own.
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { implementationRoot as root, loadCatalog } from "../src/core/extensions.mjs";
import { resolveChromePath } from "../qa/chrome.mjs";
import { startPreview } from "./template-preview.mjs";

const wanted = process.argv.slice(2);
const templates = loadCatalog(root).templates.filter(
  (template) => !wanted.length || wanted.includes(template.id),
);
const browser = await chromium.launch({ executablePath: resolveChromePath() });
try {
  for (const template of templates) {
    const directory = path.join(root, "src/templates", template.id);
    const sample = path.join(directory, "sample.json");
    // The gallery shows each template as its sample presents it, so the
    // sample wins over the demo profile here (a shop's name and copy).
    const merges = (await fs.stat(sample).catch(() => null)) ? [sample] : [];
    const preview = await startPreview({
      template: template.id,
      profile: "demo",
      merges,
      quiet: true,
    });
    try {
      await preview.ready;
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      await page.goto(preview.url, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      // Development badges and floating plugins are not part of a template.
      await page.addStyleTag({
        content: "nextjs-portal, [data-plugin] { display: none !important; }",
      });
      await page.waitForTimeout(2500);
      const shot = await page.screenshot();
      await page.close();
      await sharp(shot)
        .resize(1200, 750)
        .webp({ quality: 82 })
        .toFile(path.join(directory, "preview.webp"));
      const file = path.join(directory, "manifest.json");
      const manifest = JSON.parse(await fs.readFile(file, "utf8"));
      if (manifest.preview !== "preview.webp") {
        manifest.preview = "preview.webp";
        await fs.writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
      }
      console.log(`${template.id}: preview.webp`);
    } finally {
      await preview.stop();
    }
  }
} finally {
  await browser.close();
}
