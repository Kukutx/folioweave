import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { qaTempRoot } from "./temp-directory.mjs";
import path from "node:path";
import { PNG } from "pngjs";
import {
  baselineProfile,
  compareGeometry,
  reviewedImageDrift,
  updateVisualBaseline,
} from "./visual-contract.mjs";

/** A white 100x100 capture with `changed` leading pixels painted black. */
function capture(changed = 0, size = 100) {
  const image = new PNG({ width: size, height: size });
  image.data.fill(255);
  for (let pixel = 0; pixel < changed; pixel++)
    image.data.fill(0, pixel * 4, pixel * 4 + 3);
  return PNG.sync.write(image);
}

test("a reviewed image is kept only well inside the regression budget", () => {
  const reviewed = capture();
  assert.equal(reviewedImageDrift(reviewed, capture()), 0);
  // The regression budget is 0.2%; an update keeps an image up to half of it,
  // so 10 of 10,000 pixels is kept and 11 is recaptured.
  assert.equal(reviewedImageDrift(reviewed, capture(10)), 0.001);
  assert.equal(reviewedImageDrift(reviewed, capture(11)), null);
  assert.equal(reviewedImageDrift(reviewed, capture(0, 120)), null);
});

test("a baseline update replaces only what changed and reports what it kept", async () => {
  const root = await fs.mkdtemp(path.join(qaTempRoot, "folioweave-visual-"));
  const baseline = path.join(root, "baseline");
  const directory = path.join(root, "capture");
  await fs.mkdir(directory);
  const metadata = { version: 1, browserVersion: "1.0", platform: "test" };
  const captureRegions = async (regions) => {
    await fs.rm(directory, { recursive: true });
    await fs.mkdir(directory);
    for (const [file, bytes] of Object.entries(regions))
      await fs.writeFile(path.join(directory, file), bytes);
    return Object.keys(regions).sort();
  };
  const update = async (regions, options = {}) =>
    updateVisualBaseline({
      baseline,
      directory,
      files: await captureRegions(regions),
      metadata,
      report: [],
      ...options,
    });
  const stored = (file) => fs.readFile(path.join(baseline, file));
  const manifest = async () =>
    JSON.parse(await fs.readFile(path.join(baseline, "manifest.json"), "utf8"));
  try {
    assert.deepEqual(
      await update({
        "390-hero.png": capture(),
        "390-work.png": capture(),
        "390-contact.png": capture(),
      }),
      {
        replaced: ["390-contact.png", "390-hero.png", "390-work.png"],
        drifted: [],
        removed: [],
      },
    );
    const reviewedHashes = (await manifest()).files;

    // Hero was redesigned, work drifted within the margin, contact is no
    // longer captured.
    assert.deepEqual(
      await update({
        "390-hero.png": capture(500),
        "390-work.png": capture(4),
      }),
      {
        replaced: ["390-hero.png"],
        drifted: ["390-work.png 0.040%"],
        removed: ["390-contact.png"],
      },
    );
    assert.ok((await stored("390-hero.png")).equals(capture(500)));
    assert.ok((await stored("390-work.png")).equals(capture()));
    await assert.rejects(stored("390-contact.png"));
    const files = (await manifest()).files;
    assert.deepEqual(Object.keys(files), ["390-hero.png", "390-work.png"]);
    assert.equal(files["390-work.png"], reviewedHashes["390-work.png"]);
    assert.notEqual(files["390-hero.png"], reviewedHashes["390-hero.png"]);

    // A reviewed image edited outside the manifest is never trusted.
    await fs.writeFile(path.join(baseline, "390-work.png"), capture(1));
    assert.deepEqual(
      (
        await update({
          "390-hero.png": capture(500),
          "390-work.png": capture(),
        })
      ).replaced,
      ["390-work.png"],
    );

    // An identical capture is kept, unless everything is explicitly replaced
    // or the images were reviewed in another browser version.
    const same = { "390-hero.png": capture(500), "390-work.png": capture() };
    const everything = ["390-hero.png", "390-work.png"];
    assert.deepEqual((await update(same)).replaced, []);
    assert.deepEqual(
      (await update(same, { replaceAll: true })).replaced,
      everything,
    );
    assert.deepEqual((await update(same)).replaced, []);
    assert.deepEqual(
      (
        await updateVisualBaseline({
          baseline,
          directory,
          files: await captureRegions(same),
          metadata: { ...metadata, browserVersion: "2.0" },
          report: [],
        })
      ).replaced,
      everything,
    );
  } finally {
    await fs.rm(root, { recursive: true });
  }
});

test("only the canonical demo profile can own shared visual baselines", () => {
  const demo = { name: "Demo", features: { demoRoutes: true } };
  assert.equal(baselineProfile(structuredClone(demo), demo), "demo");
  assert.equal(
    baselineProfile({ ...demo, name: "Personal" }, demo),
    "personal",
  );
  assert.equal(
    baselineProfile({ ...demo, features: { demoRoutes: false } }, demo),
    "personal",
  );
});

const snapshot = () => [
  {
    width: 390,
    geometry: {
      sections: { home: { x: 0, y: 0, width: 390, height: 900 } },
      work: [],
      photos: [],
    },
  },
];
test("geometry contract detects movement, missing regions, and missing viewports", () => {
  const before = snapshot();
  assert.deepEqual(compareGeometry(before, snapshot()), []);
  const moved = snapshot();
  moved[0].geometry.sections.home.x = 2;
  assert.equal(compareGeometry(before, moved)[0].delta, 2);
  assert.throws(() => compareGeometry(before, []), /viewport coverage/);
  const missing = snapshot();
  delete missing[0].geometry.sections.home;
  assert.throws(() => compareGeometry(before, missing), /structure changed/);
  const invalid = snapshot();
  invalid[0].geometry.sections.home.width = NaN;
  assert.throws(() => compareGeometry(before, invalid), /invalid geometry/);
});
