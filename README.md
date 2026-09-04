# FolioWeave

A polished, production-ready **Next.js 16 portfolio starter** for designers, developers, and creative professionals.

FolioWeave combines editorial storytelling, case studies, photography, expressive motion, and practical production tooling in a project that is easy to customize and extend.

## Highlights

- Responsive portfolio layout for desktop, tablet, and mobile
- Motion-rich hero, work, photography, and contact sections
- Interactive resume printer, camera, gallery/lightbox, and carousel components
- Typed site, product, SEO, integration, and content configuration
- App Router pages with metadata, JSON-LD, sitemap, robots, manifest, and custom error states
- Weather and podcast Route Handlers with bounded external requests and caching
- Accessibility-minded keyboard interactions and reduced-motion support
- Automated browser, media, asset, quality, and bundle checks

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

For a production build:

```bash
npm run check
npm start
```

## Customize

Most portfolio content can be changed without touching framework internals:

```text
src/config/site.ts       identity, domain, email, navigation, social, location, resume
src/config/products.ts   products, routes, stores, support details, awards
src/config/seo.ts        metadata and structured-data definitions
src/config/podcasts.ts   podcast feed integrations
src/config/cache.ts      cache and request-timeout policy
src/content/home.ts      homepage content
src/content/about.ts     About story and timeline
src/content/work.ts      project copy and work media
src/content/media.ts     portrait, gallery, and photography media lists
src/styles/theme.css     global design tokens
```

See [`docs/TEMPLATE.md`](docs/TEMPLATE.md) for the full customization guide.

## Project structure

```text
src/app/                  routes, APIs, metadata, sitemap, robots, manifest
src/config/               site, product, integration, SEO, and cache configuration
src/content/              editable portfolio content and media lists
src/components/home/      homepage feature sections
src/components/media/     gallery, carousel, camera, and resume interactions
src/components/           shared page and motion primitives
src/hooks/                scrolling, responsive state, and lifecycle hooks
src/lib/                  framework-independent utilities
src/styles/               theme and route-specific styles
public/                   bundled demo media and static assets
qa/                       automated validation and browser checks
```

## Validation

Run lightweight checks while developing:

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

Browser QA auto-detects Chrome, Chromium, or Edge. Set `CHROME_PATH` only when the browser is installed in a non-standard location.

## Demo assets

The repository includes demo photography, resumes, product artwork, fonts, and other media so the starter works immediately after cloning.

The MIT license covers the software source and documentation. Demo media, brand artwork, trademarks, and third-party assets under `public/` are **not automatically licensed for reuse** by the software license. Replace them with assets you own or are licensed to use before publishing your own portfolio.

See [`docs/ASSETS.md`](docs/ASSETS.md).

## Security and reliability

The project includes restrictive security headers, safe JSON-LD serialization, bounded external requests, managed timer and media-stream cleanup, custom error recovery, asset integrity checks, Dependabot, and GitHub Actions validation.

## License

Source code and documentation are licensed under the [MIT License](LICENSE).
