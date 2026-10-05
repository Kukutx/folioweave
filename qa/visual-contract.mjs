import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { loadQaProfile } from "./profile.mjs";

const PIXEL_THRESHOLD = 0.15;
const PIXEL_BUDGET = 0.002;
// An update keeps a reviewed image only while the new capture uses at most
// half the regression budget, so a kept region still has headroom in CI.
const RETENTION_BUDGET = PIXEL_BUDGET / 2;
const REGION_FILE =
  /^\d+-(hero|about|work|photography|contact|lightbox(?:-next|-portrait)?)\.png$/;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const percent = (ratio) => `${(ratio * 100).toFixed(3)}%`;

/** Changed pixels between two decoded PNGs, or null when their sizes differ. */
function pixelDelta(before, after, diff) {
  if (after.width !== before.width || after.height !== before.height)
    return null;
  const changed = pixelmatch(
    before.data,
    after.data,
    diff?.data ?? null,
    before.width,
    before.height,
    { threshold: PIXEL_THRESHOLD },
  );
  return { changed, ratio: changed / (before.width * before.height) };
}

/**
 * How far a new capture is from the reviewed image it would replace, as a
 * share of changed pixels, or null when it has to be replaced. A capture well
 * inside the pixel budget is host or encoder drift rather than a redesign:
 * keeping the reviewed image makes an update touch only what actually changed.
 */
export function reviewedImageDrift(reviewed, candidate) {
  const delta = pixelDelta(PNG.sync.read(reviewed), PNG.sync.read(candidate));
  return delta !== null && delta.ratio <= RETENTION_BUDGET ? delta.ratio : null;
}

export function baselineProfile(profile, demo) {
  // Feature flags control publication, never ownership of personal artwork.
  return isDeepStrictEqual(profile, demo) ? "demo" : "personal";
}

export function compareGeometry(previous, current) {
  assert.deepEqual(
    current.map((item) => item.width),
    previous.map((item) => item.width),
    "viewport coverage changed",
  );
  const deltas = [];
  const boxes = ({ geometry }) => ({
    ...geometry.sections,
    ...Object.fromEntries(geometry.work.map((box, i) => [`work-${i}`, box])),
    ...Object.fromEntries(geometry.photos.map((box, i) => [`photo-${i}`, box])),
  });
  for (let i = 0; i < current.length; i++) {
    const before = boxes(previous[i]),
      after = boxes(current[i]);
    assert.deepEqual(
      Object.keys(after),
      Object.keys(before),
      "content structure changed; review baseline",
    );
    for (const [name, box] of Object.entries(after))
      for (const dimension of ["x", "y", "width", "height"]) {
        const delta = Math.abs(box[dimension] - before[name][dimension]);
        assert.ok(
          Number.isFinite(delta),
          `invalid geometry: ${name}.${dimension}`,
        );
        if (delta)
          deltas.push({ viewport: current[i].width, name, dimension, delta });
      }
  }
  return deltas;
}

/**
 * Replaces the regions whose capture left the retention margin, keeps the
 * reviewed image for the rest, and drops images of regions that are no longer
 * captured. Geometry always comes from the new capture.
 */
export async function updateVisualBaseline({
  baseline,
  directory,
  files,
  metadata,
  report,
  replaceAll = false,
}) {
  await fs.mkdir(baseline, { recursive: true });
  const manifest = path.join(baseline, "manifest.json");
  const reviewed = replaceAll
    ? null
    : await fs.readFile(manifest, "utf8").then(JSON.parse, () => null);
  // Images reviewed in another browser version cannot be compared by pixel.
  const comparable = reviewed?.browserVersion === metadata.browserVersion;
  const hashes = {};
  const replaced = [];
  const drifted = [];
  for (const file of files) {
    const bytes = await fs.readFile(path.join(directory, file));
    const current = comparable
      ? await fs.readFile(path.join(baseline, file)).catch(() => null)
      : null;
    const drift =
      current && sha256(current) === reviewed.files?.[file]
        ? reviewedImageDrift(current, bytes)
        : null;
    if (drift === null) {
      hashes[file] = sha256(bytes);
      await fs.writeFile(path.join(baseline, file), bytes);
      replaced.push(file);
      continue;
    }
    hashes[file] = reviewed.files[file];
    if (drift > 0) drifted.push(`${file} ${percent(drift)}`);
  }
  const removed = [];
  for (const file of await fs.readdir(baseline))
    if (REGION_FILE.test(file) && !files.includes(file)) {
      await fs.rm(path.join(baseline, file));
      removed.push(file);
    }
  // Manifest written last; partial updates are rejected by hash verification.
  await fs.writeFile(
    manifest,
    JSON.stringify({ ...metadata, files: hashes, geometry: report }, null, 2) +
      "\n",
  );
  return { replaced, drifted, removed };
}

export async function verifyVisualBaseline({
  report,
  directory,
  browserVersion,
  update,
  replaceAll = false,
}) {
  assert.ok(
    !update || !process.env.CI,
    "CI must never update visual baselines",
  );
  const profile = loadQaProfile();
  const policy = JSON.parse(
    await fs.readFile(
      new URL("../governance/branch-policy.json", import.meta.url),
      "utf8",
    ),
  );
  const demo = JSON.parse(
    await fs.readFile(
      new URL(`../${policy.demoProfile}`, import.meta.url),
      "utf8",
    ),
  );
  const profileName = baselineProfile(profile, demo);
  const baseline = path.join("qa/baselines", profileName, process.platform);
  const files = (await fs.readdir(directory))
    .filter((file) => REGION_FILE.test(file))
    .sort();
  assert.ok(files.length > 0, "No key-region screenshots captured");
  const metadata = {
    version: 1,
    browserVersion,
    platform: process.platform,
    profileName,
  };
  const manifest = path.join(baseline, "manifest.json");
  if (update) {
    const { replaced, drifted, removed } = await updateVisualBaseline({
      baseline,
      directory,
      files,
      metadata,
      report,
      replaceAll,
    });
    console.log(
      [
        `Baseline candidate captured: ${baseline}.`,
        `Replaced ${replaced.length} of ${files.length} regions${replaced.length ? `: ${replaced.join(", ")}` : ""}.`,
        drifted.length
          ? `Kept reviewed images that differ within the retention margin (${percent(RETENTION_BUDGET)}): ${drifted.join(", ")}. Delete a region's image to recapture it.`
          : "",
        removed.length
          ? `Removed images of regions no longer captured: ${removed.join(", ")}.`
          : "",
        "Review the replaced images and the staged diff before accepting.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return;
  }
  const diffs = "qa/screens/regression-diffs";
  await fs.rm(diffs, { recursive: true, force: true });

  const previous = JSON.parse(
    await fs.readFile(manifest, "utf8").catch(() => {
      throw new Error(
        `Missing reviewed baseline: ${manifest}. Run qa:visual-baseline on the canonical platform; never auto-accept in CI.`,
      );
    }),
  );
  for (const [key, value] of Object.entries(metadata))
    assert.equal(previous[key], value, `visual environment changed: ${key}`);
  assert.deepEqual(
    files,
    Object.keys(previous.files).sort(),
    "screenshot coverage changed",
  );
  const deltas = compareGeometry(previous.geometry, report);
  const pixels = [];
  await fs.mkdir(diffs, { recursive: true });
  for (const file of files) {
    const bytes = await fs.readFile(path.join(baseline, file));
    assert.equal(
      sha256(bytes),
      previous.files[file],
      `baseline damaged: ${file}`,
    );
    const before = PNG.sync.read(bytes),
      after = PNG.sync.read(await fs.readFile(path.join(directory, file)));
    const diff = new PNG({ width: before.width, height: before.height });
    const delta = pixelDelta(before, after, diff);
    assert.ok(delta, `screenshot size changed: ${file}`);
    const { changed, ratio } = delta;
    pixels.push({ file, ratio, changed });
    if (changed)
      await fs.writeFile(path.join(diffs, file), PNG.sync.write(diff));
  }
  const maximumGeometry = Math.max(0, ...deltas.map((item) => item.delta));
  await fs.writeFile(
    "qa/visual-regression-report.json",
    JSON.stringify({ ...metadata, maximumGeometry, deltas, pixels }, null, 2),
  );
  assert.ok(
    maximumGeometry <= 1,
    `Geometry drift: ${maximumGeometry}px (limit 1px)`,
  );
  assert.ok(
    pixels.every((item) => item.ratio <= PIXEL_BUDGET),
    `Pixel regression exceeds 0.2%: ${JSON.stringify(pixels.filter((item) => item.ratio > PIXEL_BUDGET))}`,
  );
  await fs.rm(diffs, { recursive: true, force: true });
  console.log(
    `Visual regression passed: ${files.length} regions; maximum geometry drift ${maximumGeometry}px`,
  );
}
