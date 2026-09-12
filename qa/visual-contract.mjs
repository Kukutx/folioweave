import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { loadQaProfile } from "./profile.mjs";

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

export async function verifyVisualBaseline({
  report,
  directory,
  browserVersion,
  update,
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
    .filter((file) =>
      /^\d+-(hero|about|work|photography|contact|lightbox(?:-next|-portrait)?)\.png$/.test(
        file,
      ),
    )
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
    await fs.mkdir(baseline, { recursive: true });
    const hashes = {};
    for (const file of files) {
      const bytes = await fs.readFile(path.join(directory, file));
      hashes[file] = createHash("sha256").update(bytes).digest("hex");
      await fs.writeFile(path.join(baseline, file), bytes);
    }
    // Manifest written last; partial updates are rejected by hash verification.
    await fs.writeFile(
      manifest,
      JSON.stringify(
        { ...metadata, files: hashes, geometry: report },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Baseline candidate captured: ${baseline}. Review images and staged diff before accepting.`,
    );
    return;
  }
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
  const diffs = "qa/screens/regression-diffs";
  await fs.mkdir(diffs, { recursive: true });
  for (const file of files) {
    const bytes = await fs.readFile(path.join(baseline, file));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      previous.files[file],
      `baseline damaged: ${file}`,
    );
    const before = PNG.sync.read(bytes),
      after = PNG.sync.read(await fs.readFile(path.join(directory, file)));
    assert.equal(after.width, before.width, file);
    assert.equal(after.height, before.height, file);
    const diff = new PNG({ width: before.width, height: before.height });
    const changed = pixelmatch(
      before.data,
      after.data,
      diff.data,
      before.width,
      before.height,
      { threshold: 0.15 },
    );
    const ratio = changed / (before.width * before.height);
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
    pixels.every((item) => item.ratio <= 0.002),
    `Pixel regression exceeds 0.2%: ${JSON.stringify(pixels.filter((item) => item.ratio > 0.002))}`,
  );
  console.log(
    `Visual regression passed: ${files.length} regions; maximum geometry drift ${maximumGeometry}px`,
  );
}
