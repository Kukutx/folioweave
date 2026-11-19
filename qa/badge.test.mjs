// The work badge plugin: option defaults, settings and the small badge's
// placement. The 3D scene itself is checked in a browser (see docs).
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  COMPACT,
  FOOTPRINT,
  findSpot,
  footprintFor,
} from "../src/plugins/badge/placement.ts";
import {
  badgeSettings,
  cardDefaults,
  showsTrigger,
  themeColors,
} from "../src/plugins/badge/settings.ts";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "src/plugins/badge/manifest.json"), "utf8"),
);
const schema = manifest.optionsSchema.properties;

test("card defaults in code match the manifest's card schema", () => {
  const item = schema.cards.items.properties;
  for (const [key, value] of Object.entries(cardDefaults))
    assert.equal(item[key].default, value, key);
  assert.equal(item.cardColor.default, undefined, "cardColor follows the theme");
});

test("no options give the source's single plain card and every default", () => {
  const settings = badgeSettings({});
  assert.equal(settings.scene.cards.length, 1);
  assert.deepEqual(settings.scene.cards[0], {
    ...cardDefaults,
    cardColor: themeColors.light,
  });
  for (const [key, property] of Object.entries(schema))
    if (!["cards", "trigger", "backdrop", "label", "copy"].includes(key) && "default" in property)
      assert.deepEqual(settings.scene[key], property.default, key);
  assert.equal(settings.trigger.show, "home");
});

test("a card's colour follows its theme unless set", () => {
  const { cards } = badgeSettings({
    cards: [{ theme: "dark" }, { theme: "dark", cardColor: "#203040" }],
  }).scene;
  assert.equal(cards[0].cardColor, themeColors.dark);
  assert.equal(cards[1].cardColor, "#203040");
});

test("authored options win over defaults without leaking between blocks", () => {
  const settings = badgeSettings({
    strapStyle: "single",
    hardware: "ring",
    trigger: { side: "left" },
    backdrop: { opacity: 0.5 },
  });
  assert.equal(settings.scene.strapStyle, "single");
  assert.equal(settings.scene.hardware, "ring");
  assert.equal(settings.trigger.side, "left");
  assert.equal(settings.trigger.show, "home");
  assert.equal(settings.backdrop.opacity, 0.5);
  assert.equal(settings.backdrop.blur, schema.backdrop.properties.blur.default);
  assert.equal("trigger" in settings.scene, false);
});

test("the small badge shows on the pages its option names", () => {
  assert.equal(showsTrigger("home", "/"), true);
  assert.equal(showsTrigger("home", "/blogs"), false);
  assert.equal(showsTrigger("all", "/blogs"), true);
  assert.equal(showsTrigger("none", "/"), false);
});

test("phones use the compact footprint, which fits beside a header pill", () => {
  assert.equal(footprintFor(1440), FOOTPRINT);
  const compact = footprintFor(390);
  assert.ok(compact.half < FOOTPRINT.half);
  assert.equal(compact.half, FOOTPRINT.half * COMPACT.scale);
  // A 390 px phone: a header pill from 80 to 310 px across (with the usual
  // margin) and the hero's photo from 150 px down, as on the classic home.
  const pill = { left: 68, right: 322, top: 8, bottom: 80 };
  const photo = { left: 40, right: 360, top: 150, bottom: 500 };
  const viewport = { width: 390, height: 844 };
  assert.equal(findSpot([pill, photo], viewport, "right", 0, FOOTPRINT), null);
  const spot = findSpot([pill, photo], viewport, "right", 0, compact);
  assert.ok(spot, "the compact badge finds room");
  const centre = viewport.width - spot.inset;
  assert.ok(centre - compact.half >= pill.right, "clear of the pill");
});
