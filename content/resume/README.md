# Resume source

`resume.json` in this folder is the single source for the resume PDF and for the
sheet shown by the resume printer. It is optional: a profile can instead ship
its own hand-made files under `content/assets/portfolio/`.

## Start one

1. Point `portfolio.json > site.resume` at the two files the build should
   write. They must be author assets under `/portfolio/`, and the preview must
   be PNG, JPEG or WebP:

   ```json
   {
     "site": {
       "resume": {
         "image": "/portfolio/resume/resume.png",
         "pdf": "/portfolio/resume/resume.pdf",
         "downloadName": "Resume.pdf"
       }
     }
   }
   ```

2. Create the source and render it:

   ```bash
   cp content/resume/resume.example.json content/resume/resume.json
   npm run resume:build
   ```

3. Commit `resume.json`, `resume.lock.json` and both generated files together.

If those two paths already hold files you made by hand, the build refuses to
touch them. Run `npm run resume:build -- --adopt` once to replace them with the
generated ones; after that they belong to the build.

## Keeping it current

Edit `resume.json` and run `npm run resume:build`. While `npm run dev` is
running, saving the file rebuilds the PDF and preview for you.

`resume.lock.json` records which source and template the committed files were
rendered from. `npm run content:check`, and therefore every production build,
fails when the source, the template or `site.resume` changed without a new
build, or when the lock and outputs were committed without the source. A stale
resume cannot be deployed.

The build renders only when the committed files are stale. A PDF records its
creation time, so rendering an unchanged source would only produce a different
file with the same content; `npm run resume:build -- --force` does that on
purpose, for example after a browser update.

## Format

`resume.schema.json` documents every field and gives editors autocomplete
through the `$schema` line. In short:

- `lang`, `name`, optional `headline`, `contact` and `links` form the masthead.
- `sections` are rendered in order. Each one is `text` (paragraphs), `entries`
  (titled items with an optional link, subtitle, date, badge, meta line and
  bullets) or `facts` (label and value rows, for skills or languages).
- Text accepts two inline marks: `**bold**` and `[label](https://…)`. Write `\*`
  for a literal asterisk. Links must be `https`, `http`, `mailto` or `tel`.

The source must be named exactly `resume.json`. A differently cased name, or a
lock left behind without its source, fails the check instead of being read on
one operating system and silently skipped on another.

The resume is one A4 page. Content that does not fit, downwards or past the
right margin, fails the build and says by how much, instead of silently
shrinking, clipping or spilling onto a second sheet.

## Rendering

`resume:build` uses the Chromium pinned by `playwright-core`
(`node node_modules/playwright-core/cli.js install chromium`) and requires Arial
or a metric-compatible face such as Liberation Sans. Text is laid out by glyph
advance width alone, so Latin text breaks identically on Windows, macOS and
Linux. Characters those fonts lack, such as CJK, fall back to the fonts of the
machine that runs the build.

The PDF is tagged, has an outline, and keeps its text layer in reading order
for screen readers and applicant tracking systems.

Everything in this folder is public once committed. Leave out anything you would
not publish on the site itself.
