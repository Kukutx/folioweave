# FolioWeave

A polished, production-ready **Next.js 16 portfolio starter** for designers, developers, and creative professionals.

FolioWeave combines editorial storytelling, case studies, photography, expressive motion, and practical production tooling while keeping day-to-day personalization in one place.

## Highlights

- Responsive portfolio layout for desktop, tablet, and mobile
- Motion-rich hero, work, photography, and contact sections
- Interactive resume printer, camera, gallery/lightbox, and carousel components
- **Single-file portfolio content configuration** with editor schema support
- Data-driven projects that can be added, removed, hidden, or reordered without editing JSX
- App Router pages with metadata, JSON-LD, sitemap, robots, manifest, and custom error states
- Weather and podcast Route Handlers with bounded external requests and caching
- Accessibility-minded keyboard interactions and reduced-motion support
- Automated content, browser, media, asset, quality, and bundle checks

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Framer Motion
- Lenis
- Lucide React
- Local/static media assets
- Next.js Route Handlers for external data

## Quick start

```bash
npm install
npm run dev
```

For first-time personalization, run:

```bash
npm run personalize
```

The wizard updates author content and rebuilds validated publication outputs; it does not rewrite layout or animation components.

## Personalize

The primary user-facing surface is intentionally small:

```text
portfolio.json          identity, hero, About, projects, photos, SEO, feature toggles
portfolio.schema.json   editor autocomplete and validation hints
content/assets/portfolio/       your portraits, photography, project artwork, and resume
```

Typical workflow:

1. Run `npm run personalize` for identity, location, contact, social links, and an optional clean starting state. Optional values can be removed explicitly with `-`.
2. Put your own files under `content/assets/portfolio/`.
3. Edit `portfolio.json` to add projects, photos, About content, and links.
4. Run `npm run content:build` followed by `npm run content:check`.
5. Start the site with `npm run dev`.

Projects live in `portfolio.json > projects` with independent presentation fields:

- `media.kind: image | carousel` — one image or a reusable carousel
- `mobileTreatment: standard | featured` — mobile presentation
- optional `story` — an editorial block with either media kind

Each project has `enabled`, so work can be staged without deleting content. Photography, About, Resume, weather, and bundled demo routes also have feature switches.

`src/config/` and `src/content/` are internal typed content views. Normal personalization should not require editing them.

See [`docs/PERSONALIZATION.md`](docs/PERSONALIZATION.md) for the full content model and [`docs/TEMPLATE.md`](docs/TEMPLATE.md) for advanced theme and extension guidance.

## Project structure

```text
portfolio.json               single user-facing content source
portfolio.schema.json        JSON schema for editors
content/assets/portfolio/            recommended location for personal assets
scripts/personalize.mjs      first-run personalization wizard
scripts/portfolio-check.mjs  content and local-asset validation
src/portfolio/               typed runtime adapter for portfolio.json
src/app/                     routes, APIs, metadata, sitemap, robots, manifest
src/config/                  integration/cache/SEO adapters and shared types
src/content/                 typed content exports for feature components
src/components/home/         homepage feature sections
src/components/media/        gallery, carousel, camera, and resume interactions
src/hooks/                   scrolling, responsive state, and lifecycle hooks
src/lib/                     framework-independent utilities
src/styles/                  theme and route-specific styles
public/                      bundled demo assets and static files
qa/                          automated browser and release validation
```

## Validation

Content is validated automatically before development and production builds.

Run it directly with:

```bash
npm run content:build
npm run content:check
```

Run lightweight code checks while developing:

```bash
npm run lint
npm run typecheck
```

Before publishing:

```bash
npm run check
npm run audit:prod
npm run qa:all
```

`qa:all` runs the production browser suite and covers core interactions, accessibility and quality rules, media health, font fallback behavior, the resume state machine, and bundle budgets.

`npm run qa:boundary` enforces the reusable-versus-personal path policy described in [`docs/BRANCHING.md`](docs/BRANCHING.md). It also writes a local classification report for promotion work from `personal` to `develop`.

Browser QA auto-detects Chrome, Chromium, or Edge. Set `CHROME_PATH` only when the browser is installed in a non-standard location.

## Markdown blogs

Add `content/blogs/my-post.md` and FolioWeave turns it into `/blogs/my-post` automatically. The same file also feeds the blog index, reading-time estimate, per-post SEO/Open Graph metadata, sitemap, and browser QA. No route component or article registry is required for normal posts.

The minimum frontmatter is:

```md
---
title: "My post"
date: "2026-09-07"
description: "A short summary."
---
```

Optional fields are `subtitle`, `cover`, `tags`, and `draft`. See `content/blogs/_README.md` and `docs/PERSONALIZATION.md` for the full format. Custom React blog routes can still coexist with Markdown when an article needs specialized interactivity.

## Deployment

FolioWeave uses standard Next.js conventions and requires no provider-specific configuration. Vercel can deploy it with the default Next.js preset; other platforms that support Next.js can use their standard integration.

## Bundled example routes

The repository includes complete product, blog, case-study, and privacy pages as working examples. They are enabled by default so the starter is fully demonstrable after cloning.

For a clean personal portfolio, `npm run personalize` removes demo projects/content from the public config and sets `features.demoRoutes` to `false`. Bundled example routes, including the custom Clipt blog example, then return 404 and disappear from the sitemap, while the underlying example source remains available for reference. Your own published Markdown files in `content/blogs/` remain independent of `demoRoutes` and make `/blogs` available automatically.

## Demo assets

The repository includes demo photography, resumes, product artwork, fonts, and other media so the starter works immediately after cloning.

The MIT license covers the software source and documentation. Demo media, brand artwork, trademarks, and third-party assets under `public/` are **not automatically licensed for reuse** by the software license. Replace them with assets you own or are licensed to use before publishing your own portfolio.

See [`docs/ASSETS.md`](docs/ASSETS.md).

## Security and reliability

The project includes restrictive security headers, safe JSON-LD serialization, bounded external requests, managed timer and media-stream cleanup, custom error recovery, cross-platform lockfile validation, asset checks, Dependabot, and GitHub Actions validation.

## License

Source code and documentation are licensed under the [MIT License](LICENSE).
## Architecture and privacy

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for author/published asset separation,
transactional generation, route registration, client boundaries and visual contracts.
The repository is private; deployment access is a separate concern.
