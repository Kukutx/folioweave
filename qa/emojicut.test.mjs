import assert from "node:assert/strict";
import test from "node:test";
import {
  drain,
  extractSticker,
  findStickers,
  mergeRects,
  outlineCoverage,
  readingOrder,
  RULES,
} from "../src/plugins/emojicut/cut/segment.ts";
import { crc32, createZip } from "../src/plugins/emojicut/lib/zip.ts";
import { safeFileName, uniqueFileNames } from "../src/plugins/emojicut/lib/files.ts";
import { copies } from "../src/plugins/emojicut/copy.ts";

/** A white sheet to paint shapes on. */
function sheet(width, height) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const paint = (x, y, rgba) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    data.set(rgba, (y * width + x) * 4);
  };
  return {
    pixels: { width, height, data },
    rect(x0, y0, w, h, rgba = [200, 30, 30, 255]) {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) paint(x, y, rgba);
    },
    disc(cx, cy, r, rgba = [30, 120, 200, 255]) {
      for (let y = cy - r; y <= cy + r; y++)
        for (let x = cx - r; x <= cx + r; x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) paint(x, y, rgba);
    },
  };
}

const at = ({ pixels }, x, y) => Array.from(pixels.data.subarray((y * pixels.width + x) * 4, (y * pixels.width + x) * 4 + 4));
const cut = (s) => drain(findStickers(s.pixels)).map((rect) => extractSticker(s.pixels, rect));

test("separated shapes become one sticker each, in reading order", () => {
  const s = sheet(400, 260);
  s.rect(20, 20, 60, 60);
  s.disc(200, 50, 30);
  s.rect(300, 30, 70, 40, [20, 160, 60, 255]);
  s.disc(60, 190, 35, [240, 160, 20, 255]);
  s.rect(170, 160, 50, 70, [90, 40, 150, 255]);
  const rects = drain(findStickers(s.pixels));
  assert.equal(rects.length, 5);
  // Rows top to bottom, left to right within a row.
  assert.deepEqual(
    rects.map((r) => [r.minX, r.minY]),
    [[20, 20], [170, 20], [300, 30], [25, 155], [170, 160]],
  );
});

test("a sticker is transparent outside, outlined in white and keeps its colours", () => {
  const s = sheet(200, 200);
  s.rect(50, 50, 80, 60);
  const [sticker] = cut(s);
  const { padding, outline } = RULES;
  assert.equal(sticker.x, 50 - padding);
  assert.equal(sticker.y, 50 - padding);
  // Box 80x60 (max - min = 79 x 59) + padding*2, + outline on each side.
  assert.equal(sticker.pixels.width, 79 + padding * 2 + outline * 2);
  assert.equal(sticker.pixels.height, 59 + padding * 2 + outline * 2);
  const left = outline + padding; // first ink column in the sticker
  const top = outline + padding;
  assert.deepEqual(at(sticker, 0, 0), [0, 0, 0, 0], "corner is transparent");
  assert.deepEqual(at(sticker, left + 10, top + 10), [200, 30, 30, 255], "ink kept");
  assert.deepEqual(at(sticker, left - 3, top + 20), [255, 255, 255, 255], "outline 3px out");
  assert.deepEqual(at(sticker, left - 1, top + 20), [255, 255, 255, 255], "paper next to ink is outline");
  const edge = at(sticker, left - outline - 1, top + 20);
  assert.ok(edge[3] < 128, `outline fades by ${outline + 1}px (alpha ${edge[3]})`);
});

test("a hole inside a sticker stays filled; paper outside does not", () => {
  const s = sheet(160, 160);
  s.disc(80, 80, 50, [30, 120, 200, 255]);
  s.disc(80, 80, 20, [255, 255, 255, 255]); // white hole
  const [ring] = cut(s);
  const cx = 80 - ring.x;
  const cy = 80 - ring.y;
  assert.deepEqual(at(ring, cx, cy), [255, 255, 255, 255], "hole is opaque white");
  assert.deepEqual(at(ring, cx + 35, cy), [30, 120, 200, 255]);
  // Diagonal corner of the box: paper outside the disc and its outline.
  assert.equal(at(ring, 2, 2)[3], 0);
});

test("the outline is the anti-aliased disc dilation of the sticker", () => {
  const W = 48;
  const H = 40;
  const R = RULES.outline;
  const seeds = new Uint8Array(W * H);
  let random = 7;
  const next = () => (random = (random * 48271) % 2147483647) / 2147483647;
  for (let y = R + 4; y < H - R - 4; y++)
    for (let x = R + 4; x < W - R - 4; x++) if (next() < 0.08 || (x > 20 && x < 30 && y > 15 && y < 25)) seeds[y * W + x] = 1;
  const cover = outlineCoverage(seeds, W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let best = Infinity;
      for (let j = 0; j < seeds.length; j++)
        if (seeds[j]) best = Math.min(best, Math.hypot((j % W) - x, Math.floor(j / W) - y));
      const ideal = Math.round(Math.max(0, Math.min(1, R + 0.5 - best)) * 255);
      assert.equal(cover[y * W + x], ideal, `pixel ${x},${y}`);
    }
});

test("touching or near shapes are one sticker, distant ones are two", () => {
  const touching = sheet(240, 120);
  touching.rect(20, 20, 50, 50);
  touching.rect(70, 30, 50, 50, [20, 160, 60, 255]);
  assert.equal(drain(findStickers(touching.pixels)).length, 1);

  const near = sheet(240, 120);
  near.rect(20, 20, 50, 50);
  near.rect(20 + 50 + 10, 20, 50, 50); // a 10px gap, under the 15px rule
  assert.equal(drain(findStickers(near.pixels)).length, 1);

  const apart = sheet(240, 120);
  apart.rect(20, 20, 50, 50);
  apart.rect(20 + 50 + 30, 20, 50, 50);
  assert.equal(drain(findStickers(apart.pixels)).length, 2);
});

test("specks and transparent pixels are not stickers", () => {
  const s = sheet(120, 120);
  s.rect(10, 10, 6, 6); // 36 pixels, under the 50-pixel minimum
  s.rect(60, 60, 40, 40, [0, 0, 0, 10]); // nearly transparent
  s.rect(60, 10, 40, 2); // a hairline: too thin
  assert.equal(drain(findStickers(s.pixels)).length, 0);
});

test("findStickers yields progress between 0 and 1", () => {
  const s = sheet(1200, 900);
  s.rect(100, 100, 900, 600);
  const steps = [];
  const work = findStickers(s.pixels);
  for (let step = work.next(); !step.done; step = work.next()) steps.push(step.value);
  assert.ok(steps.length > 2);
  assert.ok(steps.every((v, i) => v >= 0 && v <= 1 && (i === 0 || v >= steps[i - 1])));
});

test("rectangle merging reaches the same fixed point in any order", () => {
  const a = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
  const b = { minX: 20, maxX: 30, minY: 0, maxY: 10 }; // 10px from a
  const c = { minX: 0, maxX: 10, minY: 22, maxY: 40 }; // 12px below a
  const d = { minX: 200, maxX: 210, minY: 200, maxY: 210 }; // far away
  const expected = [{ minX: 0, maxX: 30, minY: 0, maxY: 40 }, d];
  assert.deepEqual(mergeRects([a, b, c, d]), expected);
  assert.deepEqual(readingOrder(mergeRects([d, c, b, a])), expected);
  // Growing a box can bring it near a box that was far from each member.
  const e = { minX: 40, maxX: 50, minY: 0, maxY: 2 };
  const f = { minX: 52, maxX: 60, minY: 52, maxY: 60 };
  const g = { minX: 40, maxX: 50, minY: 40, maxY: 45 };
  assert.equal(mergeRects([e, f, g], 15).length, 2);
  assert.equal(mergeRects([e, f, g, { minX: 40, maxX: 50, minY: 10, maxY: 30 }], 15).length, 1);
  // Inputs are not mutated.
  assert.deepEqual(a, { minX: 0, maxX: 10, minY: 0, maxY: 10 });
});

test("CRC-32 matches known values", () => {
  const ascii = (text) => new TextEncoder().encode(text);
  assert.equal(crc32(ascii("123456789")), 0xcbf43926);
  assert.equal(crc32(ascii("hello")), 0x3610a686);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("the ZIP writer produces stored entries with UTF-8 names and a central directory", async () => {
  const encoder = new TextEncoder();
  const files = [
    { name: "hello.txt", data: encoder.encode("hello") },
    { name: "贴纸_1.png", data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) },
  ];
  const date = new Date(2026, 10, 12, 18, 30, 44);
  const zip = new Uint8Array(await createZip(files, date).arrayBuffer());
  const view = new DataView(zip.buffer);
  const decoder = new TextDecoder();

  // End of central directory.
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 8, true), 2);
  assert.equal(view.getUint16(end + 10, true), 2);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  assert.equal(centralOffset + centralSize, end);

  let central = centralOffset;
  for (const file of files) {
    const name = encoder.encode(file.name);
    assert.equal(view.getUint32(central, true), 0x02014b50);
    assert.equal(view.getUint16(central + 8, true) & 0x0800, 0x0800, "UTF-8 flag");
    assert.equal(view.getUint16(central + 10, true), 0, "stored");
    assert.equal(view.getUint32(central + 16, true), crc32(file.data));
    assert.equal(view.getUint32(central + 20, true), file.data.length);
    assert.equal(view.getUint16(central + 28, true), name.length);
    assert.equal(decoder.decode(zip.subarray(central + 46, central + 46 + name.length)), file.name);
    const local = view.getUint32(central + 42, true);

    assert.equal(view.getUint32(local, true), 0x04034b50);
    assert.equal(view.getUint16(local + 6, true), 0x0800);
    assert.equal(view.getUint16(local + 8, true), 0);
    assert.equal(view.getUint32(local + 14, true), crc32(file.data));
    assert.equal(view.getUint32(local + 18, true), file.data.length);
    assert.equal(view.getUint32(local + 22, true), file.data.length);
    assert.equal(view.getUint16(local + 26, true), name.length);
    const body = local + 30 + name.length;
    assert.equal(decoder.decode(zip.subarray(local + 30, body)), file.name);
    assert.deepEqual(zip.subarray(body, body + file.data.length), file.data);
    // DOS time: 18:30:44 on 2026-11-12.
    assert.equal(view.getUint16(local + 10, true), (18 << 11) | (30 << 5) | 22);
    assert.equal(view.getUint16(local + 12, true), ((2026 - 1980) << 9) | (11 << 5) | 12);
    central += 46 + name.length;
  }
  assert.equal(central, end);
});

test("file names are safe and distinct", () => {
  assert.equal(safeFileName('a/b\\c:d*e?"f<g>h|'), "a_b_c_d_e__f_g_h_");
  assert.equal(safeFileName("..."), "sticker");
  assert.deepEqual(uniqueFileNames(["happy", "Happy", "happy", "x/y"], ".png"), [
    "happy.png",
    "Happy_1.png",
    "happy_2.png",
    "x_y.png",
  ]);
});

test("Chinese and English copy have the same keys and kinds", () => {
  const shape = (value) =>
    typeof value === "function"
      ? "function"
      : Array.isArray(value)
        ? "array"
        : value && typeof value === "object"
          ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]))
          : typeof value;
  assert.deepEqual(shape(copies.zh), shape(copies.en));
  for (const lang of ["zh", "en"]) {
    const text = JSON.stringify(copies[lang]);
    assert.doesNotMatch(text, /[✨\u{1F511}\u{1F5B1}\u{1F4A1}]/u, `${lang} copy has no emoji`);
    assert.doesNotMatch(text, /NANO BANANA/i);
  }
});
