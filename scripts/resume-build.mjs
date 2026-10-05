import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  RESUME_FONT_STACK,
  RESUME_LOCK,
  RESUME_RENDER,
  RESUME_SOURCE,
  checkResume,
  loadResume,
  readResumeLock,
  resolveResumeTargets,
  resumeGeometry,
  resumeLockFor,
  sha256,
} from "./resume-core.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// Advance width of FONT_SAMPLE at 1000px in Arial, measured without kerning.
// Liberation Sans and Arimo share these metrics by design; any other fallback
// would silently reflow the page, so the build refuses to render with it.
const FONT_SAMPLE =
  "abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789";
const ARIAL_METRICS = { 400: 36458.0078125, 700: 38008.7890625 };
const FONT_TOLERANCE = 0.005;

export function assertResumeFonts(widths) {
  for (const [weight, expected] of Object.entries(ARIAL_METRICS)) {
    const drift = Math.abs(widths[weight] - expected) / expected;
    if (!(drift <= FONT_TOLERANCE))
      throw new Error(
        `Resume fonts are unavailable: none of ${RESUME_FONT_STACK} resolved to Arial-compatible metrics at weight ${weight}. Install Arial or Liberation Sans, then run npm run resume:build again.`,
      );
  }
}

async function launch() {
  // Loaded on demand so the dev watcher starts without a browser.
  const { chromium } = await import("playwright-core");
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (/Executable doesn't exist/.test(String(error?.message)))
      throw new Error(
        "The pinned Chromium is not installed. Run: node node_modules/playwright-core/cli.js install chromium",
        { cause: error },
      );
    throw error;
  }
}

/** Renders one document; callers decide where the bytes go. */
export async function renderResume(html) {
  const { sheet } = resumeGeometry();
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: sheet,
      deviceScaleFactor: RESUME_RENDER.captureScale,
    });
    // The document is self-contained; nothing may be fetched while rendering.
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });

    const measured = await page.evaluate(
      ({ sample, stack, pageHeightMm }) => {
        const canvas = document.createElement("canvas").getContext("2d");
        // Advance widths only: kerning tables differ between compatible faces.
        canvas.fontKerning = "none";
        const width = (weight) => {
          canvas.font = `${weight} 1000px ${stack}`;
          return canvas.measureText(sample).width;
        };
        const probe = document.createElement("div");
        probe.style.cssText = `position:absolute;visibility:hidden;height:${pageHeightMm}mm`;
        document.body.append(probe);
        const pageHeight = probe.getBoundingClientRect().height;
        probe.remove();

        const content = document.querySelector(".page");
        const box = content.getBoundingClientRect();
        const style = getComputedStyle(content);
        const bottomMargin = parseFloat(style.paddingBottom);
        const rightEdge = box.right - parseFloat(style.paddingRight);
        // Measure where text is painted, not the boxes around it: a word that
        // cannot wrap overflows its element without making the element wider.
        let widest = null;
        const texts = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = texts.nextNode(); node; node = texts.nextNode()) {
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            const overflow = rect.right - rightEdge;
            if (overflow > 0.5 && overflow > (widest?.overflow ?? 0))
              widest = { overflow, text: node.data.trim().slice(0, 60) };
          }
        }
        return {
          fonts: { 400: width(400), 700: width(700) },
          available: pageHeight - bottomMargin,
          used: box.height - bottomMargin,
          widest,
        };
      },
      {
        sample: FONT_SAMPLE,
        stack: RESUME_FONT_STACK,
        pageHeightMm: RESUME_RENDER.page.heightMm,
      },
    );

    assertResumeFonts(measured.fonts);
    const millimetres = (pixels) => ((pixels * 25.4) / 96).toFixed(1);
    // Reported first: text that cannot wrap also squeezes its neighbours, so
    // it usually shows up as a too-long page as well.
    if (measured.widest)
      throw new Error(
        `Resume content runs ${millimetres(measured.widest.overflow)}mm past the right margin near "${measured.widest.text}". Shorten that line in ${RESUME_SOURCE}.`,
      );
    if (measured.used > measured.available + 0.5)
      throw new Error(
        `Resume does not fit one A4 page: content is ${millimetres(measured.used - measured.available)}mm too long. Shorten ${RESUME_SOURCE}; the printer preview shows a single sheet.`,
      );

    const pdf = await page.pdf(RESUME_RENDER.pdf);
    const pages =
      pdf.toString("latin1").match(/\/Type\s*\/Page\b(?!s)/g)?.length ?? 0;
    if (pages !== 1)
      throw new Error(
        `Resume PDF should be exactly one page; counted ${pages}.`,
      );

    const capture = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, ...sheet },
    });
    return {
      pdf,
      capture,
      fill: measured.used / measured.available,
      browser: `chromium ${browser.version()}`,
    };
  } finally {
    await browser.close();
  }
}

async function encodePreview(capture, extension) {
  const { default: sharp } = await import("sharp");
  const image = sharp(capture).resize({
    ...resumeGeometry().preview,
    ...RESUME_RENDER.resample,
  });
  if (extension === ".png") return image.png(RESUME_RENDER.png).toBuffer();
  const lossy = { quality: RESUME_RENDER.lossyQuality };
  return extension === ".webp"
    ? image.webp(lossy).toBuffer()
    : image.jpeg(lossy).toBuffer();
}

const isRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

/**
 * One build at a time per project: the dev watcher and a manual build would
 * otherwise interleave their outputs and lock. A lock left by a build that is
 * gone is taken over, so a crash never blocks the next run.
 */
async function withBuildLock(root, run) {
  const lock = path.join(root, ".generated", "resume-build.lock");
  await fs.mkdir(path.dirname(lock), { recursive: true });
  for (;;) {
    try {
      await fs.writeFile(lock, String(process.pid), { flag: "wx" });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const owner = Number(await fs.readFile(lock, "utf8").catch(() => ""));
      if (owner && owner !== process.pid && isRunning(owner))
        throw new Error(
          `Another resume build is running (pid ${owner}). Wait for it to finish.`,
        );
      await fs.rm(lock, { force: true });
    }
  }
  try {
    return await run();
  } finally {
    await fs.rm(lock, { force: true });
  }
}

/**
 * Replaces the outputs and their lock together. Everything is staged under
 * ignored `.generated/` first, so a failed write changes nothing and no
 * temporary file ever appears in author storage. If a replacement fails part
 * way, the files already replaced are put back, so outputs and lock keep
 * describing the same build.
 */
async function replaceFiles(root, files) {
  const staging = path.join(root, ".generated", `resume-build-${process.pid}`);
  await fs.rm(staging, { recursive: true, force: true });
  await fs.mkdir(staging, { recursive: true });
  const replaced = [];
  try {
    for (const [index, [, contents]] of files.entries())
      await fs.writeFile(path.join(staging, `next-${index}`), contents);
    for (const [index, [target]] of files.entries()) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      const previous = path.join(staging, `previous-${index}`);
      const existed = await fs.rename(target, previous).then(
        () => true,
        (error) => {
          if (error.code === "ENOENT") return false;
          throw error;
        },
      );
      replaced.push({ target, previous, existed });
      await fs.rename(path.join(staging, `next-${index}`), target);
    }
  } catch (error) {
    for (const { target, previous, existed } of replaced.toReversed()) {
      await fs.rm(target, { force: true }).catch(() => {});
      if (existed) await fs.rename(previous, target).catch(() => {});
    }
    throw error;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

/**
 * Renders only when the committed output is stale: a PDF embeds its creation
 * time, so rendering an unchanged source would rewrite it for no reason.
 *
 * A target that exists but is not recorded in the lock is a hand-made file.
 * It is replaced only with `adopt`, never implicitly and never by the watcher.
 */
export async function buildResume(
  root = projectRoot,
  { force = false, adopt = false } = {},
) {
  const loaded = await loadResume(root);
  if (!loaded)
    throw new Error(
      `No ${RESUME_SOURCE}. Copy content/resume/resume.example.json to start one.`,
    );
  const config = JSON.parse(
    await fs.readFile(path.join(root, "portfolio.json"), "utf8"),
  );
  const targets = resolveResumeTargets(root, config);
  return withBuildLock(root, async () => {
    const current = await checkResume(root, config).then(
      () => true,
      () => false,
    );
    if (current && !force) return { status: "current", targets };

    const lock = await readResumeLock(root);
    for (const target of Object.values(targets)) {
      const existing = await fs.readFile(target.file).catch(() => null);
      if (
        existing &&
        !adopt &&
        sha256(existing) !== lock?.outputs[target.asset]?.sha256
      )
        throw new Error(
          `${target.asset} already exists and was not produced by the resume build. Run npm run resume:build -- --adopt to replace it with the generated file, or move it away first.`,
        );
    }

    const rendered = await renderResume(loaded.html);
    const outputs = {
      pdf: rendered.pdf,
      image: await encodePreview(
        rendered.capture,
        path.extname(targets.image.asset).toLowerCase(),
      ),
    };
    const nextLock = resumeLockFor({
      fingerprint: loaded.fingerprint,
      targets,
      outputs,
      generator: { browser: rendered.browser, platform: process.platform },
    });
    await replaceFiles(root, [
      [targets.pdf.file, outputs.pdf],
      [targets.image.file, outputs.image],
      [path.join(root, RESUME_LOCK), `${JSON.stringify(nextLock, null, 2)}\n`],
    ]);
    return { status: "built", targets, outputs, fill: rendered.fill };
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const { status, targets, outputs, fill } = await buildResume(projectRoot, {
    force: process.argv.includes("--force"),
    adopt: process.argv.includes("--adopt"),
  });
  const { preview } = resumeGeometry();
  console.log(
    status === "current"
      ? `Resume is already current: ${targets.pdf.asset} matches ${RESUME_SOURCE}. Pass --force to render it again.`
      : `Resume built: ${targets.pdf.asset} (${Math.round(outputs.pdf.length / 1024)} KB), ${targets.image.asset} (${preview.width}×${preview.height}); page ${Math.round(fill * 100)}% full.`,
  );
}
