import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import {
  loadCatalog,
  resolveExtensions,
  extensionOutputs,
} from "../src/core/extensions.mjs";
import { createProjectContext } from "../scripts/project-context.mjs";
import { refractDemoProfile } from "./refract-fixture.mjs";
import {
  collectAssets,
  publishedPortfolio,
} from "../src/portfolio/content-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
/** The real dictionary module, importable beside a transpiled consumer. */
async function copyModule() {
  const source = await fs.readFile(
    path.join(root, "src/components/refract/copy.ts"),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}

test("Refract adapter handles empty options, disabled sections and variable project counts", async () => {
  const source = await fs.readFile(
    path.join(root, "src/components/refract/data.ts"),
    "utf8",
  );
  const code = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(
      /import\s*\{\s*mediaDimensions\s*\}\s*from\s*["']@\/portfolio\/media["'];?/,
      "const mediaDimensions = () => ({ width: 1200, height: 800 });",
    )
    .replace(/from\s*["']\.\/copy["']/, `from "${await copyModule()}"`);
  const { createRefractData } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
  const config = await refractDemoProfile("light");
  const contextFor = (input) => {
    const config = publishedPortfolio(input);
    return {
      site: config.site,
      introduction: config.hero,
      biography: config.about,
      projects: config.projects,
      photography: config.photography,
      writing: config.blog,
      features: config.features,
      options: {},
      capabilities: { writing: false },
    };
  };
  const ordinary = createRefractData(contextFor(config));
  assert.equal(ordinary.profile.name, config.site.identity.name);
  assert.equal(ordinary.researchProjects.length, 4);
  assert.deepEqual(ordinary.tools, []);
  assert.deepEqual(ordinary.news, []);
  assert.deepEqual(ordinary.publications, []);
  config.projects = Array.from({ length: 7 }, (_, index) => ({
    ...config.projects[index % 4],
    id: `project-${index}`,
    enabled: true,
  }));
  assert.equal(
    createRefractData(contextFor(config)).researchProjects.length,
    7,
    "All configured projects remain available",
  );
  config.features.work = false;
  config.features.about = false;
  const empty = createRefractData(contextFor(config));
  assert.deepEqual(empty.researchProjects, []);
  assert.deepEqual(empty.experience, []);
  assert.deepEqual(
    empty.sections.map((item) => item.href),
    ["#contact"],
    "No navigation to hidden or empty sections",
  );
});

test("Refract styles are independent CLI templates with identical configuration contracts", async () => {
  const catalog = loadCatalog(root);
  const light = catalog.templates.find((item) => item.id === "refract-light");
  const dark = catalog.templates.find((item) => item.id === "refract-dark");
  assert.ok(light && dark);
  assert.deepEqual(light.optionsSchema, dark.optionsSchema);
  assert.deepEqual(light.sections, dark.sections);
  assert.deepEqual(light.slots, [
    "site.floating",
    "site.footer",
    "article.after",
  ]);
  for (const style of ["light", "dark"]) {
    const config = await refractDemoProfile(style);
    const selected = resolveExtensions(config, catalog);
    assert.equal(selected.template.id, `refract-${style}`);
    assert.deepEqual(selected.plugins, []);
    const outputs = extensionOutputs(selected);
    for (const output of outputs.filter((item) =>
      /template-(?:layout|home|blog-)/.test(item.target),
    )) {
      assert.match(output.contents, new RegExp(`templates/refract-${style}/`));
      assert.doesNotMatch(output.contents, /templates\/classic\//);
    }
    config.template.settings = {};
    assert.deepEqual(resolveExtensions(config, catalog).options, {});
    config.template.settings[`refract-${style}`] = { style: "other" };
    assert.throws(() => resolveExtensions(config, catalog), /options/);
  }
});

test("public Refract examples use neutral identity and original local demo artwork", async () => {
  const { validate } = await createProjectContext(root);
  const profiles = await Promise.all([
    refractDemoProfile("light"),
    refractDemoProfile("dark"),
  ]);
  for (const config of profiles) {
    assert.ok(validate(config), JSON.stringify(validate.errors));
    assert.equal(config.site.identity.name, "Alex Morgan");
    assert.equal(config.site.contact.email, "hello@example.com");
    assert.equal(config.features.photography, false);
    assert.equal(config.features.resume, false);
    assert.equal(config.features.demoRoutes, false);
    assert.equal(config.projects.length, 4);
    assert.equal(new Set(config.projects.map((item) => item.id)).size, 4);
    assert.doesNotMatch(
      JSON.stringify(config),
      /weijie|wj714|berkeley\.edu|scholar\.google|wzhang01/i,
    );
    for (const asset of collectAssets(config)) {
      assert.ok(
        asset.startsWith("/portfolio/demo/") ||
          asset.startsWith("/assets/demo/"),
        `Unexpected example resource: ${asset}`,
      );
      if (asset.startsWith("/portfolio/demo/") && !asset.endsWith(".png"))
        await fs.access(
          path.join(root, "governance/templates/assets", path.basename(asset)),
        );
    }
  }
  const [a, b] = profiles.map((config) => {
    const copy = structuredClone(config);
    delete copy.template;
    delete copy.site.origin;
    delete copy.site.themeColor;
    return copy;
  });
  assert.deepEqual(a, b, "Two styles share one content example");
});

test("Refract wording follows the profile language and accepts per-label overrides", async () => {
  const { refractCopy, refractCopyKeys } = await import(await copyModule());
  const english = refractCopy("en-US");
  const chinese = refractCopy("zh-CN");
  assert.equal(english.contact, "Contact");
  assert.equal(chinese.contact, "联系");
  assert.deepEqual(
    refractCopy("fr-FR"),
    english,
    "An unknown language must fall back to English",
  );
  for (const key of refractCopyKeys) {
    assert.ok(chinese[key], `Chinese wording is missing ${key}`);
    assert.notEqual(chinese[key], english[key], `${key} was left untranslated`);
  }
  assert.equal(refractCopy("zh-CN", { contact: "聊聊" }).contact, "聊聊");
  const catalog = loadCatalog(root);
  for (const id of ["refract-light", "refract-dark"]) {
    const manifest = catalog.templates.find((item) => item.id === id);
    assert.deepEqual(
      manifest.optionsSchema.properties.labels.propertyNames.enum,
      refractCopyKeys,
      `${id} accepts a different set of labels than the dictionary defines`,
    );
    const config = await refractDemoProfile(id.slice("refract-".length));
    config.template.settings[id].labels = { contact: "Say hello" };
    assert.equal(
      resolveExtensions(config, catalog).options.labels.contact,
      "Say hello",
    );
    config.template.settings[id].labels = { contcat: "typo" };
    assert.throws(() => resolveExtensions(config, catalog));
  }
});

test("a profile may omit the blocks only Classic renders, and Classic insists on them", async () => {
  const catalog = loadCatalog(root);
  const classic = catalog.templates.find((item) => item.id === "classic");
  assert.deepEqual(classic.requires, [
    "photography",
    "footerBook",
    "interlude",
  ]);
  const lean = await refractDemoProfile("dark");
  for (const block of classic.requires)
    assert.equal(
      block in lean,
      false,
      `The Refract demo still carries ${block}`,
    );
  const selected = resolveExtensions(lean, catalog);
  const published = publishedPortfolio(lean, selected.template.sections);
  assert.deepEqual(published.photography, { intro: "", images: [] });
  assert.deepEqual(published.footerBook, { title: "", quote: "", author: "" });
  assert.equal(published.interlude.image, "");
  assert.deepEqual([...collectAssets(published.interlude)], []);
  const switched = structuredClone(lean);
  switched.template = { id: "classic", settings: {} };
  assert.throws(
    () => resolveExtensions(switched, catalog),
    /classic needs "photography", "footerBook", "interlude" in portfolio\.json/,
  );
  switched.photography = { intro: "", images: [] };
  switched.footerBook = { title: "Notes", quote: "Hello.", author: "A" };
  assert.throws(
    () => resolveExtensions(switched, catalog),
    /classic needs "interlude" in portfolio\.json\. Add that block/,
  );
});
