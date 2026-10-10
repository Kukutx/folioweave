import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  embeddedArtwork,
  withEmbeddedArtwork,
} from "../src/core/audio-artwork.mjs";
import { prepareContent, generatedOutputs } from "../scripts/content-build.mjs";
import { collectAssets } from "../src/portfolio/content-policy.mjs";
import { seedProjectDefinitions } from "./project-fixture.mjs";
import { qaTempRoot } from "./temp-directory.mjs";

const root = path.resolve(import.meta.dirname, "..");
const image = (format, background) =>
  sharp({
    create: { width: 48, height: 32, channels: 3, background },
  })
    [format]()
    .toBuffer();
const png = await image("png", "#3355aa");
const jpeg = await image("jpeg", "#aa5533");
const other = await image("png", "#22aa44");

const bytes = (...values) => Buffer.from(values);
const u32 = (value) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
};
const syncsafe = (value) =>
  bytes(
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  );
/** What follows a tag in a real file: the start of an MPEG audio frame. */
const audio = bytes(0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0);
const unsynchronised = (data) =>
  Buffer.from(
    [...data].flatMap((value) => (value === 0xff ? [0xff, 0] : value)),
  );

function id3(major, frames, { flags = 0, plainSizes = false } = {}) {
  let body = Buffer.concat(
    frames.map(([id, data, format = 0]) =>
      major === 2
        ? Buffer.concat([
            Buffer.from(id),
            bytes(
              data.length >> 16,
              (data.length >> 8) & 255,
              data.length & 255,
            ),
            data,
          ])
        : Buffer.concat([
            Buffer.from(id),
            major === 4 && !plainSizes
              ? syncsafe(data.length)
              : u32(data.length),
            bytes(0, format),
            data,
          ]),
    ),
  );
  if (flags & 0x80 && major < 4) body = unsynchronised(body);
  return Buffer.concat([
    Buffer.from("ID3"),
    bytes(major, 0, flags),
    syncsafe(body.length),
    body,
    audio,
  ]);
}
function apic(
  data,
  { encoding = 0, mime = "image/png", type = 3, text = "" } = {},
) {
  return Buffer.concat([
    bytes(encoding),
    Buffer.from(`${mime}\0`, "latin1"),
    bytes(type),
    encoding === 1
      ? Buffer.concat([Buffer.from(`﻿${text}`, "utf16le"), bytes(0, 0)])
      : Buffer.from(`${text}\0`, encoding === 3 ? "utf8" : "latin1"),
    data,
  ]);
}
const title = ["TIT2", Buffer.concat([bytes(0), Buffer.from("A track")])];

function flac(picture, prefix = Buffer.alloc(0)) {
  const body = Buffer.concat([
    u32(3),
    u32(9),
    Buffer.from("image/png"),
    u32(0),
    u32(48),
    u32(32),
    u32(24),
    u32(0),
    u32(picture.length),
    picture,
  ]);
  return Buffer.concat([
    prefix,
    Buffer.from("fLaC"),
    bytes(0, 0, 0, 34),
    Buffer.alloc(34),
    bytes(0x86, body.length >> 16, (body.length >> 8) & 255, body.length & 255),
    body,
    bytes(0xff, 0xf8),
  ]);
}
const box = (type, ...content) => {
  const body = Buffer.concat(content);
  // Box types are four bytes; the copyright sign of "©nam" is the single byte 0xA9.
  return Buffer.concat([
    u32(8 + body.length),
    Buffer.from(type, "latin1"),
    body,
  ]);
};
const m4a = (picture) =>
  Buffer.concat([
    box("ftyp", Buffer.from("M4A "), u32(0)),
    // The audio comes first in a file written for streaming.
    box("mdat", Buffer.alloc(64, 7)),
    box(
      "moov",
      box("mvhd", Buffer.alloc(20)),
      box(
        "udta",
        box(
          "meta",
          u32(0),
          box("hdlr", Buffer.alloc(24)),
          box(
            "ilst",
            box("©nam", box("data", u32(1), u32(0), Buffer.from("A track"))),
            box("covr", box("data", u32(14), u32(0), picture)),
          ),
        ),
      ),
    ),
  ]);

test("the cover an MP3 carries is read from every ID3v2 layout in use", () => {
  assert.deepEqual(embeddedArtwork(id3(3, [title, ["APIC", apic(png)]])), {
    extension: "png",
    data: png,
  });
  // Version 2.4: syncsafe sizes, a UTF-8 description, a data length indicator.
  assert.deepEqual(
    embeddedArtwork(
      id3(4, [
        [
          "APIC",
          Buffer.concat([
            syncsafe(jpeg.length),
            apic(jpeg, { encoding: 3, mime: "image/jpeg", text: "封面" }),
          ]),
          0x01,
        ],
        title,
      ]),
    ),
    { extension: "jpg", data: jpeg },
  );
  // Version 2.2: three-letter frames and a three-letter image format.
  assert.deepEqual(
    embeddedArtwork(
      id3(2, [
        [
          "PIC",
          Buffer.concat([bytes(0), Buffer.from("PNG"), bytes(3, 0), png]),
        ],
      ]),
    )?.data,
    png,
  );
  // A UTF-16 description ends with two zero bytes, not one.
  assert.deepEqual(
    embeddedArtwork(
      id3(3, [["APIC", apic(png, { encoding: 1, text: "Front" })]]),
    )?.data,
    png,
  );
  // Unsynchronised: a zero after every 0xFF, of which a JPEG has several.
  assert.deepEqual(
    embeddedArtwork(
      id3(3, [["APIC", apic(jpeg, { mime: "image/jpeg" })], title], {
        flags: 0x80,
      }),
    )?.data,
    jpeg,
  );
  // Some taggers wrote version 2.4 frames with plain sizes.
  assert.ok(png.length > 127);
  assert.deepEqual(
    embeddedArtwork(id3(4, [["APIC", apic(png)], title], { plainSizes: true }))
      ?.data,
    png,
  );
});

test("the front cover is chosen among several pictures, and the bytes decide the type", () => {
  const several = id3(3, [
    ["APIC", apic(other, { type: 0 })],
    ["APIC", apic(png, { type: 3 })],
  ]);
  assert.deepEqual(embeddedArtwork(several)?.data, png);
  // The tag may call a JPEG a PNG; the published file is named for what it is.
  assert.equal(
    embeddedArtwork(id3(3, [["APIC", apic(jpeg, { mime: "image/png" })]]))
      ?.extension,
    "jpg",
  );
});

test("FLAC and M4A covers are read as well", () => {
  assert.deepEqual(embeddedArtwork(flac(png)), { extension: "png", data: png });
  assert.deepEqual(
    embeddedArtwork(flac(png, id3(3, [title]).subarray(0, -8)))?.data,
    png,
  );
  assert.deepEqual(embeddedArtwork(m4a(png)), { extension: "png", data: png });
});

test("a file without a cover, or a damaged one, yields none and never throws", () => {
  const tagged = id3(3, [["APIC", apic(png)], title]);
  for (const file of [
    id3(4, [title]),
    audio,
    Buffer.alloc(0),
    Buffer.from("fLaC"),
    box("ftyp", Buffer.from("M4A ")),
    // A link in place of a picture.
    id3(3, [
      [
        "APIC",
        apic(Buffer.from("https://covers.example/a.png"), { mime: "-->" }),
      ],
    ]),
    // Cut off inside the picture, and inside the frame header.
    tagged.subarray(0, 40),
    tagged.subarray(0, 14),
    Buffer.concat([Buffer.from("ID3"), bytes(4, 0, 0, 0x7f, 0x7f, 0x7f, 0x7f)]),
  ])
    assert.equal(embeddedArtwork(file), null);
});

test("an item takes its file's cover only where the author named none", () => {
  const manifest = {
    id: "music",
    embeddedArtwork: [{ each: "tracks.*", audio: "src", image: "cover" }],
  };
  const withCover = id3(3, [["APIC", apic(png)]]);
  const published = {
    "/portfolio/audio/official.mp3": withCover,
    "/portfolio/audio/chosen.mp3": withCover,
    "/portfolio/audio/plain.mp3": id3(3, [title]),
    "/portfolio/audio/kept.mp3": withCover,
    "/portfolio/audio/kept.cover.png": other,
  };
  const options = {
    tracks: [
      { id: "official", src: "/portfolio/audio/official.mp3" },
      {
        id: "chosen",
        src: "/portfolio/audio/chosen.mp3",
        cover: "/portfolio/covers/mine.webp",
      },
      { id: "plain", src: "/portfolio/audio/plain.mp3" },
      { id: "remote", src: "https://audio.example/remote.mp3" },
      { id: "kept", src: "/portfolio/audio/kept.mp3" },
    ],
  };
  const before = structuredClone(options);
  const result = withEmbeddedArtwork(
    manifest,
    options,
    (asset) => published[asset],
  );
  assert.deepEqual(options, before, "The author's options were changed");
  assert.deepEqual(
    result.options.tracks.map((track) => track.cover ?? null),
    [
      "/portfolio/audio/official.cover.png",
      "/portfolio/covers/mine.webp",
      null,
      null,
      // A published file of that name belongs to the author.
      null,
    ],
  );
  assert.deepEqual(
    [...result.images],
    [["/portfolio/audio/official.cover.png", png]],
  );
  // A plugin that declares no rule is handed back exactly what it gave.
  assert.equal(
    withEmbeddedArtwork({ id: "comments" }, options, () => null).options,
    options,
  );
  for (const embeddedArtwork of [
    "tracks.*",
    [{ each: "tracks.*", audio: "src" }],
    [{ each: "tracks[0]", audio: "src", image: "cover" }],
    [{ each: "tracks.*", audio: "a.b", image: "cover" }],
  ])
    assert.throws(
      () =>
        withEmbeddedArtwork(
          { id: "music", embeddedArtwork },
          options,
          () => null,
        ),
      /embeddedArtwork/,
    );
});

test("the content build publishes an embedded cover and names it for the player", async () => {
  const temporary = await fs.mkdtemp(
    path.join(qaTempRoot, "folioweave-artwork-"),
  );
  try {
    const config = JSON.parse(
      await fs.readFile(
        path.join(root, "governance/demo-portfolio.json"),
        "utf8",
      ),
    );
    config.features.demoRoutes = false;
    config.features.work = false;
    config.projects = [];
    for (const asset of collectAssets(config)) {
      const relative = path.join(
        asset.startsWith("/portfolio/") ? "content/assets" : "public",
        asset.slice(1),
      );
      await fs.mkdir(path.dirname(path.join(temporary, relative)), {
        recursive: true,
      });
      await fs.copyFile(
        path.join(root, relative),
        path.join(temporary, relative),
      );
    }
    await fs.copyFile(
      path.join(root, "portfolio.schema.json"),
      path.join(temporary, "portfolio.schema.json"),
    );
    for (const directory of ["src/blog", "src/demo"]) {
      await fs.mkdir(path.join(temporary, directory), { recursive: true });
      await fs.writeFile(
        path.join(temporary, directory, "custom-posts.json"),
        "[]",
      );
    }
    await fs.mkdir(path.join(temporary, "content/blogs"), { recursive: true });
    const audioDirectory = path.join(
      temporary,
      "content/assets/portfolio/audio",
    );
    await fs.mkdir(audioDirectory, { recursive: true });
    await fs.writeFile(
      path.join(audioDirectory, "official.mp3"),
      id3(3, [["APIC", apic(png)], title]),
    );
    await fs.writeFile(path.join(audioDirectory, "plain.mp3"), id3(3, [title]));
    config.plugins = {
      music: {
        enabled: true,
        options: {
          tracks: [
            {
              id: "official",
              title: "Official",
              src: "/portfolio/audio/official.mp3",
            },
            { id: "plain", title: "Plain", src: "/portfolio/audio/plain.mp3" },
          ],
        },
      },
    };
    await seedProjectDefinitions(temporary);
    const plan = await prepareContent(temporary, config);
    const cover = "/portfolio/audio/official.cover.png";
    assert.deepEqual(
      { width: plan.media[cover]?.width, height: plan.media[cover]?.height },
      { width: 48, height: 32 },
    );
    assert.equal(config.plugins.music.options.tracks[0].cover, undefined);
    const outputs = generatedOutputs(plan, temporary);
    const published = outputs.find(
      (item) => item.target === "public/portfolio",
    );
    assert.deepEqual(
      published.files.find(
        ([name]) => name === "audio/official.cover.png",
      )?.[1],
      png,
    );
    assert.equal(
      published.files.some(([name]) => name.startsWith("audio/plain.cover")),
      false,
    );
    const slot = outputs.find((item) =>
      item.target.endsWith("plugins-site-floating.generated.tsx"),
    ).contents;
    assert.ok(slot.includes(`"cover":"${cover}"`));
    assert.equal(
      slot.split('"cover"').length,
      2,
      "Only the tagged file has a cover",
    );
  } finally {
    await fs.rm(temporary, { recursive: true });
  }
});
