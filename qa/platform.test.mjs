import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { qaTempRoot } from "./temp-directory.mjs";
import {
  seedProjectDefinitions,
  updateFixture as updateProfile,
  publishFixture as publishContent,
} from "./project-fixture.mjs";
import {
  collectAssets,
  publishedPortfolio,
  validatePublicationLinks,
} from "../src/portfolio/content-policy.mjs";
import { prepareContent } from "../scripts/content-build.mjs";
import { scaffoldTemplate } from "../scripts/template-scaffold.mjs";
import { commitGeneratedOutputs } from "../scripts/atomic-output.mjs";
import {
  extensionOutputs,
  resolveExtensions,
} from "../src/core/extensions.mjs";
import points from "../src/core/extension-points.json" with { type: "json" };
import { extensionImportViolations } from "../scripts/extension-boundary.mjs";
import { withPlaceholderAssets } from "../scripts/placeholder-assets.mjs";

const root = path.resolve(import.meta.dirname, "..");
const demo = JSON.parse(
  await fs.readFile(path.join(root, "governance/demo-portfolio.json"), "utf8"),
);

async function fixture(t) {
  const target = await fs.mkdtemp(path.join(qaTempRoot, "platform-"));
  t.after(async () => {
    assert.equal(path.dirname(target), qaTempRoot);
    await fs.rm(target, { recursive: true, force: true });
  });
  await seedProjectDefinitions(target);
  await fs.copyFile(
    path.join(root, "portfolio.schema.json"),
    path.join(target, "portfolio.schema.json"),
  );
  const profile = structuredClone(demo);
  profile.features.demoRoutes = false;
  profile.features.work = false;
  profile.projects = [];
  for (const asset of collectAssets(profile)) {
    const relative = path.join(
      asset.startsWith("/portfolio/") ? "content/assets" : "public",
      asset.slice(1),
    );
    await fs.mkdir(path.dirname(path.join(target, relative)), {
      recursive: true,
    });
    await fs.copyFile(path.join(root, relative), path.join(target, relative));
  }
  for (const relative of [
    "src/blog/custom-posts.json",
    "src/demo/custom-posts.json",
  ]) {
    await fs.mkdir(path.dirname(path.join(target, relative)), {
      recursive: true,
    });
    await fs.writeFile(path.join(target, relative), "[]");
  }
  await fs.mkdir(path.join(target, "content/blogs"), { recursive: true });
  await fs.writeFile(
    path.join(target, "portfolio.json"),
    JSON.stringify(profile),
  );
  return { target, profile };
}

test("target catalog and changed route definitions are read from the target on every preparation", async (t) => {
  const { target, profile } = await fixture(t);
  await scaffoldTemplate(target, "other");
  profile.template = { id: "other" };
  const routes = path.join(target, "src/portfolio/routes.json");
  await fs.writeFile(
    routes,
    JSON.stringify([{ path: "/target-only", demoOnly: false }]),
  );
  const first = await prepareContent(target, profile);
  assert.equal(first.extensions.template.id, "other");
  assert.ok(first.routes.includes("/target-only"));
  await fs.writeFile(
    routes,
    JSON.stringify([{ path: "/changed", demoOnly: false }]),
  );
  const second = await prepareContent(target, profile);
  assert.ok(second.routes.includes("/changed"));
  assert.ok(!second.routes.includes("/target-only"));
});

test("template-specific navigation can be retained across a round trip", () => {
  const profile = structuredClone(demo);
  profile.site.navigation.push({
    label: "Services",
    href: "#services",
    sectionId: "services",
  });
  assert.doesNotThrow(() =>
    validatePublicationLinks(
      profile,
      ["/blogs/example"],
      ["home", "services", "contact"],
    ),
  );
  assert.doesNotThrow(() =>
    validatePublicationLinks(profile, ["/blogs/example"]),
  );
  assert.ok(
    !publishedPortfolio(profile).site.navigation.some(
      (item) => item.sectionId === "services",
    ),
  );
  assert.ok(
    publishedPortfolio(profile, [
      "home",
      "services",
      "contact",
    ]).site.navigation.some((item) => item.sectionId === "services"),
  );
  profile.site.navigation.at(-1).href = "#wrong";
  assert.throws(
    () => validatePublicationLinks(profile, [], ["services"]),
    /matching section/,
  );
});

test("an older preparation cannot replace a newer published article snapshot", async (t) => {
  const { target } = await fixture(t);
  const filename = path.join(target, "content/blogs/check.md");
  const post = (body) =>
    `---\ntitle: Check\ndate: 2026-10-08\ndescription: Check\n---\n\n${body}`;
  await fs.writeFile(filename, post("Old body"));
  const old = await prepareContent(target);
  await fs.writeFile(filename, post("New body"));
  const current = await prepareContent(target);
  await publishContent(current, target);
  await assert.rejects(
    publishContent(old, target),
    /changed after preparation/,
  );
  assert.match(
    await fs.readFile(path.join(target, "src/blog/posts.generated.ts"), "utf8"),
    /New body/,
  );
});

test("profile writers serialize, reject changed sources and preserve later author edits", async (t) => {
  const { target } = await fixture(t);
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const first = updateProfile(target, async (profile) => {
    entered.resolve();
    await release.promise;
    profile.footerBook.quote = "Updated";
    return profile;
  });
  await entered.promise;
  try {
    await assert.rejects(
      updateProfile(target, (value) => value),
      /locked/,
    );
  } finally {
    release.resolve();
  }
  await first;
  const source = path.join(target, "portfolio.json");
  const before = await fs.readFile(source, "utf8");
  await assert.rejects(
    updateProfile(target, async (profile) => {
      await fs.writeFile(source, before + "\n");
      return profile;
    }),
    /profile changed/,
  );
  assert.equal(await fs.readFile(source, "utf8"), before + "\n");
  await assert.rejects(
    updateProfile(target, (value) => value, { expectedSource: before }),
    /profile changed/,
  );
});

test("publication checks source again after staging, and alternate roots keep branch protection", async (t) => {
  const { target } = await fixture(t);
  const prepared = await prepareContent(target);
  await assert.rejects(
    publishContent(prepared, target, { targetBranch: "main" }),
    /publication blocked/,
  );
  const write = fs.writeFile;
  let injected = false;
  t.mock.method(fs, "writeFile", async (filename, ...args) => {
    const result = await write(filename, ...args);
    if (
      !injected &&
      String(filename).includes("content-transaction-") &&
      path.basename(String(filename)).startsWith("next-")
    ) {
      injected = true;
      await write(
        path.join(target, "portfolio.json"),
        prepared.profileSource + "\n",
      );
    }
    return result;
  });
  await assert.rejects(
    publishContent(prepared, target),
    /changed after preparation/,
  );
  assert.ok(injected);
  assert.equal(
    await fs.readFile(path.join(target, "portfolio.json"), "utf8"),
    prepared.profileSource + "\n",
  );
  await assert.rejects(
    fs.access(path.join(target, ".generated/publication.json")),
    { code: "ENOENT" },
  );
});

test("unchanged generated text retains its timestamp", async (t) => {
  const { target } = await fixture(t);
  const filename = path.join(target, "src/portfolio/template.generated.ts");
  await fs.writeFile(filename, "same");
  await fs.utimes(filename, 1000, 1000);
  await commitGeneratedOutputs(target, [
    { target: "src/portfolio/template.generated.ts", contents: "same" },
  ]);
  assert.equal((await fs.stat(filename)).mtimeMs, 1000000);
});

test("generated view and slot graphs stay independent and schema slot names agree", async () => {
  const outputs = extensionOutputs(resolveExtensions(demo));
  const metadata = outputs.find((item) =>
    item.target.endsWith("/template.generated.ts"),
  );
  assert.doesNotMatch(metadata.contents, /@\/templates|ActiveView/);
  const layout = outputs.find((item) =>
    item.target.endsWith("template-layout.generated.ts"),
  );
  assert.match(layout.contents, /classic\/layout/);
  assert.doesNotMatch(layout.contents, /home|blog/);
  const schema = JSON.parse(
    await fs.readFile(path.join(root, "portfolio.schema.json"), "utf8"),
  );
  assert.deepEqual(
    schema.properties.plugins.additionalProperties.properties.slot.enum.toSorted(),
    Object.keys(points.slots).toSorted(),
  );
});

test("dry-run cannot silently execute setup", () => {
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ["scripts/folio.mjs", "setup", "--dry-run"],
        { cwd: root, stdio: "pipe" },
      ),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(String(error.stderr), /--dry-run is only supported/);
      return true;
    },
  );
});

test("personalization never overwrites author assets and cleans failed additions", async (t) => {
  const { target } = await fixture(t);
  const directory = path.join(target, "content/assets/portfolio/profile");
  await fs.mkdir(directory, { recursive: true });
  const authored = path.join(directory, "portrait-placeholder.svg");
  await fs.writeFile(authored, "author portrait");
  let saved;
  await withPlaceholderAssets(target, "A&B", async (assets, lease) => {
    saved = assets;
    await updateProfile(
      target,
      (profile) => {
        profile.hero.portraits = [assets.portrait];
        profile.site.assets.socialPreview = assets.socialPreview;
        profile.site.assets.icon = assets.icon;
        profile.site.assets.appleTouchIcon = assets.icon;
        return profile;
      },
      { lease },
    );
  });
  const names = await fs.readdir(directory);
  assert.equal(await fs.readFile(authored, "utf8"), "author portrait");
  const portrait = path.join(target, "content/assets", saved.portrait.slice(1));
  assert.match(await fs.readFile(portrait, "utf8"), /A&amp;B/);
  assert.equal(
    await fs.readFile(
      path.join(target, "public", saved.portrait.slice(1)),
      "utf8",
    ),
    await fs.readFile(portrait, "utf8"),
  );
  await assert.rejects(
    withPlaceholderAssets(target, "NEW", () => {
      throw new Error("invalid profile");
    }),
    /invalid profile/,
  );
  assert.deepEqual(await fs.readdir(directory), names);
  await fs.writeFile(portrait, "author changed generated placeholder");
  await assert.rejects(
    withPlaceholderAssets(target, "A&B", () => {}),
    /author changes/,
  );
  assert.equal(
    await fs.readFile(portrait, "utf8"),
    "author changed generated placeholder",
  );
  let recoveryAssets;
  await assert.rejects(
    withPlaceholderAssets(target, "RECOVER", async (assets) => {
      recoveryAssets = assets;
      await fs.writeFile(
        path.join(target, ".generated/profile-update.json"),
        "{}",
      );
      throw new Error("profile rollback failed");
    }),
    /profile rollback failed/,
  );
  await fs.access(
    path.join(target, "content/assets", recoveryAssets.portrait.slice(1)),
  );
  await fs.access(path.join(target, ".generated/project.lock"));
});

test("dependency boundaries resolve relative imports, reexports and dynamic imports", () => {
  for (const source of [
    'import x from "@/templates/classic/home";',
    'export { default } from "../../templates/classic/home";',
    'const x = import("../../templates/classic/home");',
    'import x from "../../portfolio/config.generated";',
    'import x from "@/portfolio";',
    'import x from "../../blog";',
    'import x from "@/demo";',
  ])
    assert.equal(
      extensionImportViolations("src/plugins/example/view.tsx", source).length,
      1,
    );
  assert.equal(
    extensionImportViolations(
      "src/templates/second/home.tsx",
      'import x from "../classic/home";',
    ).length,
    1,
  );
  assert.deepEqual(
    extensionImportViolations(
      "src/plugins/example/view.tsx",
      'import type { PluginProps } from "@/core/contracts"; import x from "./controls";',
    ),
    [],
  );
});
