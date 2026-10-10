import {
  seedProjectDefinitions,
  updateFixture as updateProfile,
} from "./project-fixture.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  loadCatalog,
  resolveExtensions,
  extensionOutputs,
  extensionSources,
} from "../src/core/extensions.mjs";
import {
  collectAssets,
  publishedPortfolio,
} from "../src/portfolio/content-policy.mjs";
import { loadMarkdownBlogPosts } from "../src/blog/content-core.mjs";
import { prepareContent } from "../scripts/content-build.mjs";
import { scaffoldTemplate } from "../scripts/template-scaffold.mjs";
import { qaTempRoot } from "./temp-directory.mjs";
import { discussionLanguage } from "../src/plugins/comments/language.mjs";

const root = path.resolve(import.meta.dirname, "..");
const demo = JSON.parse(
  await fs.readFile(path.join(root, "governance/demo-portfolio.json"), "utf8"),
);
const comments = {
  enabled: true,
  options: {
    provider: "giscus",
    repo: "example/discussions",
    repoId: "R_example",
    category: "General",
    categoryId: "DIC_example",
  },
};
const music = {
  enabled: true,
  options: {
    tracks: [
      { id: "first", title: "First", src: "/portfolio/audio/first.wav" },
    ],
  },
};

test("comments inherit supported site locales with explicit Chinese script handling", () => {
  for (const [locale, expected] of Object.entries({
    "en-US": "en",
    "it-IT": "it",
    "pt-BR": "pt",
    "zh-CN": "zh-CN",
    "zh-SG": "zh-CN",
    "zh-TW": "zh-TW",
    "zh-Hant-HK": "zh-TW",
    "zh-Hans-TW": "zh-CN",
    "ar-EG": "en",
    invalid_locale: "en",
  }))
    assert.equal(discussionLanguage(locale), expected, locale);
});

test("old profiles select classic with no plugin code or external origins", () => {
  const resolved = resolveExtensions(demo);
  assert.equal(resolved.template.id, "classic");
  assert.deepEqual(resolved.plugins, []);
  const output = extensionOutputs(resolved).find((item) =>
    item.target.endsWith("plugins-article-after.generated.tsx"),
  );
  assert.doesNotMatch(output.contents, /@\/plugins|PluginBoundary/);
  assert.deepEqual(extensionSources(demo), {});
});

test("plugins are optional even when their source directory has been removed", async (t) => {
  const target = await fs.mkdtemp(path.join(qaTempRoot, "no-plugins-"));
  t.after(async () => {
    assert.equal(path.dirname(target), qaTempRoot);
    await fs.rm(target, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(target, "src/templates"), { recursive: true });
  await fs.cp(
    path.join(root, "src/templates/classic"),
    path.join(target, "src/templates/classic"),
    { recursive: true },
  );
  const catalog = loadCatalog(target);
  assert.deepEqual(catalog.plugins, []);
  const disabled = {
    ...demo,
    plugins: { comments: { ...comments, enabled: false } },
  };
  assert.deepEqual(resolveExtensions(disabled, catalog).plugins, []);
  assert.throws(
    () => resolveExtensions({ ...demo, plugins: { comments } }, catalog),
    /Unknown plugin: comments/,
  );
});

test("invalid ids, incompatible slots, options and API versions fail before publication", () => {
  assert.throws(
    () => resolveExtensions({ ...demo, template: { id: "missing" } }),
    /Unknown template/,
  );
  assert.deepEqual(
    resolveExtensions({ ...demo, plugins: { mystery: { enabled: false } } })
      .plugins,
    [],
  );
  assert.throws(
    () =>
      resolveExtensions({ ...demo, plugins: { mystery: { enabled: true } } }),
    /Unknown plugin/,
  );
  assert.throws(
    () =>
      resolveExtensions({ ...demo, plugins: { comments: { enabled: true } } }),
    /options/,
  );
  assert.throws(
    () =>
      resolveExtensions({
        ...demo,
        plugins: { comments: { ...comments, slot: "site.floating" } },
      }),
    /slot/,
  );
  assert.throws(
    () =>
      resolveExtensions({
        ...demo,
        plugins: {
          music: {
            enabled: true,
            options: {
              tracks: [
                { id: "bad", title: "Bad", src: "/portfolio/../secret.wav" },
              ],
            },
          },
        },
      }),
    /options/,
  );
  const catalog = loadCatalog();
  catalog.templates[0].slots = [];
  assert.throws(
    () => resolveExtensions({ ...demo, plugins: { comments } }, catalog),
    /not supported/,
  );
});

test("disabled plugin settings and other template settings never enter publication", () => {
  const profile = {
    ...demo,
    template: {
      id: "classic",
      settings: { classic: {}, future: { privateDraft: "do not publish" } },
    },
    plugins: { comments: { ...comments, enabled: false } },
  };
  const payload = publishedPortfolio(profile);
  assert.deepEqual(payload.plugins, {});
  assert.deepEqual(payload.template.settings, { classic: {} });
  assert.deepEqual(extensionSources(profile), {});
  assert.doesNotMatch(
    extensionOutputs(resolveExtensions(profile))
      .map((item) => item.contents)
      .join(""),
    /giscus|do not publish|@\/plugins\/comments/,
  );
});

test("enabled comments have scoped network policy and a stable article slot", () => {
  const profile = { ...demo, plugins: { comments } };
  assert.deepEqual(extensionSources(profile)["frame-src"], [
    "https://giscus.app",
  ]);
  const code = extensionOutputs(resolveExtensions(profile)).find((item) =>
    item.target.endsWith("plugins-article-after.generated.tsx"),
  ).contents;
  assert.match(code, /function PluginSlot/);
  assert.match(code, /@\/plugins\/comments\/comments/);
  assert.doesNotMatch(code, /@\/plugins\/music/);
});

test("audio follows the same authored and published resource boundary", async () => {
  const sandbox = await fs.mkdtemp(path.join(qaTempRoot, "audio-"));
  try {
    for (const item of [
      "portfolio.schema.json",
      "src/blog/custom-posts.json",
      "src/demo/custom-posts.json",
    ]) {
      await fs.mkdir(path.dirname(path.join(sandbox, item)), {
        recursive: true,
      });
      await fs.copyFile(path.join(root, item), path.join(sandbox, item));
    }
    await fs.cp(path.join(root, "public"), path.join(sandbox, "public"), {
      recursive: true,
    });
    await fs.mkdir(path.join(sandbox, "content/blogs"), { recursive: true });
    await fs.mkdir(path.join(sandbox, "content/assets/portfolio/audio"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(sandbox, "content/assets/portfolio/audio/first.wav"),
      Buffer.from("RIFF test fixture"),
    );
    const profile = { ...demo, plugins: { music } };
    assert.ok(collectAssets(profile).has("/portfolio/audio/first.wav"));
    await seedProjectDefinitions(sandbox);
    const active = await prepareContent(sandbox, profile);
    assert.equal(active.media["/portfolio/audio/first.wav"].bytes, 17);
    profile.plugins.music = { ...music, enabled: false };
    await fs.unlink(
      path.join(sandbox, "content/assets/portfolio/audio/first.wav"),
    );
    const disabled = await prepareContent(sandbox, profile);
    assert.equal(disabled.media["/portfolio/audio/first.wav"], undefined);
    const filename = path.join(sandbox, "portfolio.json");
    const previous = JSON.stringify(profile, null, 4);
    await fs.writeFile(filename, previous);
    const change = (candidate) => ({
      ...candidate,
      template: { id: "classic" },
    });
    await updateProfile(sandbox, change, { dryRun: true });
    assert.equal(await fs.readFile(filename, "utf8"), previous);
    await fs.mkdir(path.join(sandbox, ".generated"), { recursive: true });
    await fs.writeFile(
      path.join(sandbox, ".generated/content.lock"),
      JSON.stringify({ pid: process.pid }),
    );
    await assert.rejects(updateProfile(sandbox, change), { code: "EEXIST" });
    assert.equal(
      await fs.readFile(filename, "utf8"),
      previous,
      "failed publication restores author bytes",
    );
  } finally {
    await fs.rm(sandbox, { recursive: true, force: true });
  }
});

test("article ids survive filenames changing and reject duplicate fallback identities", async () => {
  const sandbox = await fs.mkdtemp(path.join(qaTempRoot, "article-"));
  const markdown = (id = "") =>
    `---\n${id ? `id: ${id}\n` : ""}title: Example\ndate: 2026-10-08\ndescription: An article\n---\n\n## Hello\n\nArticle body.`;
  try {
    await fs.writeFile(path.join(sandbox, "first.md"), markdown("permanent"));
    assert.equal(
      loadMarkdownBlogPosts({ blogsDir: sandbox }).posts[0].id,
      "permanent",
    );
    await fs.rename(
      path.join(sandbox, "first.md"),
      path.join(sandbox, "renamed.md"),
    );
    assert.equal(
      loadMarkdownBlogPosts({ blogsDir: sandbox }).posts[0].id,
      "permanent",
    );
    await fs.writeFile(path.join(sandbox, "permanent.md"), markdown());
    assert.throws(
      () => loadMarkdownBlogPosts({ blogsDir: sandbox }),
      /ids must be unique/,
    );
  } finally {
    await fs.rm(sandbox, { recursive: true, force: true });
  }
});

test("template scaffold is discoverable, supports all page contracts and cannot overwrite", async () => {
  const sandbox = await fs.mkdtemp(path.join(qaTempRoot, "scaffold-"));
  try {
    await fs.mkdir(path.join(sandbox, "src/templates"), { recursive: true });
    await fs.mkdir(path.join(sandbox, "src/plugins"), { recursive: true });
    await scaffoldTemplate(sandbox, "second");
    const catalog = loadCatalog(sandbox);
    const selected = resolveExtensions(
      {
        ...demo,
        template: { id: "second", settings: { second: { heading: "Hello" } } },
      },
      catalog,
    );
    assert.equal(selected.options.heading, "Hello");
    assert.match(
      extensionOutputs(selected).find((item) =>
        item.target.endsWith("template-home.generated.ts"),
      ).contents,
      /templates\/second/,
    );
    await assert.rejects(scaffoldTemplate(sandbox, "second"), /EEXIST/);
    const filename = path.join(sandbox, "src/templates/second/manifest.json");
    const manifest = JSON.parse(await fs.readFile(filename, "utf8"));
    manifest.apiVersion = 99;
    await fs.writeFile(filename, JSON.stringify(manifest));
    assert.throws(() => loadCatalog(sandbox), /unsupported extension API/);
  } finally {
    await fs.rm(sandbox, { recursive: true, force: true });
  }
});

test("invalid CLI edits leave the author's exact profile bytes intact", async () => {
  const sandbox = await fs.mkdtemp(path.join(qaTempRoot, "profile-"));
  try {
    const previous = JSON.stringify(demo, null, 4) + "\n";
    await fs.writeFile(path.join(sandbox, "portfolio.json"), previous);
    await fs.copyFile(
      path.join(root, "portfolio.schema.json"),
      path.join(sandbox, "portfolio.schema.json"),
    );
    await seedProjectDefinitions(sandbox);
    await assert.rejects(
      updateProfile(sandbox, (profile) => ({
        ...profile,
        template: { id: "unknown" },
      })),
      /Unknown template/,
    );
    assert.equal(
      await fs.readFile(path.join(sandbox, "portfolio.json"), "utf8"),
      previous,
    );
  } finally {
    await fs.rm(sandbox, { recursive: true, force: true });
  }
});
