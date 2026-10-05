import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  HREF_PATTERN,
  RESUME_LOCK,
  RESUME_RENDER,
  RESUME_SOURCE,
  checkResume,
  loadResume,
  parseInline,
  renderInline,
  renderResumeHtml,
  resolveResumeTargets,
  resumeGeometry,
  resumeLockFor,
  sha256,
} from "../scripts/resume-core.mjs";
import {
  exampleResume as example,
  resumeProfile,
  withResumeProject,
} from "./resume-sandbox.mjs";

const root = path.resolve(import.meta.dirname, "..");
const schema = JSON.parse(
  await fs.readFile(path.join(root, "resume.schema.json"), "utf8"),
);
const profile = resumeProfile();

/** Commits a lock and placeholder outputs the way `resume:build` would. */
async function commitOutputs(project, config = profile) {
  const loaded = await loadResume(project);
  const targets = resolveResumeTargets(project, config);
  const outputs = { pdf: Buffer.from("%PDF-test"), image: Buffer.from("png") };
  for (const [kind, target] of Object.entries(targets)) {
    await fs.mkdir(path.dirname(target.file), { recursive: true });
    await fs.writeFile(target.file, outputs[kind]);
  }
  const lock = resumeLockFor({
    fingerprint: loaded.fingerprint,
    targets,
    outputs,
    generator: { browser: "test", platform: "test" },
  });
  await fs.writeFile(path.join(project, RESUME_LOCK), JSON.stringify(lock));
  return { targets, lock };
}

test("inline text supports bold, safe links and an escaped asterisk", () => {
  assert.equal(
    renderInline("Shipped **Crew** on [Play](https://example.com/a?b=1&c=2)."),
    'Shipped <strong>Crew</strong> on <a href="https://example.com/a?b=1&amp;c=2">Play</a>.',
  );
  assert.equal(
    renderInline("**[Docs](mailto:hi@example.com) & <more>**"),
    '<strong><a href="mailto:hi@example.com">Docs</a> &amp; &lt;more&gt;</strong>',
  );
  assert.equal(
    renderInline(
      "[Rust](https://en.wikipedia.org/wiki/Rust_(programming_language)).",
    ),
    '<a href="https://en.wikipedia.org/wiki/Rust_(programming_language)">Rust</a>.',
  );
  assert.deepEqual(parseInline("C# [beta] (2026)"), [
    { type: "text", text: "C# [beta] (2026)" },
  ]);
  assert.equal(
    renderInline(String.raw`char\*\* argv, \*\*kwargs`),
    "char** argv, **kwargs",
  );
  assert.equal(
    renderInline(String.raw`[glob](https://example.com/a\*b)`),
    '<a href="https://example.com/a*b">glob</a>',
  );
});

test("inline mistakes fail instead of reaching the document", () => {
  assert.throws(() => parseInline("a stray ** marker"), /Unbalanced/);
  // Markdown's flanking rule: operators are not emphasis.
  assert.throws(() => parseInline("2 ** 3 ** 4"), /Unbalanced/);
  assert.throws(() => parseInline("***loud***"), /Unbalanced/);
  assert.throws(
    () => parseInline("[**Play Store**](https://example.com)"),
    /Bold inside a link label/,
  );
  // An attempted link that does not parse must not be printed as Markdown.
  for (const attempt of [
    "[x](https://example.com/a b)",
    "[](https://example.com)",
    "[x]()",
    "[x](https://example.com/(a(b)))",
  ])
    assert.throws(() => parseInline(attempt), /Malformed link/, attempt);
  for (const href of [
    "javascript:alert(1)",
    "/relative",
    "example.com",
    "HTTPS://EXAMPLE.com",
    "http:example.com",
    "mailto:",
    "data:text/html,x",
  ])
    assert.throws(() => parseInline(`[x](${href})`), /absolute https/, href);
});

test("inline links and schema links accept exactly the same targets", () => {
  assert.equal(schema.$defs.href.pattern, HREF_PATTERN);
});

test("the bundled example is a valid, self-contained document in reading order", () =>
  withResumeProject(example, async (project) => {
    const { html } = await loadResume(project);
    const order = [
      "<h1>Your Name</h1>",
      "<h2>Profile</h2>",
      "<h2>Experience</h2>",
      "<strong>Example Studio</strong> — Senior Product Designer</h3>",
      '<span class="date">2024 — Present</span>',
      "Lead with the result",
      "<strong>Previous Company</strong>",
      "Describe one shipped project",
      "<h2>Selected projects</h2>",
      "<h2>Languages</h2>",
    ].map((needle) => {
      const index = html.indexOf(needle);
      assert.notEqual(index, -1, `missing ${needle}`);
      return index;
    });
    assert.deepEqual(
      order,
      order.toSorted((a, b) => a - b),
    );
    // Headings stay clean for the PDF outline; the chip is a sibling.
    assert.match(html, /<\/h3><span class="badge">Open source<\/span>/);
    assert.match(html, /<html lang="en">/);
    assert.doesNotMatch(html, /<script|<link|<img|@import|url\(|src=/i);
  }));

test("the template never takes text out of normal flow", () => {
  // Boxes that are positioned, transformed, floated, reordered or given their
  // own compositing layer paint after normal flow, and a PDF text layer
  // follows paint order: one `position: relative` on list items moves every
  // bullet to the end of the extracted text. The browser suite checks the
  // computed styles; this keeps the rule enforced where no browser exists.
  const style = renderResumeHtml(example).match(
    /<style>([\s\S]*?)<\/style>/,
  )[1];
  assert.doesNotMatch(
    style,
    /(?<![-\w])(position|transform|float|z-index|order|opacity|filter|will-change|isolation|mix-blend-mode|contain)\s*:/,
  );
});

test("page geometry has one source", () => {
  assert.deepEqual(resumeGeometry(), {
    sheet: { width: 794, height: 1123 },
    preview: { width: 1240, height: 1754 },
  });
  const { widthMm, heightMm } = RESUME_RENDER.page;
  const html = renderResumeHtml(example);
  assert.ok(html.includes(`@page { size: ${widthMm}mm ${heightMm}mm;`));
  assert.ok(html.includes(`.page { width: ${widthMm}mm;`));
});

test("the renderer rejects values that would escape the stylesheet", () => {
  assert.throws(
    () =>
      renderResumeHtml({
        ...example,
        accentColor: "red}</style><script>alert(1)</script>",
      }),
    /accentColor must be #RRGGBB/,
  );
  assert.ok(
    renderResumeHtml({ ...example, accentColor: "#AA3300" }).includes(
      "a { color: #AA3300;",
    ),
  );
});

test("schema errors name the author's mistake, not every other section shape", async () => {
  const typo = structuredClone(example);
  typo.sections[1].entries[0].subtitel = "Designer";
  typo.sections[0].type = "gallery";
  delete typo.name;
  await withResumeProject(typo, async (project) => {
    await assert.rejects(loadResume(project), (error) => {
      assert.deepEqual(error.message.split(/\n/), [
        "Invalid resume in content/resume/resume.json:",
        "- / must have required property 'name'",
        "- /sections/0/type must be one of text, entries, facts",
        "- /sections/1/entries/0 must NOT have additional properties: subtitel",
      ]);
      return true;
    });
    await fs.writeFile(path.join(project, RESUME_SOURCE), "{ not json");
    await assert.rejects(loadResume(project), /resume\.json is not valid JSON/);
  });
});

test("the resume schema rejects unknown shapes and accepts real language tags", async () => {
  for (const resume of [
    { ...example, sections: [] },
    { ...example, extra: true },
    { ...example, lang: "English" },
    { ...example, lang: "en-" },
    { ...example, links: [{ label: "Site", href: "javascript:alert(1)" }] },
  ])
    await withResumeProject(resume, (project) =>
      assert.rejects(loadResume(project), /Invalid resume/),
    );
  for (const lang of ["it", "zh-Hans-CN", "de-DE-u-co-phonebk", "en-x-a"])
    await withResumeProject({ ...example, lang }, async (project) =>
      assert.ok((await loadResume(project)).html.includes(`lang="${lang}"`)),
    );
});

test("generation targets come from site.resume and cannot leave author storage", () => {
  const targets = resolveResumeTargets("/project", profile);
  assert.equal(targets.pdf.asset, "/portfolio/resume/resume.pdf");
  assert.equal(
    targets.image.file,
    path.join(
      "/project",
      "content",
      "assets",
      "portfolio",
      "resume",
      "resume.png",
    ),
  );
  assert.throws(
    () =>
      resolveResumeTargets(
        "/project",
        resumeProfile("/assets/demo/resume.svg"),
      ),
    /under \/portfolio\//,
  );
  assert.throws(
    () =>
      resolveResumeTargets(
        "/project",
        resumeProfile("/portfolio/resume/resume.svg"),
      ),
    /PNG, JPEG or WebP/,
  );
  // The target is also where the build writes.
  for (const image of [
    "/portfolio/../../outside.png",
    "/portfolio/resume/../../../../outside.png",
    "/portfolio/resume/resume.png?v=2",
    "/portfolio/resume/my resume.png",
    "/portfolio/resume\\resume.png",
  ])
    assert.throws(
      () => resolveResumeTargets("/project", resumeProfile(image)),
      /Unsafe asset path|canonical author asset/,
      image,
    );
});

test("a profile without a resume source is left alone", () =>
  withResumeProject(null, async (project) => {
    const directory = path.join(project, path.dirname(RESUME_SOURCE));
    assert.equal(await loadResume(project), null);
    assert.deepEqual(await checkResume(project, profile), { status: "absent" });
    // Neither the shared files on every branch nor unrelated files an editor
    // or operating system leaves behind count as a source.
    for (const name of [
      "README.md",
      "resume.example.json",
      ".DS_Store",
      "notes.txt",
    ])
      await fs.writeFile(path.join(directory, name), "{}");
    assert.equal((await checkResume(project, profile)).status, "absent");
    await fs.rm(directory, { recursive: true });
    assert.equal((await checkResume(project, profile)).status, "absent");
  }));

test("an ambiguous absence fails instead of skipping the check", () =>
  withResumeProject(example, async (project) => {
    await commitOutputs(project);

    // The lock and outputs were committed but the source was not.
    await fs.rm(path.join(project, RESUME_SOURCE));
    await assert.rejects(
      checkResume(project, profile),
      /contains resume\.lock\.json but no resume\.json/,
    );

    // A name the case-sensitive CI filesystem would not find.
    await fs.rm(path.join(project, RESUME_LOCK));
    await fs.writeFile(
      path.join(project, path.dirname(RESUME_SOURCE), "Resume.JSON"),
      JSON.stringify(example),
    );
    await assert.rejects(
      checkResume(project, profile),
      /contains Resume\.JSON but no resume\.json/,
    );
  }));

test("stale resume output fails closed", () =>
  withResumeProject(example, async (project) => {
    const source = path.join(project, RESUME_SOURCE);
    const lockFile = path.join(project, RESUME_LOCK);
    await assert.rejects(
      checkResume(project, profile),
      /missing or unreadable/,
    );

    const { targets, lock } = await commitOutputs(project);
    assert.deepEqual(await checkResume(project, profile), {
      status: "current",
    });

    // Reformatting the source is not a change; editing its content is.
    await fs.writeFile(source, JSON.stringify(example, null, 4));
    assert.equal((await checkResume(project, profile)).status, "current");
    await fs.writeFile(
      source,
      JSON.stringify({ ...example, headline: "Staff Designer" }),
    );
    await assert.rejects(checkResume(project, profile), /template changed/);
    await fs.writeFile(source, JSON.stringify(example));

    await fs.writeFile(targets.pdf.file, "%PDF-hand-edited");
    await assert.rejects(
      checkResume(project, profile),
      /resume\.pdf does not match content\/resume\/resume\.lock\.json/,
    );
    await commitOutputs(project);

    const moved = structuredClone(profile);
    moved.site.resume.pdf = "/portfolio/resume/cv.pdf";
    await assert.rejects(
      checkResume(project, moved),
      /site\.resume points at different files/,
    );

    for (const broken of [
      "{ truncated",
      "null",
      "[]",
      '{"fingerprint":"x"}',
      JSON.stringify({ ...lock, outputs: null }),
      JSON.stringify({ ...lock, outputs: [] }),
    ])
      await fs
        .writeFile(lockFile, broken)
        .then(() =>
          assert.rejects(
            checkResume(project, profile),
            /missing or unreadable/,
            broken,
          ),
        );
    await fs.writeFile(lockFile, JSON.stringify(lock));

    await fs.rm(targets.image.file);
    await assert.rejects(
      checkResume(project, profile),
      /resume\.png is missing/,
    );
  }));

test("the lock records the fingerprint and output hashes by asset path", () =>
  withResumeProject(example, async (project) => {
    const { lock } = await commitOutputs(project);
    assert.deepEqual(Object.keys(lock), [
      "fingerprint",
      "outputs",
      "generator",
    ]);
    assert.deepEqual(lock.outputs, {
      "/portfolio/resume/resume.pdf": { sha256: sha256("%PDF-test") },
      "/portfolio/resume/resume.png": { sha256: sha256("png") },
    });
  }));
