# Common FolioWeave recipes

These are the normal extension paths. None require editing generated files.

## Add a project

Put artwork in:

```text
content/assets/portfolio/projects/my-app/
```

Add an item to `portfolio.json > projects`:

```json
{
  "id": "my-app",
  "enabled": true,
  "mobileTreatment": "standard",
  "name": "My App",
  "date": "2026 — Present",
  "description": "What the product is and what I owned.",
  "icon": "/portfolio/projects/my-app/icon.png",
  "media": {
    "kind": "image",
    "image": {
      "src": "/portfolio/projects/my-app/main.webp",
      "alt": "My App interface"
    }
  },
  "actions": [
    {
      "label": "View project",
      "href": "https://example.com",
      "icon": "arrow"
    }
  ]
}
```

For multiple images use `media.kind: "carousel"`. Use a `mobile` image only when it is genuinely different artwork, not merely a smaller copy.

## Add photography

Put originals under `content/assets/portfolio/photography/`, then append to `portfolio.json > photography.images`:

```json
{
  "src": "/portfolio/photography/photo-19.webp",
  "alt": "A useful description of the photograph"
}
```

Photography images have a 2 MiB source limit. Their displayed geometry is measured from the file automatically.

## Add a Blog post

Create `content/blogs/building-my-app.md`:

```md
---
title: "Building My App"
date: "2026-09-12"
description: "What I learned while building it."
tags:
  - Engineering
  - Product
draft: false
---

## Why I built it

Write normal Markdown here.
```

With `npm run dev` already running, saving the file automatically rebuilds the article index and route. It becomes `/blogs/building-my-app`; `/blogs` appears automatically as soon as at least one post is published. Each tag also gets its own page, here `/blogs/tag/engineering` and `/blogs/tag/product`.

Put article media under a portfolio asset folder, for example:

```text
content/assets/portfolio/blogs/building-my-app/cover.webp
```

and reference it as `/portfolio/blogs/building-my-app/cover.webp`.

Set `draft: true` to keep the post out of routes, sitemap, index, browser QA, and publication output.

## Customize the Blog heading

`portfolio.json > blog` supports a plain default:

```json
{
  "title": "Writing",
  "description": "Notes about software and products."
}
```

For an editorial heading with highlights:

```json
{
  "title": "Writing",
  "heading": "Field Notes",
  "description": "Notes about software and products.",
  "intro": [
    { "text": "Notes on " },
    { "text": "engineering", "tone": "highlight" },
    { "text": " and product craft." }
  ]
}
```

`title` remains the metadata title; `heading` is optional visible copy.

## Replace the resume

Point `portfolio.json` at the two resume files and keep `features.resume: true`:

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

Then choose how those files are produced.

**Generate them from one source (recommended).** Write the resume once and let FolioWeave render both the PDF and the printer preview:

```bash
cp content/resume/resume.example.json content/resume/resume.json
npm run resume:build
```

Edit `content/resume/resume.json`, run `npm run resume:build`, and commit the source, `resume.lock.json`, the PDF and the preview together. With `npm run dev` running, saving the source rebuilds them for you. A build whose resume files no longer match the source fails `content:check`, so the site cannot publish an outdated resume.

The build never overwrites a file it did not produce. If `site.resume` already points at a hand-made PDF or preview, run `npm run resume:build -- --adopt` once to hand those two paths over. See [content/resume/README.md](../content/resume/README.md) for the format.

**Bring your own files.** Put a preview image and PDF under `content/assets/portfolio/resume/` and leave `content/resume/resume.json` out. Keeping the two in sync is then up to you.

## Disable a section without deleting its author content

Set the corresponding `features` flag to `false`. Disabled content stays in the source profile but is stripped from the published runtime configuration and unused author assets are not copied to `public/portfolio/`.

## Deploy

Set `site.origin` in `portfolio.json` to the real production origin, then run:

```bash
npm run build
```

If it passes, the site is deployable.

FolioWeave uses standard Next.js deployment conventions. Vercel can use the normal Next.js preset; other compatible hosts can use their standard Next.js integration. Repository visibility and deployment visibility are separate concerns.

For the public `main`/`develop` starter and public `personal` profile workflow, follow [REPOSITORY-MODEL.md](REPOSITORY-MODEL.md).

## Validate a content edit

Fast path:

```bash
npm run content:check
```

Release path:

```bash
npm run build
```

Shared-code changes go through `npm run check` and the suites in
[COMMANDS.md](COMMANDS.md) instead. If visual regression fails, inspect the cause. Do not update baselines until the visual difference is understood and explicitly accepted.
