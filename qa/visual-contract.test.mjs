import test from "node:test";
import assert from "node:assert/strict";
import { baselineProfile, compareGeometry } from "./visual-contract.mjs";

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
