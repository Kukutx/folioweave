// Pond: its settings, how a profile becomes the pond's text and pages, and the koi and scenes the server and the
// canvas both draw from.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_LABELS,
  defaultScheme,
  introduction,
  koiSeeds,
  pondLabels,
  pondNav,
} from "../src/templates/pond/data.ts";
import {
  HALF,
  LEN,
  ORDER,
  SEGMENTS,
  SvgPath,
  VIEW,
  WAVE,
  body,
  fins,
  frame,
  hashSeed,
  markings,
  newFrame,
  restSpine,
  swimSpine,
  tail,
  tailSway,
} from "../src/templates/pond/water/koi.ts";
import { SCENES } from "../src/templates/pond/water/scenes.ts";

const manifest = JSON.parse(
  readFileSync(
    new URL("../src/templates/pond/manifest.json", import.meta.url),
    "utf8",
  ),
);
const options = manifest.optionsSchema.properties;

const context = (over = {}) => ({
  site: {
    identity: {
      name: "Ada Example",
      firstName: "Ada",
      role: "Designer",
      company: "Example Studio",
      locale: "en-US",
    },
    socialLinks: [
      { label: "Mastodon", href: "https://example.com/@ada" },
      { label: "Email", href: "mailto:ada@example.com" },
      { label: "Empty", href: " " },
    ],
  },
  introduction: {
    greetings: ["Hello"],
    roleLine: [],
    summary: [
      { text: "Makes things with " },
      { brand: { name: "Lamp", project: "lamp" } },
    ],
  },
  projects: [
    { id: "lamp", enabled: true, name: "Lamp" },
    { id: "hidden", enabled: false, name: "Hidden" },
  ],
  photography: { images: [{ src: "/portfolio/a.webp", alt: "A" }] },
  writing: { title: "Notes" },
  features: { work: true, photography: true },
  capabilities: { writing: true },
  options: {},
  ...over,
});

test("every setting Pond 1 accepted is still accepted", () => {
  for (const key of ["motto", "projectsPath", "galleryPath", "labels"])
    assert.ok(options[key], key);
  const labels = options.labels.properties;
  for (const key of [
    "home",
    "projects",
    "gallery",
    "blog",
    "light",
    "dark",
    "greeting",
    "pond",
    "minutes",
    "allTopics",
    "back",
    "notFound",
  ])
    assert.ok(labels[key], `labels.${key}`);
});

test("the manifest's label defaults are the ones the template uses", () => {
  for (const [key, schema] of Object.entries(options.labels.properties)) {
    if (key === "blog")
      assert.equal(
        schema.default,
        undefined,
        "the blog label defaults to the profile's title",
      );
    else assert.equal(schema.default, DEFAULT_LABELS[key], key);
  }
  for (const key of Object.keys(DEFAULT_LABELS))
    assert.ok(options.labels.properties[key], `${key} is in the manifest`);
});

test("labels: the author's win, the blog's falls back to the profile", () => {
  assert.equal(pondLabels(context()).blog, "Notes");
  assert.equal(pondLabels(context()).projects, "Work");
  const own = pondLabels(
    context({ options: { labels: { blog: "Journal", light: "Giorno" } } }),
  );
  assert.equal(own.blog, "Journal");
  assert.equal(own.light, "Giorno");
});

test("the time of day maps to the scheme the page opens in", () => {
  assert.equal(defaultScheme(context()), "system");
  assert.equal(defaultScheme(context({ options: { time: "day" } })), "light");
  assert.equal(defaultScheme(context({ options: { time: "night" } })), "dark");
});

test("the introduction comes from the profile", () => {
  const intro = introduction(context());
  assert.equal(intro.greeting, "Hello, I'm Ada.");
  assert.deepEqual(intro.role, ["Designer, Example Studio"]);
  assert.deepEqual(intro.summary, [
    "Makes things with ",
    { text: "Lamp", href: "/projects#lamp" },
  ]);
  assert.deepEqual(
    intro.links.map((link) => [link.text, link.external]),
    [
      ["Mastodon", true],
      ["Email", false],
    ],
  );
  assert.equal(
    introduction(
      context({ introduction: { greetings: [], roleLine: [], summary: [] } }),
    ).greeting,
    "I'm Ada.",
  );
});

test("the navigation lists only pages with something behind them, at the author's addresses", () => {
  const keys = (c) => pondNav(c).map((item) => `${item.key}:${item.href}`);
  assert.deepEqual(keys(context()), [
    "projects:/projects",
    "gallery:/gallery",
    "blog:/blogs",
  ]);
  assert.deepEqual(
    keys(context({ options: { projectsPath: "lavori", galleryPath: "foto" } })),
    ["projects:/lavori", "gallery:/foto", "blog:/blogs"],
  );
  assert.deepEqual(
    keys(
      context({
        features: { work: false, photography: false },
        capabilities: { writing: false },
      }),
    ),
    [],
  );
});

test("the koi of the pond are the published projects', in order", () => {
  assert.deepEqual(koiSeeds(context()), ["lamp"]);
});

test("a seed always grows the same koi, and the n-th koi has the n-th variety", () => {
  const seed = hashSeed("lamp");
  assert.equal(seed, hashSeed("lamp"));
  assert.deepEqual(markings(seed, "kohaku"), markings(seed, "kohaku"));
  assert.equal(new Set(ORDER).size, 8);
  for (const variety of ORDER) {
    const look = markings(seed, variety);
    assert.equal(look.variety, variety);
    for (const patch of look.patches)
      assert.ok(
        patch.u >= -0.1 && patch.u <= 1.1,
        `${variety} patch along the body`,
      );
  }
});

test("every koi the pages place is drawn with finite, bounded geometry in any pose of its stroke", () => {
  // the bends the scenes use, and the bowls' on the projects page; the drawing may reach past its nominal box (the
  // SVG does not clip it, and the canvas maps it the same way), but never runs away from the fish
  const bends = [
    ...new Set([
      ...Object.values(SCENES).flatMap((scene) => scene.koi.map((k) => k.bend)),
      0.19,
    ]),
  ];
  for (const bend of bends) {
    for (let phase = 0; phase < Math.PI * 2; phase += 0.5) {
      const f = frame(
        swimSpine(
          restSpine(bend),
          phase,
          WAVE,
          1,
          new Float64Array(SEGMENTS * 2),
        ),
        1,
        newFrame(),
      );
      const path = new SvgPath();
      body(f, path);
      tail(f, tailSway(phase, WAVE), path);
      fins(f, 1, path);
      const numbers = path
        .toString()
        .match(/-?\d+(\.\d+)?/g)
        .map(Number);
      assert.ok(numbers.length > 100);
      for (const n of numbers)
        assert.ok(
          Number.isFinite(n) && Math.abs(n) < LEN * 1.1,
          `${n} with bend ${bend}`,
        );
    }
  }
  assert.ok(HALF < LEN / 4);
  assert.equal(
    VIEW[2] / VIEW[3],
    3 / 2,
    "the box keeps the 3:2 the still lays koi out in",
  );
});

test("every scene has koi and pads on wide and on narrow ponds, placed on the pond", () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    for (const only of ["wide", "narrow"]) {
      const koi = scene.koi.filter((k) => !k.only || k.only === only);
      assert.ok(koi.length > 0, `${name} has koi when ${only}`);
    }
    for (const item of [...scene.koi, ...scene.pads, scene.moon]) {
      for (const v of [item.x, item.y, item.px ?? item.x, item.py ?? item.y])
        assert.ok(v >= -5 && v <= 105, `${name}: ${v}`);
    }
    for (const k of scene.koi)
      assert.ok(k.depth >= 0 && k.depth <= 1 && k.size > 0, name);
  }
});
