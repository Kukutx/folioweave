import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCatalog,
  resolveExtensions,
  extensionSources,
  extensionOutputs,
} from "../src/core/extensions.mjs";

const catalog = loadCatalog();
const track = { id: "one", title: "One", src: "/portfolio/audio/one.mp3" };
const config = (options) => ({
  template: { id: "classic" },
  plugins: { music: { enabled: true, options } },
});
const resolve = (options) => resolveExtensions(config(options), catalog);

test("music skins, placement and notes are validated independently", () => {
  for (const skin of ["capsule", "square"])
    for (const position of ["right", "bottom"]) {
      const options = {
        tracks: [track],
        skin,
        position,
        notes: { enabled: true, colors: ["#cf8750", "#ac719b", "#528ba6"] },
      };
      assert.deepEqual(resolve(options).plugins[0].options, options);
    }
  for (const extra of [
    { skin: "unknown" },
    { position: "center" },
    { volume: 2 },
    { accent: "red" },
    { notes: { colors: ["#cf8750"] } },
    { notes: { enabled: "yes" } },
    { autoplay: "always" },
    { shuffle: true },
  ])
    assert.throws(() => resolve({ tracks: [track], ...extra }), /options/);
  // Starting on arrival is the author's explicit choice, never a default.
  const arrival = { tracks: [track], autoplay: true };
  assert.deepEqual(resolve(arrival).plugins[0].options, arrival);
});

test("duplicate track identities and unsafe audio or artwork fail before publication", () => {
  assert.throws(
    () => resolve({ tracks: [track, { ...track, title: "Different" }] }),
    /uniqueBy/,
  );
  assert.throws(() => resolve({ tracks: [] }), /options/);
  for (const src of [
    "http://audio.example/file.mp3",
    "https://user:pass@audio.example/file.mp3",
    "//audio.example/file.mp3",
    "javascript:alert(1)",
    "data:audio/mp3;base64,AAAA",
    "/portfolio/../secret.mp3",
    "https://audio.example/\nfile.mp3",
    "https://audio.example\\file.mp3",
  ])
    assert.throws(() => resolve({ tracks: [{ ...track, src }] }), /options/);
  assert.throws(
    () =>
      resolve({ tracks: [{ ...track, cover: "/portfolio/../private.png" }] }),
    /options/,
  );
});

test("only enabled audio and artwork origins enter their own CSP directives", () => {
  const options = {
    tracks: [
      {
        ...track,
        src: "https://audio.example/a.mp3?token=public",
        cover: "https://covers.example/a.png",
      },
      {
        id: "two",
        title: "Two",
        src: "https://audio.example/b.mp3",
        cover: "/portfolio/covers/local.webp",
      },
    ],
  };
  const active = config(options);
  assert.deepEqual(extensionSources(active, catalog), {
    "media-src": ["https://audio.example"],
    "img-src": ["https://covers.example"],
  });
  active.plugins.music.enabled = false;
  assert.deepEqual(extensionSources(active, catalog), {});
  const generated = extensionOutputs(resolveExtensions(active, catalog))
    .map((output) => output.contents)
    .join("\n");
  assert.doesNotMatch(
    generated,
    /audio\.example|covers\.example|plugins\/music/,
  );
});

test("network option declarations cannot grant dynamic executable script origins", () => {
  const plugin = catalog.plugins.find((item) => item.id === "music");
  const badCatalog = {
    ...catalog,
    plugins: [
      { ...plugin, networkOptions: { "script-src": ["tracks.*.src"] } },
    ],
  };
  assert.throws(
    () => resolveExtensions(config({ tracks: [track] }), badCatalog),
    /networkOptions/,
  );
});
