import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  collectAssets,
  localAssetPath,
  publishedPortfolio,
  validatePublicationLinks,
} from "../src/portfolio/content-policy.mjs";
import {
  prepareContent,
  publishContent,
  generatedOutputs,
} from "../scripts/content-build.mjs";
import { commitGeneratedOutputs } from "../scripts/atomic-output.mjs";

const root = path.resolve(import.meta.dirname, "..");
const personal = JSON.parse(
  await fs.readFile(path.join(root, "portfolio.json"), "utf8"),
);
const demo = JSON.parse(
  await fs.readFile(path.join(root, "governance/demo-portfolio.json"), "utf8"),
);

test("published asset bytes are the validated snapshot, not deferred source reads", async () => {
  const plan = await prepareContent(root, personal);
  const output = generatedOutputs(plan).find(
    (output) => output.target === "public/portfolio",
  );
  assert.ok(output.files.length > 0);
  for (const [name, bytes] of output.files) {
    assert.ok(
      Buffer.isBuffer(bytes),
      `${name} must be a validated byte snapshot`,
    );
    assert.equal(bytes.length, plan.media[`/portfolio/${name}`].bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      plan.media[`/portfolio/${name}`].sha256,
    );
  }
});

test("Markdown-only downloads are published; draft downloads stay in source", async () => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "folioweave-content-test-"),
  );
  try {
    const config = structuredClone(personal);
    config.features.resume = false;
    const downloadPath = "/portfolio/downloads/test.pdf";
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
    await fs.mkdir(path.join(temporary, "src/blog"), { recursive: true });
    await fs.writeFile(
      path.join(temporary, "src/blog/custom-posts.json"),
      "[]",
    );
    await fs.mkdir(path.join(temporary, "content/blogs"), { recursive: true });
    const downloadSource = path.join(
      temporary,
      "content/assets",
      downloadPath.slice(1),
    );
    await fs.mkdir(path.dirname(downloadSource), { recursive: true });
    await fs.writeFile(downloadSource, "%PDF-1.4\n% FolioWeave test download\n");
    const article = (draft) =>
      `---\ntitle: Download\ndate: 2026-01-01\ndescription: Test\ndraft: ${draft}\n---\n\n[Download](${downloadPath}#page=2)`;
    const filename = path.join(temporary, "content/blogs/download.md");
    await fs.writeFile(filename, article(false));
    const published = await prepareContent(temporary, config);
    assert.ok(published.media[downloadPath]);
    await publishContent(published, temporary);
    assert.deepEqual(
      await fs.readFile(path.join(temporary, "public", downloadPath.slice(1))),
      published.assets[downloadPath],
    );
    await fs.writeFile(filename, article(true));
    const draft = await prepareContent(temporary, config);
    assert.equal(draft.media[downloadPath], undefined);
    await publishContent(draft, temporary);
    await assert.rejects(
      fs.access(path.join(temporary, "public", downloadPath.slice(1))),
      { code: "ENOENT" },
    );
    await fs.access(downloadSource);
    await fs.writeFile(
      filename,
      article(false) + "\n\n[Broken](/blogs/unpublished)",
    );
    await assert.rejects(
      prepareContent(temporary, config),
      /unpublished route/,
    );
  } finally {
    assert.equal(path.dirname(temporary), os.tmpdir());
    assert.ok(path.basename(temporary).startsWith("folioweave-content-test-"));
    await fs.rm(temporary, { recursive: true });
  }
});

test("an incomplete rollback retains the journal and blocks further writers", async (t) => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "folioweave-content-test-"),
  );
  const rename = fs.rename;
  try {
    await fs.mkdir(path.join(temporary, "public/portfolio"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(temporary, "public/portfolio/old.txt"),
      "recover me",
    );
    await fs.mkdir(path.join(temporary, "src"));
    await fs.writeFile(path.join(temporary, "src/blog"), "obstruction");
    t.mock.method(fs, "rename", async (from, to) => {
      if (
        from === path.join(temporary, "public/portfolio") &&
        path.basename(to) === "next-0"
      )
        throw Object.assign(new Error("simulated locked output"), {
          code: "EACCES",
        });
      return rename(from, to);
    });
    await assert.rejects(
      commitGeneratedOutputs(temporary, [
        { target: "public/portfolio", files: [] },
        { target: "src/blog/posts.generated.ts", contents: "new" },
      ]),
      /rollback needs recovery/,
    );
    const lock = JSON.parse(
      await fs.readFile(
        path.join(temporary, ".generated/content.lock"),
        "utf8",
      ),
    );
    const journal = JSON.parse(
      await fs.readFile(path.join(lock.transaction, "journal.json"), "utf8"),
    );
    assert.equal(journal[0].target, path.join(temporary, "public/portfolio"));
    assert.equal(
      await fs.readFile(path.join(journal[0].backup, "old.txt"), "utf8"),
      "recover me",
    );
    await assert.rejects(commitGeneratedOutputs(temporary, []), {
      code: "EEXIST",
    });
  } finally {
    t.mock.restoreAll();
    assert.equal(path.dirname(temporary), os.tmpdir());
    assert.ok(path.basename(temporary).startsWith("folioweave-content-test-"));
    await fs.rm(temporary, { recursive: true });
  }
});

test("personal and demo profiles validate through the same pipeline", async () => {
  for (const config of [personal, demo]) {
    const plan = await prepareContent(root, config);
    assert.ok(plan.routes.includes("/"));
    assert.equal(plan.routes.includes("/district"), config.features.demoRoutes);
    assert.ok(
      Object.values(plan.media).every(
        (entry) => entry.bytes > 0 && entry.sha256.length === 64,
      ),
    );
  }
});

test("disabled content is retained in source but stripped from payload and publication", async () => {
  const config = structuredClone(personal);
  config.projects.forEach((project) => {
    project.enabled = false;
  });
  Object.assign(config.features, {
    about: false,
    photography: false,
    resume: false,
  });
  const plan = await prepareContent(root, config);
  const payload = publishedPortfolio(config);
  assert.deepEqual(payload.projects, []);
  assert.deepEqual(payload.about.story, []);
  assert.deepEqual(payload.photography.images, []);
  assert.equal(payload.site.resume.pdf, "");
  const live = collectAssets(payload);
  for (const asset of collectAssets(config.projects)) {
    if (!live.has(asset)) assert.equal(plan.media[asset], undefined, asset);
  }
});

test("unsafe paths and unpublished links fail before writing", async () => {
  for (const value of [
    "/../secret.png",
    "/%2e%2e/secret.png",
    "/foo\\secret.png",
  ]) {
    assert.throws(() => localAssetPath(value), /Unsafe/);
  }
  assert.equal(localAssetPath("//example.com/photo.png"), null);
  const config = structuredClone(personal);
  config.site.navigation.push({
    label: "Broken",
    href: "/unpublished",
    sectionId: null,
  });
  assert.throws(() => validatePublicationLinks(config), /unpublished/);
  config.features.work = "yes";
  await assert.rejects(prepareContent(root, config), /Invalid portfolio/);
});

test("profile image fields reject non-images and ambiguous path aliases", async () => {
  for (const image of ["/portfolio/resume/document.pdf", "/portfolio//photo.png", "/portfolio/photo.png?v=1", "/portfolio/%70hoto.png"]) {
    const config = structuredClone(personal);
    config.hero.portraits = [image];
    await assert.rejects(prepareContent(root, config), /Invalid portfolio/, image);
  }
});

test("publication removes old output without removing author sources", async () => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "folioweave-content-test-"),
  );
  try {
    await fs.mkdir(path.join(temporary, "public/portfolio"), {
      recursive: true,
    });
    await fs.mkdir(path.join(temporary, "content/assets/portfolio"), {
      recursive: true,
    });
    await fs.mkdir(path.join(temporary, "src/blog"), { recursive: true });
    await fs.writeFile(
      path.join(temporary, "public/portfolio/old.txt"),
      "old generated output",
    );
    await fs.writeFile(
      path.join(temporary, "content/assets/portfolio/draft.txt"),
      "author source",
    );
    await publishContent(
      { config: personal, media: {}, routes: ["/"], posts: [] },
      temporary,
    );
    assert.deepEqual(
      await fs.readdir(path.join(temporary, "public/portfolio")),
      [],
    );
    assert.equal(
      await fs.readFile(
        path.join(temporary, "content/assets/portfolio/draft.txt"),
        "utf8",
      ),
      "author source",
    );
  } finally {
    assert.equal(path.dirname(temporary), os.tmpdir());
    assert.ok(path.basename(temporary).startsWith("folioweave-content-test-"));
    await fs.rm(temporary, { recursive: true });
  }
});

test("an output failure restores previously replaced files", async () => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "folioweave-content-test-"),
  );
  try {
    await fs.mkdir(path.join(temporary, "public/portfolio"), {
      recursive: true,
    });
    await fs.mkdir(path.join(temporary, "src"));
    await fs.writeFile(
      path.join(temporary, "public/portfolio/old.txt"),
      "previous publication",
    );
    // A file in place of the parent directory forces failure after the first swap.
    await fs.writeFile(path.join(temporary, "src/blog"), "obstruction");
    await assert.rejects(
      commitGeneratedOutputs(temporary, [
        { target: "public/portfolio", files: [] },
        { target: "src/blog/posts.generated.ts", contents: "new output" },
      ]),
    );
    assert.equal(
      await fs.readFile(
        path.join(temporary, "public/portfolio/old.txt"),
        "utf8",
      ),
      "previous publication",
    );
    assert.equal(
      await fs.readFile(path.join(temporary, "src/blog"), "utf8"),
      "obstruction",
    );
    assert.deepEqual(await fs.readdir(path.join(temporary, ".generated")), []);
  } finally {
    assert.equal(path.dirname(temporary), os.tmpdir());
    assert.ok(path.basename(temporary).startsWith("folioweave-content-test-"));
    await fs.rm(temporary, { recursive: true });
  }
});
