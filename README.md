# FolioWeave

A polished, opinionated **Next.js 16 portfolio starter** for developers, designers, and creative professionals.

FolioWeave combines editorial storytelling, tactile software-like interactions, photography, project case studies, Markdown writing, and production QA. Day-to-day personalization stays in a deliberately small authoring surface; layout and interaction code remain reusable.

## Start here

Requirements: Node.js 24 and npm.

```bash
npm ci
npm run personalize
npm run dev
```

Open `http://localhost:3000`.

For the guided five-minute path, read [docs/QUICKSTART.md](docs/QUICKSTART.md).

## What you edit

Normal personalization uses three places:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
```

`portfolio.json` owns identity, location, links, Hero/About copy, projects, photography order, resume, Blog presentation, SEO, and feature switches.

`content/assets/portfolio/` owns original author media. Browser URLs remain `/portfolio/...`.

`content/blogs/` owns Markdown posts.

Do **not** edit `public/portfolio/`, `src/portfolio/*.generated.ts`, or `src/blog/posts.generated.ts`. They are validated publication output and are replaced by the content pipeline.

While `npm run dev` is running, valid changes to profile content, assets, Markdown, schema, custom-blog metadata, and the route registry are rebuilt automatically. Invalid content leaves the last valid generated output in place and prints the validation error.

## Highlights

- Responsive portfolio for desktop, tablet, and mobile
- Data-driven projects, photography, About content, resume, links, and feature switches
- Markdown Blog with automatic routes, index, reading time, metadata, sitemap, and drafts
- Motion-rich Hero, Work, Photography, Contact, Designer Cursors, camera, gallery/lightbox, and resume printer
- Server-first composition with focused client interaction islands
- Accessibility-minded keyboard/focus behavior and live reduced-motion support
- Atomic content publication with schema, route, asset, image, and link validation
- Runtime, bundle, browser, media, lifecycle, visual, and profile QA
- Chromium, Firefox, and WebKit release coverage
- Explicit reusable-core vs demo vs author-content boundaries

## Add content

### Project

Put source artwork under:

```text
content/assets/portfolio/projects/my-app/
```

then add the project to `portfolio.json > projects`. Image dimensions are measured automatically. Projects support single images, carousels, mobile art direction, actions, badges, and an optional editorial story.

### Photography

Add originals under `content/assets/portfolio/photography/` and reference them in `portfolio.json > photography.images`.

### Blog

Create `content/blogs/my-post.md`:

```md
---
title: "My post"
date: "2026-09-12"
description: "A short summary."
tags:
  - Engineering
draft: false
---

## A section

Normal Markdown.
```

It becomes `/blogs/my-post`. The Blog index appears automatically when at least one post is published. With local development already running, adding/removing the file updates the route without restarting Next.

See [docs/RECIPES.md](docs/RECIPES.md) for copyable examples.

## Architecture

FolioWeave separates four concerns:

```text
Reusable core
  src/components/
  src/config/
  src/content/
  src/hooks/
  src/lib/
  src/portfolio/
  src/styles/

Demo / examples
  src/demo/
  thin filesystem route entries under src/app/

Author inputs
  portfolio.json
  content/assets/portfolio/
  content/blogs/

Generated publication
  public/portfolio/
  src/portfolio/*.generated.ts
  src/blog/posts.generated.ts
```

Reusable modules are not allowed to depend on `src/demo/`; `npm run qa:boundary` enforces that rule.

The homepage remains intentionally opinionated rather than becoming a universal page-builder/plugin framework. Common author content is data-driven; genuinely new interaction or section types can remain explicit code.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full contracts.

## Design philosophy

FolioWeave combines:

- editorial storytelling;
- tactile software objects;
- playful system metaphors.

An approved visual is treated as a compatibility contract. Refactors and performance work must not silently redesign it. Visual baseline updates require an understood, intentional change rather than “making tests green.”

See [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) and [docs/VISUAL-QA.md](docs/VISUAL-QA.md).

## Validation

Fast content validation:

```bash
npm run content:check
```

Code/build validation:

```bash
npm run check
npm run audit:prod
```

Full release validation:

```bash
npm run qa:maintainer
```

The maintainer suite covers runtime budgets, interaction/accessibility, media health, bundle budgets, reusable fixtures, profile variants, visual regression, and Chromium/Firefox/WebKit.

## Deployment

FolioWeave uses standard Next.js deployment conventions. Vercel can use the normal Next.js preset; other platforms that support the current Next.js runtime can use their standard adapter.

Set `site.origin` in `portfolio.json` to the canonical production URL before release, and validate the production build.

## Public repository and personal profile

FolioWeave uses one public repository. `main`/`develop` keep the reusable starter
and canonical demo clean, while `personal` carries the maintained public author
profile and its media. The branch split protects template ownership, not privacy.

Only commit material intended for public access; secrets and confidential content
must stay outside Git history. See
[docs/REPOSITORY-MODEL.md](docs/REPOSITORY-MODEL.md) for the shared-change,
personal-content, and downstream/fork workflow.

## Documentation

- [Five-minute quick start](docs/QUICKSTART.md)
- [Personalization reference](docs/PERSONALIZATION.md)
- [Common recipes](docs/RECIPES.md)
- [Design system](docs/DESIGN-SYSTEM.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Extending the template](docs/TEMPLATE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Upgrading](docs/UPGRADING.md)
- [Visual QA](docs/VISUAL-QA.md)
- [Repository model](docs/REPOSITORY-MODEL.md)
- [Branch/repository boundaries](docs/BRANCHING.md)
- [Asset policy](docs/ASSETS.md)

## Demo routes and media

The canonical starter contains complete example/product routes so the project is demonstrable after cloning. Their implementation is isolated under `src/demo/`. Setting `features.demoRoutes: false` removes them from the published route set, sitemap, and QA targets while keeping the example source available for reference.

The MIT license covers software and documentation. It does not automatically grant reuse/redistribution rights for every bundled photo, logo, trademark, font, or product screenshot. Review [docs/ASSETS.md](docs/ASSETS.md) before publishing or redistributing demo media.

## License

Software source and documentation are licensed under the [MIT License](LICENSE).
