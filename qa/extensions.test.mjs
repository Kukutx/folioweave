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
  pluginPageRoutes,
  templatePages,
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
  catalog.templates.find((template) => template.id === "classic").slots = [];
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

test("plugin pages are generated only for enabled plugins and menus never import page code", () => {
  const none = extensionOutputs(resolveExtensions(demo));
  const pagesOf = (outputs, name) =>
    outputs.find((item) => item.target.endsWith(name)).contents;
  assert.match(
    pagesOf(none, "plugin-pages.generated.tsx"),
    /pluginPages: PluginPageEntry\[\] = \[\];/,
  );
  assert.doesNotMatch(
    pagesOf(none, "plugin-page-links.generated.tsx"),
    /@\/plugins/,
  );
  const profile = {
    ...demo,
    plugins: { emojicut: { enabled: true }, launcher: { enabled: true } },
  };
  const resolved = resolveExtensions(profile);
  assert.deepEqual(pluginPageRoutes(resolved), ["/tools/emojicut"]);
  // A page-only plugin occupies no slot.
  assert.equal(
    resolved.plugins.find((plugin) => plugin.id === "emojicut").slot,
    null,
  );
  const outputs = extensionOutputs(resolved);
  const pages = pagesOf(outputs, "plugin-pages.generated.tsx");
  assert.match(pages, /import Page0 from "@\/plugins\/emojicut\/page";/);
  assert.match(pages, /href: "\/tools\/emojicut"/);
  const links = pagesOf(outputs, "plugin-page-links.generated.tsx");
  assert.match(links, /import Icon0 from "@\/plugins\/emojicut\/icon";/);
  assert.doesNotMatch(links, /emojicut\/page/);
  for (const slot of ["site-footer", "article-after"])
    assert.doesNotMatch(
      pagesOf(outputs, `plugins-${slot}.generated.tsx`),
      /emojicut/,
    );
  assert.throws(
    () =>
      resolveExtensions({
        ...demo,
        plugins: { emojicut: { enabled: true, slot: "site.floating" } },
      }),
    /slot/,
  );
});

test("a template may add a 404 view and pages; the core 404 stands in otherwise", async (t) => {
  const outputsOf = (resolved, name) =>
    extensionOutputs(resolved).find((item) => item.target.endsWith(name))
      .contents;
  const classic = resolveExtensions(demo);
  assert.match(
    outputsOf(classic, "template-not-found.generated.ts"),
    /@\/components\/system\/not-found-view/,
  );
  assert.match(
    outputsOf(classic, "template-pages.generated.tsx"),
    /templatePages: TemplatePageEntry\[\] = \[\];/,
  );

  const sandbox = await fs.mkdtemp(path.join(qaTempRoot, "template-extras-"));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));
  const directory = path.join(sandbox, "src/templates/shop");
  await fs.cp(path.join(root, "src/templates/classic"), directory, {
    recursive: true,
  });
  for (const file of ["not-found.tsx", "catalog.tsx", "preview.webp"])
    await fs.writeFile(path.join(directory, file), "");
  const manifest = JSON.parse(
    await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  const write = (changes) =>
    fs.writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify({ ...manifest, id: "shop", ...changes }),
    );
  const extras = {
    category: "store",
    preview: "preview.webp",
    requires: [],
    entries: { ...manifest.entries, NotFound: "not-found.tsx" },
    pages: [
      {
        id: "catalog",
        entry: "catalog.tsx",
        path: "products",
        pathOption: "catalogPath",
      },
    ],
    optionsSchema: {
      type: "object",
      additionalProperties: false,
      properties: { catalogPath: { type: "string" } },
    },
  };
  await write(extras);
  const catalog = loadCatalog(sandbox);
  const profile = { ...demo, template: { id: "shop" } };
  const shop = resolveExtensions(profile, catalog);
  assert.deepEqual(
    templatePages(shop).map((page) => page.href),
    ["/products"],
  );
  assert.match(
    outputsOf(shop, "template-not-found.generated.ts"),
    /@\/templates\/shop\/not-found/,
  );
  assert.match(
    outputsOf(shop, "template-pages.generated.tsx"),
    /import Page0, \{ describe as describe0 \} from "@\/templates\/shop\/catalog";/,
  );
  // An author renames the page through the option the manifest names.
  const renamed = resolveExtensions(
    {
      ...demo,
      template: { id: "shop", settings: { shop: { catalogPath: "prodotti" } } },
    },
    catalog,
  );
  assert.deepEqual(
    templatePages(renamed).map((page) => page.href),
    ["/prodotti"],
  );
  for (const bad of ["blogs", "Bad Path"])
    assert.throws(
      () =>
        templatePages(
          resolveExtensions(
            {
              ...demo,
              template: {
                id: "shop",
                settings: { shop: { catalogPath: bad } },
              },
            },
            catalog,
          ),
        ),
      /cannot use the path/,
    );
  for (const broken of [
    { category: "museum" },
    { preview: "missing.webp" },
    { translations: { zh: { title: "名字" } } },
    { translations: { chinese: { name: "名字" } } },
    { entries: { ...extras.entries, NotFound: "missing.tsx" } },
    { entries: { ...extras.entries, Sidebar: "catalog.tsx" } },
    { pages: [{ id: "catalog", entry: "catalog.tsx", path: "tools" }] },
    { pages: [{ id: "catalog", entry: "missing.tsx", path: "products" }] },
  ]) {
    await write({ ...extras, ...broken });
    assert.throws(() => loadCatalog(sandbox), /shop:/, JSON.stringify(broken));
  }
});

test("store templates require the store block; others publish an empty one", () => {
  assert.deepEqual(publishedPortfolio(demo).store, { locations: [] });
  const store = {
    locations: [{ id: "main", name: "Shop", city: "Milano" }],
  };
  assert.deepEqual(publishedPortfolio({ ...demo, store }).store, store);
});

test("a plugin page must name an existing entry and a lowercase path, and paths are unique", async (t) => {
  const sandbox = await fs.mkdtemp(path.join(qaTempRoot, "plugin-page-"));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));
  await fs.cp(
    path.join(root, "src/templates/classic"),
    path.join(sandbox, "src/templates/classic"),
    { recursive: true },
  );
  const plugin = async (id, page) => {
    const directory = path.join(sandbox, "src/plugins", id);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "page.tsx"), "export default 0;");
    await fs.writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        id,
        name: id,
        version: "1.0.0",
        apiVersion: 1,
        slots: [],
        page,
        optionsSchema: { type: "object", additionalProperties: false },
      }),
    );
  };
  await plugin("first", { entry: "page.tsx", path: "shared", title: "First" });
  await plugin("second", { entry: "page.tsx", path: "shared", title: "Two" });
  const catalog = loadCatalog(sandbox);
  assert.throws(
    () =>
      resolveExtensions(
        {
          ...demo,
          plugins: { first: { enabled: true }, second: { enabled: true } },
        },
        catalog,
      ),
    /already used by first/,
  );
  for (const page of [
    { entry: "missing.tsx", path: "ok", title: "Missing" },
    { entry: "page.tsx", path: "Upper", title: "Upper" },
    { entry: "page.tsx", path: "ok", title: " " },
    { entry: "page.tsx", path: "ok", title: "Extra", script: "x" },
    undefined,
  ]) {
    await plugin("second", page);
    assert.throws(
      () => loadCatalog(sandbox),
      /page|slot/,
      JSON.stringify(page),
    );
  }
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
