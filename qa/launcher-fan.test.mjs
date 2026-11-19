import assert from "node:assert/strict";
import test from "node:test";
import { layoutFan, ringCapacity } from "../src/plugins/launcher/fan.ts";

const sizes = { item: 48, spacing: 60, radius: 92, ringGap: 64 };
const viewport = { width: 1280, height: 720 };

test("the fan opens away from the nearer edges", () => {
  const cases = [
    [{ x: 1220, y: 620 }, -1, -1],
    [{ x: 60, y: 620 }, 1, -1],
    [{ x: 1220, y: 80 }, -1, 1],
    [{ x: 60, y: 80 }, 1, 1],
  ];
  for (const [center, horizontal, vertical] of cases) {
    const fan = layoutFan(3, { center, viewport, ...sizes });
    assert.equal(fan.horizontal, horizontal);
    assert.equal(fan.vertical, vertical);
    for (const point of fan.points) {
      assert.ok(point.x * horizontal >= 0 && point.y * vertical >= 0);
    }
  }
});

test("one item sits on the diagonal; several span the quarter circle", () => {
  const center = { x: 1220, y: 620 };
  const [only] = layoutFan(1, { center, viewport, ...sizes }).points;
  assert.ok(Math.abs(Math.abs(only.x) - Math.abs(only.y)) < 0.01);
  assert.ok(Math.abs(Math.hypot(only.x, only.y) - 92) < 0.01);
  const points = layoutFan(3, { center, viewport, ...sizes }).points;
  assert.deepEqual(points[0], { x: 0, y: -92, ring: 0 });
  assert.deepEqual(points[2], { x: -92, y: 0, ring: 0 });
});

test("neighbours keep their spacing and overflow moves to an outer ring", () => {
  const center = { x: 1220, y: 620 };
  const capacity = ringCapacity(92, 60);
  const points = layoutFan(capacity + 2, { center, viewport, ...sizes }).points;
  assert.equal(points.filter((point) => point.ring === 0).length, capacity);
  assert.equal(points.filter((point) => point.ring === 1).length, 2);
  for (const ring of [0, 1]) {
    const on = points.filter((point) => point.ring === ring);
    for (let i = 1; i < on.length; i++)
      assert.ok(
        Math.hypot(on[i].x - on[i - 1].x, on[i].y - on[i - 1].y) >= 59.9,
      );
  }
});

test("a fan near a small viewport stays inside it", () => {
  const small = { width: 320, height: 240 };
  const center = { x: 280, y: 200 };
  const fan = layoutFan(6, { center, viewport: small, ...sizes });
  for (const point of fan.points) {
    assert.ok(center.x + point.x - 24 >= 0);
    assert.ok(center.y + point.y - 24 >= 0);
  }
});
