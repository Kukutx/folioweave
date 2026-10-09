import assert from "node:assert/strict";
import test from "node:test";
import { layoutFloating } from "../src/core/floating-layout.ts";

test("a solitary surface keeps its CSS anchor", () => {
  const item = { x: 580, y: 220, width: 408, height: 80 };
  assert.deepEqual(
    layoutFloating([item], { x: 8, y: 8, width: 984, height: 684 }),
    [{ ...item, crowded: false }],
  );
});

test("capsule, chat and home controls fit without overlap across viewport sizes", () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [480, 240],
  ]) {
    for (const position of ["right", "bottom"]) {
      const music = {
        x:
          position === "right"
            ? width - Math.min(408, width - 28) - 14
            : (width - Math.min(408, width - 28)) / 2,
        y: height - 104,
        width: Math.min(408, width - 28),
        height: 80,
        priority: 10,
      };
      const items = [
        { x: width - 70, y: height - 76, width: 56, height: 56, priority: 5 },
        music,
        { x: width - 60, y: height - 60, width: 44, height: 44 },
      ];
      const placed = layoutFloating(items, {
        x: 8,
        y: 8,
        width: width - 16,
        height: height - 16,
      });
      assert.deepEqual(placed[1], {
        x: music.x,
        y: music.y,
        width: music.width,
        height: music.height,
        crowded: false,
      });
      for (const [i, rect] of placed.entries()) {
        assert.equal(rect.crowded, false, `${width}x${height} ${position}`);
        assert.ok(
          rect.x >= 8 &&
            rect.y >= 8 &&
            rect.x + rect.width <= width - 8 &&
            rect.y + rect.height <= height - 8,
        );
        for (const other of placed.slice(i + 1))
          assert.ok(
            rect.x + rect.width + 10 <= other.x ||
              other.x + other.width + 10 <= rect.x ||
              rect.y + rect.height + 10 <= other.y ||
              other.y + other.height + 10 <= rect.y,
          );
      }
    }
  }
});

test("visual viewport offsets are respected and impossible packing is reported", () => {
  const viewport = { x: 80, y: 100, width: 90, height: 90 };
  const results = layoutFloating(
    [
      { x: 0, y: 0, width: 80, height: 80 },
      { x: 0, y: 0, width: 80, height: 80 },
    ],
    viewport,
  );
  assert.deepEqual(results[0], {
    x: 80,
    y: 100,
    width: 80,
    height: 80,
    crowded: false,
  });
  assert.equal(results[1].crowded, true);
});
