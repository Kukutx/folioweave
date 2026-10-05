import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright-core";
import sharp from "sharp";
import {
  assertResumeFonts,
  buildResume,
  renderResume,
} from "../scripts/resume-build.mjs";
import {
  checkResume,
  loadResume,
  resolveResumeTargets,
  resumeGeometry,
} from "../scripts/resume-core.mjs";
import {
  exampleResume as example,
  resumeProfile,
  withResumeProject,
} from "./resume-sandbox.mjs";

const profile = resumeProfile();

/** The example with its first experience entry changed. */
function withEntry(change) {
  const resume = structuredClone(example);
  const experience = resume.sections.find(
    (section) => section.type === "entries",
  );
  change(experience.entries[0], experience);
  return resume;
}

test("the example builds one tagged A4 page and a printer preview", () =>
  withResumeProject(example, async (project) => {
    const { status, targets, fill } = await buildResume(project);
    assert.equal(status, "built");
    assert.ok(fill > 0.3 && fill <= 1, `unexpected page fill ${fill}`);

    const pdf = (await fs.readFile(targets.pdf.file)).toString("latin1");
    assert.ok(pdf.startsWith("%PDF-"), "output is not a PDF");
    assert.equal(pdf.match(/\/Type\s*\/Page\b(?!s)/g)?.length, 1);
    assert.match(pdf, /\/StructTreeRoot/, "PDF is not tagged");
    assert.match(pdf, /\/Outlines/, "PDF has no outline");
    assert.match(pdf, /\/Lang\s*\(en\)/, "PDF language is missing");

    const preview = await sharp(
      await fs.readFile(targets.image.file),
    ).metadata();
    assert.equal(preview.format, "png");
    assert.deepEqual(
      { width: preview.width, height: preview.height },
      resumeGeometry().preview,
    );

    assert.equal((await checkResume(project, profile)).status, "current");
    assert.deepEqual(
      (await fs.readdir(path.dirname(targets.pdf.file))).sort(),
      ["resume.pdf", "resume.png"],
      "the build left files beside its outputs",
    );
    assert.deepEqual(
      await fs.readdir(path.join(project, ".generated")),
      [],
      "the staging directory was not removed",
    );

    // A PDF embeds its creation time; an unchanged source must not rewrite it.
    const before = await fs.readFile(targets.pdf.file);
    assert.equal((await buildResume(project)).status, "current");
    assert.ok(before.equals(await fs.readFile(targets.pdf.file)));
    assert.equal((await buildResume(project, { force: true })).status, "built");
  }));

test("lossy preview formats follow the configured extension", async () => {
  for (const [extension, format] of [
    [".webp", "webp"],
    [".jpg", "jpeg"],
  ])
    await withResumeProject(
      example,
      async (project) => {
        const { targets } = await buildResume(project);
        const preview = await sharp(
          await fs.readFile(targets.image.file),
        ).metadata();
        assert.equal(preview.format, format);
        assert.equal(preview.width, resumeGeometry().preview.width);
      },
      resumeProfile(`/portfolio/resume/resume${extension}`),
    );
});

test("hand-made resume files are replaced only when adopted", () =>
  withResumeProject(example, async (project) => {
    const targets = resolveResumeTargets(project, profile);
    await fs.mkdir(path.dirname(targets.pdf.file), { recursive: true });
    await fs.writeFile(targets.pdf.file, "%PDF-hand-made");

    await assert.rejects(
      buildResume(project),
      /resume\.pdf already exists and was not produced by the resume build/,
    );
    assert.equal(
      await fs.readFile(targets.pdf.file, "utf8"),
      "%PDF-hand-made",
      "a refused build must not touch the author's file",
    );

    assert.equal((await buildResume(project, { adopt: true })).status, "built");
    assert.equal((await checkResume(project, profile)).status, "current");

    // Once generated, later edits rebuild without the flag.
    await fs.writeFile(
      path.join(project, "content/resume/resume.json"),
      JSON.stringify({ ...example, headline: "Staff Designer" }),
    );
    assert.equal((await buildResume(project)).status, "built");
  }));

test("content that does not fit the sheet fails without writing output", async () => {
  const cases = [
    [
      withEntry((entry, section) => {
        section.entries = Array.from({ length: 14 }, () => entry);
      }),
      /does not fit one A4 page: content is \d+\.\dmm too long/,
    ],
    [
      // Nothing can wrap a non-breaking date, so it has to be reported.
      withEntry((entry) => {
        entry.date = "January 2024 — Present ".repeat(8).trim();
      }),
      /runs \d+\.\dmm past the right margin near "January 2024/,
    ],
  ];
  for (const [resume, expected] of cases)
    await withResumeProject(resume, async (project) => {
      await assert.rejects(buildResume(project), expected);
      await assert.rejects(
        fs.access(path.join(project, "content/assets/portfolio/resume")),
        "a rejected resume must not be published",
      );
    });
});

test("long unbreakable text wraps inside the page", () =>
  withResumeProject(
    withEntry((entry) => {
      entry.bullets = [`See ${"averyveryverylongtoken".repeat(12)} for more.`];
    }),
    async (project) => {
      assert.equal((await buildResume(project)).status, "built");
      // Wrapping is what keeps it inside. Without it the word overflows its
      // list item while every element box stays in place, so the check has to
      // measure the text itself.
      const { html } = await loadResume(project);
      assert.ok(html.includes("overflow-wrap: anywhere;"));
      await assert.rejects(
        renderResume(html.replace("overflow-wrap: anywhere;", "")),
        /past the right margin near "See averyvery/,
      );
    },
  ));

test("the rendered document keeps every box in normal flow", () =>
  withResumeProject(example, async (project) => {
    // The computed truth behind the stylesheet rule: anything listed here
    // paints out of document order and would reorder the PDF text layer.
    const { html } = await loadResume(project);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html);
      await page.emulateMedia({ media: "print" });
      const promoted = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .map((element) => {
            const style = getComputedStyle(element);
            const reasons = Object.entries({
              position: style.position !== "static",
              transform: style.transform !== "none",
              float: style.float !== "none",
              opacity: style.opacity !== "1",
              filter: style.filter !== "none",
              order: style.order !== "0",
              zIndex: style.zIndex !== "auto",
              willChange: style.willChange !== "auto",
              isolation: style.isolation !== "auto",
              blend: style.mixBlendMode !== "normal",
            })
              .filter(([, promotes]) => promotes)
              .map(([reason]) => reason);
            return reasons.length
              ? `${element.tagName.toLowerCase()}.${element.className}: ${reasons.join(", ")}`
              : null;
          })
          .filter(Boolean),
      );
      assert.deepEqual(promoted, []);
    } finally {
      await browser.close();
    }
  }));

test("rendering fetches nothing", async () => {
  let requests = 0;
  const server = http.createServer((_request, response) => {
    requests += 1;
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { html } = await withResumeProject(example, loadResume);
    const beacon = `<img src="http://127.0.0.1:${server.address().port}/beacon.png" alt="">`;
    await renderResume(html.replace("</main>", `${beacon}</main>`));
    assert.equal(requests, 0, "the renderer let a network request through");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("only Arial-compatible metrics are accepted", () => {
  assertResumeFonts({ 400: 36458.0078125, 700: 38008.7890625 });
  // What Chromium reports when the stack falls through to a default serif.
  assert.throws(
    () => assertResumeFonts({ 400: 34775.87890625, 700: 38008.7890625 }),
    /Arial-compatible metrics at weight 400/,
  );
  assert.throws(() => assertResumeFonts({}), /Arial-compatible metrics/);
});
