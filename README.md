# FolioWeave

A reusable, high-fidelity **Next.js 16 portfolio theme** for designers, developers and creative professionals.

The repository ships with a complete demo portfolio, photography gallery, case studies, privacy pages, animated resume printer, camera interaction, weather/podcast integrations, SEO/JSON-LD, error states and deterministic browser QA.

It does **not** use an iframe, redirect, reverse proxy, screenshot replacement or legacy Vite runtime.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Framer Motion
- Lenis
- local/static demo assets
- Route Handlers for weather and podcast data
- deterministic browser, media, asset and pixel-regression QA

## Quick start

```bash
npm install
npm run dev
```

Production:

```bash
npm run check
npm start -- -p 4181
```

Open `http://127.0.0.1:4181/`.

## Make it yours

Most customization happens here:

```text
src/config/site.ts       identity, domain, email, navigation, social, location, resume
src/config/products.ts   products, routes, stores, support email, awards
src/config/seo.ts        metadata and structured-data definitions
src/config/podcasts.ts   RSS integrations
src/config/cache.ts      cache + external-request timeout policy
src/content/home.ts      greetings and footer quote
src/content/about.ts     About story and timeline
src/content/work.ts      project copy and work images
src/content/media.ts     portrait/gallery/photography media lists
src/styles/theme.css     global design tokens
```

The configuration and content layers are type-constrained so many malformed routes, URLs, emails, media paths, colors and content shapes fail during TypeScript validation instead of silently breaking at runtime.

See [`docs/TEMPLATE.md`](docs/TEMPLATE.md) for the full customization workflow.

## Architecture

```text
src/app/                  App Router routes, APIs, metadata, robots/sitemap/manifest
src/config/               stable site/product/integration/cache configuration
src/content/              user-editable portfolio content and media lists
src/components/home/      Hero, Work, Photography, navigation/chrome/footer
src/components/media/     resume printer, camera, carousel, gallery/lightbox
src/components/           shared privacy, route, motion and reference primitives
src/hooks/                Lenis, shared media-query store, managed timers
src/lib/                  framework-independent utilities
src/styles/               theme, shared and route-specific styles
public/                   demo/reference assets
qa/                       repeatable functionality, quality and visual checks
```

The larger homepage modules are split by feature rather than by tiny helper function. This keeps the project reusable without turning it into an over-generalized component framework.

## Verification

Static/build checks:

```bash
npm run lint
npm run typecheck
npm run check
npm run audit:prod
```

Run the self-contained production/browser suite:

```bash
npm run qa:all
```

`qa:all` automatically starts the current `.next` production build on a temporary localhost port, waits for readiness, runs the browser checks, and shuts the temporary server down. No manually running preview server is required. It covers:

- protected assets;
- real user interactions;
- accessibility/security/SEO quality rules;
- loaded-but-invisible media and stale skeletons;
- font-fallback layout stability;
- Resume printer state-machine timing and terminal states;
- JS/CSS bundle budgets.

Maintainers with the optional reference mirror running on port `4173` (or `ORIGINAL_URL`) can additionally run:

```bash
npm run qa:reference
```

`qa:reference` starts its own temporary Next production server too, so only the external reference mirror must already exist. That suite covers strict deterministic home and full-route visual parity against the optional reference mirror. Dynamic UI is behavior-tested separately and frozen only for screenshot comparison.

Browser QA auto-detects Chrome, Chromium or Edge on Windows, macOS and Linux. Set `CHROME_PATH` only for a non-standard installation.

## Quality guarantees

The current QA guards against:

- broken or loaded-but-invisible images;
- stale loading skeletons;
- accidental nested vertical scroll containers;
- unlabeled or non-keyboard-accessible custom buttons;
- unsafe `target="_blank"` links;
- duplicate IDs and missing image alt attributes;
- browser console/page errors and same-origin 4xx/5xx responses;
- iframe/legacy-runtime regressions;
- missing canonical/description/manifest metadata;
- security-header regressions;
- custom 404/noindex regressions;
- font-fallback layout shifts;
- bundle-size regressions.

## Demo assets

The demo/reference assets are intentionally preserved so the repository works as a complete example immediately after cloning. `npm run qa:assets` protects **103 reference assets** with SHA-256 hashes.

The MIT license covers the software source and documentation. Demo photography, resumes, product/brand artwork, trademarks and other reference media in `public/` are **not automatically licensed for reuse by the MIT software license**. Replace them with assets you own or are licensed to use before publishing your own portfolio.

See [`docs/ASSETS.md`](docs/ASSETS.md).

## Scroll model

The document is the only vertical page scroller. On mobile, the About story gallery is intentionally horizontal-only. Quality QA fails if a nested vertical page scroller is introduced.

## Security and reliability

- restrictive CSP and security headers;
- camera permission scoped to self;
- safe JSON-LD script serialization;
- time-bounded external weather/RSS requests;
- no runtime CDN script dependency;
- managed timers and MediaStream cleanup;
- custom 404, route error and global error recovery;
- local asset hash manifest;
- Dependabot + GitHub Actions validation.

## License

Source code and documentation: [MIT](LICENSE).

See the demo-asset licensing note above and in [`docs/ASSETS.md`](docs/ASSETS.md).
