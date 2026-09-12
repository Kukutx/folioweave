# Extending FolioWeave

Normal editing belongs in `portfolio.json`, `content/blogs/` and
`content/assets/portfolio/`. See [PERSONALIZATION.md](PERSONALIZATION.md). Branded/example implementation belongs in `src/demo/`; reusable config/components must not depend on that layer.

## Content contracts

Extend `portfolio.schema.json`, update both the personal and demo author profiles,
and add a pipeline test. Run `npm run content:build` to generate the TypeScript
contract, validator, sanitized configuration, published article index and media
manifest. `content:check` rejects source errors and stale or extra outputs.

Cross-field rules belong in `src/portfolio/content-policy.mjs`; filesystem and
image checks belong in `scripts/content-build.mjs`. Do not duplicate schema
validation in each UI component. Breaking schema changes are intentional; there
is no legacy runtime adapter.

## Pages and sections

Register hand-authored routes in `src/portfolio/routes.json`, implement their
App Router page and call `requirePublishedRoute("/your-route")`. The registry
feeds publication, internal-link validation, sitemap and QA. Markdown routes are
derived from content automatically.

Home navigation uses known section IDs from the publication policy and matching
hashes. Optional sections are filtered by feature flags. Add a section to the
server-side `HomePage` composition and policy together.

Preserve the editorial value of truly custom pages. A single generic page builder,
plugin framework or CMS is not necessary for reusable portfolio content. Thin App Router entry points for bundled examples remain under `src/app/`, but their components, metadata, product data and route CSS live under `src/demo/`.

## Rendering and motion

Keep static composition on the server; pass server-rendered children to small
client interaction shells. Stateful camera, resume and gallery behavior remains
explicit. Import components directly rather than expanding client barrel imports.

Reuse `useMediaQuery`, `useViewportActivity`, `useMotionActivity` and the
scroll helpers. Continuous motion must respect reduced-motion preference,
visibility and pointer capability. Decorative effects must not mutate content
styles. Server HTML must remain readable before JavaScript loads.

Use `MediaCarousel` for image sequences and `mediaDimensions` for intrinsic
image geometry. Use responsive source selection for real alternate artwork.
Thumbnail cropping remains owned by its fixed-ratio card.

## Styling

Approved visual output is a compatibility contract: refactors and performance work must not silently redesign it. See [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

`src/app/globals.css` preserves the ordered portfolio stylesheet cascade.
Readable source is divided by responsibility under `src/styles/portfolio/`.
Tokens belong in `src/styles/theme.css`; new component-local rules should use
CSS Modules. Do not move declarations across cascade boundaries without geometry
and screenshot checks.

```bash
npm run format:styles
npm run check
npm run audit:prod
npm run qa:all
npm run qa:visual-fixtures
```

The browser matrix tests six widths and classic scrollbars. Lifecycle tests add
interruption, keyboard, hash restoration and no-JavaScript checks. Review the
screenshots alongside assertions.

## Integrations and publication

Weather and podcasts use bounded requests and the shared cache policy. Missing
weather is an explicit unavailable state, not a fabricated temperature or icon.
Keep upstream response limits and request cancellation when adding integrations.

Protected generic demo media remains under `public/` and is checked against
`qa/assets-manifest.json`. Author assets are separate. Repository visibility,
deployment access, profile ownership and media licensing are independent
boundaries; see [ARCHITECTURE.md](ARCHITECTURE.md) and
[REPOSITORY-MODEL.md](REPOSITORY-MODEL.md).
