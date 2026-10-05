import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import { localAssetPath } from "../src/portfolio/content-policy.mjs";

/**
 * Browser-free half of the resume pipeline. The PDF and printer preview are
 * rendered once by `resume:build` on an author machine and committed; every
 * other build only proves, through the fingerprint below, that those committed
 * files still describe the current source and template.
 */
export const RESUME_DIRECTORY = "content/resume";
export const RESUME_SOURCE = `${RESUME_DIRECTORY}/resume.json`;
export const RESUME_LOCK = `${RESUME_DIRECTORY}/resume.lock.json`;
export const RESUME_SCHEMA = "resume.schema.json";

/**
 * Everything besides the HTML that decides the output bytes. The stylesheet
 * and `resume:build` read their page, capture and encoding settings from here
 * and it is part of the fingerprint, so changing a value marks every committed
 * resume stale. Bump `version` when the build applies them differently.
 */
export const RESUME_RENDER = Object.freeze({
  version: 1,
  page: { widthMm: 210, heightMm: 297 },
  // The sheet is captured at this multiple of 96 dpi, then resampled.
  captureScale: 2,
  // Resolution of the preview that the resume printer displays.
  previewDpi: 150,
  pdf: {
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
    outline: true,
  },
  resample: { fit: "fill", kernel: "lanczos3" },
  // Text on white: an undithered palette is visually lossless and about a
  // third of the truecolor size, which matters because the printer loads it
  // as-is.
  png: { palette: true, colors: 256, dither: 0, effort: 10 },
  lossyQuality: 92,
});

/** Pixel sizes of the page at capture (96 dpi) and preview resolution. */
export function resumeGeometry() {
  const { page, previewDpi } = RESUME_RENDER;
  const at = (dpi) => ({
    width: Math.round((page.widthMm / 25.4) * dpi),
    height: Math.round((page.heightMm / 25.4) * dpi),
  });
  return { sheet: at(96), preview: at(previewDpi) };
}

const PREVIEW_FORMATS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const SECTION_TYPES = ["text", "entries", "facts"];

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The `$defs.href` pattern of the schema, applied to links written inline. */
export const HREF_PATTERN = String.raw`^(https?://|mailto:|tel:)\S+$`;
const hrefPattern = new RegExp(HREF_PATTERN);

function safeHref(href) {
  if (!hrefPattern.test(href) || !URL.canParse(href))
    throw new Error(
      `Resume links must be absolute https, http, mailto or tel URLs; received ${href}`,
    );
  return href;
}

// `**bold**` must hug its text, as in Markdown, so `2 ** 3 ** 4` is not bold.
// A link target may contain one level of balanced parentheses, as in
// https://en.wikipedia.org/wiki/Rust_(programming_language).
const INLINE =
  /\*\*(?=\S)(.+?)(?<=\S)\*\*|\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;
// Stands in for an escaped asterisk while the text is tokenized.
const ESCAPED_ASTERISK = "\u{E000}";

/**
 * The inline subset is deliberately tiny: `**bold**`, `[label](href)` and `\*`
 * for a literal asterisk. Anything that looks like an attempt at either mark
 * but does not parse is rejected rather than printed, so a typo cannot reach
 * the PDF as raw Markdown.
 */
export function parseInline(text) {
  const literal = (value) => value.replaceAll(ESCAPED_ASTERISK, "*");
  const reject = (problem) => {
    throw new Error(
      `${problem} in resume text (write \\* for a literal asterisk): ${text}`,
    );
  };
  const parse = (source) => {
    const tokens = [];
    const plain = (value) => {
      if (!value) return;
      if (value.includes("**")) reject("Unbalanced **");
      if (value.includes("](")) reject("Malformed link");
      tokens.push({ type: "text", text: literal(value) });
    };
    let cursor = 0;
    for (const match of source.matchAll(INLINE)) {
      plain(source.slice(cursor, match.index));
      const [, strong, label, href] = match;
      if (strong !== undefined) {
        // `***x***` would otherwise leave stray asterisks on both sides.
        if (strong.startsWith("*") || strong.endsWith("*"))
          reject("Unbalanced **");
        tokens.push({ type: "strong", children: parse(strong) });
      } else {
        if (label.includes("**")) reject("Bold inside a link label");
        tokens.push({
          type: "link",
          href: safeHref(literal(href)),
          text: literal(label),
        });
      }
      cursor = match.index + match[0].length;
    }
    plain(source.slice(cursor));
    return tokens;
  };
  if (text.includes(ESCAPED_ASTERISK)) reject("Unsupported character");
  return parse(text.replaceAll("\\*", ESCAPED_ASTERISK));
}

export function renderInline(text) {
  const render = (tokens) =>
    tokens
      .map((token) =>
        token.type === "strong"
          ? `<strong>${render(token.children)}</strong>`
          : token.type === "link"
            ? `<a href="${escapeHtml(token.href)}">${escapeHtml(token.text)}</a>`
            : escapeHtml(token.text),
      )
      .join("");
  return render(parseInline(text));
}

/**
 * Arial-metric faces have the same advance widths on Windows, macOS and Linux,
 * and the stylesheet lays text out by advance width alone (no kerning, no
 * ligatures), so Latin text breaks identically on all three. Glyphs these
 * fonts lack, such as CJK, fall back to whatever the machine has.
 */
export const RESUME_FONT_STACK =
  'Arial, "Liberation Sans", Arimo, Helvetica, sans-serif';

/*
 * Two rules keep the PDF honest and are covered by tests:
 * - No box is positioned, transformed, floated or otherwise promoted. Those
 *   paint after normal flow and a PDF text layer follows paint order, so a
 *   single `position: relative` on list items moves every bullet to the end of
 *   the extracted text.
 * - Vertical rhythm uses padding where it must add up. Margins collapse
 *   through the section boundary and would silently drop the smaller one.
 */
const stylesheet = (accent) => {
  // The schema already restricts this; the renderer is also called directly.
  if (!/^#[0-9a-f]{6}$/i.test(accent))
    throw new Error(`Resume accentColor must be #RRGGBB; received ${accent}`);
  const { widthMm, heightMm } = RESUME_RENDER.page;
  return `
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
* { box-sizing: border-box; }
html { background: #fff; }
body {
  --ink: #1d1d1f;
  --muted: #6e6e73;
  --rule: #e8e8ed;
  margin: 0;
  color: var(--ink);
  font: 8.2pt/1.41 ${RESUME_FONT_STACK};
  font-kerning: none;
  font-variant-ligatures: none;
  overflow-wrap: anywhere;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  text-rendering: geometricPrecision;
}
a { color: ${accent}; text-decoration: none; }
p { margin: 0; }
.page { width: ${widthMm}mm; padding: 12.1mm 18.1mm 10mm 18mm; }

.masthead { display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm; padding-bottom: 1.9pt; }
h1 { margin: 0; font-size: 22pt; line-height: 1.32; letter-spacing: -0.012em; }
.headline { margin-top: 1.6pt; color: var(--muted); font-size: 10pt; line-height: 1.38; }
.reach { margin-bottom: 3.4pt; color: var(--muted); font-size: 7.85pt; line-height: 1.5; text-align: right; }
.contact .dot { margin: 0 0.42em; }
.links .dot { margin: 0 0.25em; }

section { margin-top: 11.1pt; }
section > p { padding-bottom: 0.9pt; font-size: 8.4pt; line-height: 1.47; }
h2 {
  margin: 0 0 5.5pt;
  padding-bottom: 5.2pt;
  border-bottom: 0.75pt solid var(--rule);
  color: var(--muted);
  font-size: 7.2pt;
  line-height: 1.2;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.entry + .entry { margin-top: 3.7pt; }
.entry-head { display: flex; align-items: baseline; gap: 0.7em; }
h3 { margin: 0; color: var(--muted); font-size: 8.8pt; font-weight: 400; line-height: 1.43; }
h3 strong, h3 strong a { color: var(--ink); font-weight: 700; }
.badge {
  flex: none;
  align-self: center;
  padding: 0.5pt 5.4pt;
  border: 0.5pt solid #dcdce1;
  border-radius: 3pt;
  background: #f5f5f7;
  color: var(--ink);
  font-size: 6.4pt;
  line-height: 1.5;
}
.date { flex: none; margin-left: auto; padding-left: 6mm; color: var(--muted); font-size: 7.4pt; white-space: nowrap; }
.meta { margin-top: 1pt; color: var(--muted); font-size: 7.4pt; line-height: 1.28; }
ul { margin: 1.9pt 0 0; padding: 0 0 1.9pt; list-style: none; }
.meta + ul { margin-top: 0.5pt; }
li { padding-left: 9.7pt; text-indent: -5pt; }
li + li { margin-top: 1pt; }
li::before { content: "•"; display: inline-block; width: 5pt; text-indent: 0; }

dl { display: grid; grid-template-columns: 94pt 1fr; row-gap: 2.9pt; margin: 0; padding-bottom: 3.8pt; font-size: 8pt; }
dt { font-weight: 700; }
dd { margin: 0; }
`;
};

const renderEntry = (entry) => {
  const title = entry.href
    ? `<a href="${escapeHtml(safeHref(entry.href))}">${escapeHtml(entry.title)}</a>`
    : escapeHtml(entry.title);
  return [
    '<div class="entry">',
    '<div class="entry-head">',
    // The chip and date are siblings so the heading stays clean in the outline.
    `<h3><strong>${title}</strong>${entry.subtitle ? ` — ${escapeHtml(entry.subtitle)}` : ""}</h3>`,
    entry.badge ? `<span class="badge">${escapeHtml(entry.badge)}</span>` : "",
    entry.date ? `<span class="date">${escapeHtml(entry.date)}</span>` : "",
    "</div>",
    entry.meta ? `<p class="meta">${renderInline(entry.meta)}</p>` : "",
    entry.bullets?.length
      ? `<ul>${entry.bullets.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`
      : "",
    "</div>",
  ].join("");
};

const renderSection = (section) => {
  const body =
    section.type === "text"
      ? section.paragraphs
          .map((text) => `<p>${renderInline(text)}</p>`)
          .join("")
      : section.type === "entries"
        ? section.entries.map(renderEntry).join("")
        : `<dl>${section.items.map((item) => `<dt>${escapeHtml(item.label)}</dt><dd>${renderInline(item.value)}</dd>`).join("")}</dl>`;
  return `<section><h2>${escapeHtml(section.title)}</h2>${body}</section>`;
};

/**
 * Pure and deterministic: the same source always yields the same document, in
 * reading order, so the PDF text layer stays usable by screen readers and ATS.
 */
export function renderResumeHtml(resume) {
  const dot = '<span class="dot">•</span>';
  const reach = [
    resume.contact?.length
      ? `<p class="contact">${resume.contact.map((text) => renderInline(text)).join(dot)}</p>`
      : "",
    resume.links?.length
      ? `<p class="links">${resume.links.map((link) => `<a href="${escapeHtml(safeHref(link.href))}">${escapeHtml(link.label)}</a>`).join(dot)}</p>`
      : "",
  ].join("");
  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(resume.lang)}">`,
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(resume.documentTitle ?? resume.name)}</title>`,
    `<style>${stylesheet(resume.accentColor ?? "#0066cc")}</style>`,
    "</head>",
    "<body>",
    '<main class="page">',
    '<header class="masthead">',
    `<div><h1>${escapeHtml(resume.name)}</h1>${resume.headline ? `<p class="headline">${escapeHtml(resume.headline)}</p>` : ""}</div>`,
    reach ? `<div class="reach">${reach}</div>` : "",
    "</header>",
    resume.sections.map(renderSection).join(""),
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export function resumeFingerprint(html) {
  return sha256(`${JSON.stringify(RESUME_RENDER)}\n${html}`);
}

async function readJson(root, name) {
  const text = await fs.readFile(path.join(root, name), "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${name} is not valid JSON: ${error.message}`);
  }
}

/**
 * `oneOf` checks a section against all three shapes and reports every mismatch
 * with the two it never claimed to be. Each section is re-validated against the
 * shape its `type` names, so the author sees only the mistake they made.
 */
function assertValidResume(resume, schema) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  const validate = ajv.compile(schema);
  if (!validate(resume)) {
    const describe = ({ instancePath, message, params }, prefix = "") =>
      `${prefix}${instancePath || (prefix ? "" : "/")} ${message}${params?.additionalProperty ? `: ${params.additionalProperty}` : ""}`;
    const problems = validate.errors
      .filter((error) => !error.instancePath.startsWith("/sections/"))
      .map((error) => describe(error));
    if (Array.isArray(resume?.sections))
      resume.sections.forEach((section, index) => {
        const pointer = `/sections/${index}`;
        if (!SECTION_TYPES.includes(section?.type)) {
          problems.push(
            `${pointer}/type must be one of ${SECTION_TYPES.join(", ")}`,
          );
          return;
        }
        const shape = ajv.compile({
          $defs: schema.$defs,
          $ref: `#/$defs/${section.type}Section`,
        });
        if (!shape(section))
          for (const error of shape.errors)
            problems.push(describe(error, pointer));
      });
    throw new Error(
      `Invalid resume in ${RESUME_SOURCE}:\n${[...new Set(problems)].map((problem) => `- ${problem}`).join("\n")}`,
    );
  }
  try {
    new Intl.Locale(resume.lang);
  } catch {
    throw new Error(
      `Invalid resume in ${RESUME_SOURCE}:\n- /lang is not a BCP 47 language tag: ${resume.lang}`,
    );
  }
}

/**
 * The source is optional, but its absence must be unambiguous: a lock without
 * a source, or a source the case-sensitive CI filesystem would not find, means
 * the check would otherwise be skipped exactly where it is meant to gate.
 */
async function hasResumeSource(root) {
  let entries;
  try {
    entries = await fs.readdir(path.join(root, RESUME_DIRECTORY));
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  const source = path.posix.basename(RESUME_SOURCE);
  const lock = path.posix.basename(RESUME_LOCK);
  if (entries.includes(source)) return true;
  // Unrelated files, such as an editor backup or .DS_Store, are not evidence
  // of a resume; a lock or a differently cased source is.
  const orphans = entries.filter(
    (entry) => entry === lock || entry.toLowerCase() === source,
  );
  if (orphans.length)
    throw new Error(
      `${RESUME_DIRECTORY}/ contains ${orphans.join(", ")} but no ${source}. The resume source must use exactly that name; remove the leftover files if the resume is no longer generated.`,
    );
  return false;
}

/** Returns null when the profile ships hand-made resume files instead. */
export async function loadResume(root) {
  if (!(await hasResumeSource(root))) return null;
  const resume = await readJson(root, RESUME_SOURCE);
  assertValidResume(resume, await readJson(root, RESUME_SCHEMA));
  const html = renderResumeHtml(resume);
  return { html, fingerprint: resumeFingerprint(html) };
}

/** The site decides where the resume is shown, so it also decides the outputs. */
export function resolveResumeTargets(root, config) {
  const resume = config?.site?.resume ?? {};
  const assets = path.join(root, "content", "assets", "portfolio");
  const targets = {};
  for (const [kind, asset] of [
    ["pdf", resume.pdf],
    ["image", resume.image],
  ]) {
    // The canonical-path rule the content build applies before it reads an
    // asset; here it also decides where the build is allowed to write.
    if (
      typeof asset !== "string" ||
      !asset.startsWith("/portfolio/") ||
      localAssetPath(asset) !== asset
    )
      throw new Error(
        `site.resume.${kind} must be a canonical author asset under /portfolio/ to be generated from ${RESUME_SOURCE}; received ${JSON.stringify(asset)}.`,
      );
    const file = path.join(root, "content", "assets", ...asset.split("/"));
    if (!file.startsWith(`${assets}${path.sep}`))
      throw new Error(`site.resume.${kind} resolves outside ${assets}.`);
    targets[kind] = { asset, file };
  }
  const extension = path.extname(targets.image.asset).toLowerCase();
  if (!PREVIEW_FORMATS.has(extension))
    throw new Error(
      `site.resume.image must be PNG, JPEG or WebP to be generated; received ${extension || "no extension"}.`,
    );
  if (path.extname(targets.pdf.asset).toLowerCase() !== ".pdf")
    throw new Error("site.resume.pdf must be a .pdf file.");
  return targets;
}

export function resumeLockFor({ fingerprint, targets, outputs, generator }) {
  return {
    fingerprint,
    outputs: {
      [targets.pdf.asset]: { sha256: sha256(outputs.pdf) },
      [targets.image.asset]: { sha256: sha256(outputs.image) },
    },
    // Provenance for a human reading the diff; the check does not depend on it.
    generator,
  };
}

/** The committed lock, or null when there is none or it cannot be read. */
export async function readResumeLock(root) {
  try {
    const lock = await readJson(root, RESUME_LOCK);
    const isRecord = (value) =>
      value !== null && typeof value === "object" && !Array.isArray(value);
    return isRecord(lock) && isRecord(lock.outputs) ? lock : null;
  } catch {
    return null;
  }
}

/**
 * Fails closed when the committed PDF or preview no longer matches the source,
 * the template, or the files the site is configured to show.
 */
export async function checkResume(root, config) {
  const loaded = await loadResume(root);
  if (!loaded) return { status: "absent" };
  const stale = (reason) =>
    new Error(`Resume output is stale: ${reason}. Run npm run resume:build.`);
  const targets = resolveResumeTargets(root, config);
  const lock = await readResumeLock(root);
  if (!lock) throw stale(`${RESUME_LOCK} is missing or unreadable`);
  if (lock.fingerprint !== loaded.fingerprint)
    throw stale(`${RESUME_SOURCE} or the resume template changed`);
  const expected = [targets.pdf.asset, targets.image.asset].sort();
  if (
    JSON.stringify(Object.keys(lock.outputs).sort()) !==
    JSON.stringify(expected)
  )
    throw stale("site.resume points at different files");
  for (const target of Object.values(targets)) {
    const bytes = await fs.readFile(target.file).catch(() => null);
    if (!bytes) throw stale(`${target.asset} is missing`);
    if (sha256(bytes) !== lock.outputs[target.asset]?.sha256)
      throw stale(`${target.asset} does not match ${RESUME_LOCK}`);
  }
  return { status: "current" };
}
