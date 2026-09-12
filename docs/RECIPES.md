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

With `npm run dev` already running, saving the file automatically rebuilds the article index and route. It becomes `/blogs/building-my-app`; `/blogs` appears automatically as soon as at least one post is published.

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

Put the preview and PDF under `content/assets/portfolio/resume/`, then set:

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

Keep `features.resume: true`.

## Disable a section without deleting its author content

Set the corresponding `features` flag to `false`. Disabled content stays in the source profile but is stripped from the published runtime configuration and unused author assets are not copied to `public/portfolio/`.

## Deploy

Set `site.origin` in `portfolio.json` to the real production origin, then run:

```bash
npm run check
npm run audit:prod
npm run qa:maintainer
```

FolioWeave uses standard Next.js deployment conventions. Vercel can use the normal Next.js preset; other compatible hosts can use their standard Next.js integration. Repository visibility and deployment visibility are separate concerns.

For the public `main`/`develop` starter and public `personal` profile workflow, follow [REPOSITORY-MODEL.md](REPOSITORY-MODEL.md).

## Validate a content edit

Fast path:

```bash
npm run content:check
```

Release path:

```bash
npm run check
npm run audit:prod
npm run qa:maintainer
```

If visual regression fails, inspect the cause. Do not update baselines until the visual difference is understood and explicitly accepted.
