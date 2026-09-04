# Template and Extension Guide

Normal portfolio personalization belongs in `portfolio.json`, not in framework internals. Start with [`PERSONALIZATION.md`](PERSONALIZATION.md).

This guide covers changes that go beyond replacing identity, projects, photos, and copy.

## 1. Public content boundary

The intended user-facing content surface is:

```text
portfolio.json
public/portfolio/
```

Internal adapters under `src/portfolio/`, `src/config/`, and `src/content/` keep the rest of the app strongly typed and should normally stay unchanged.

When adding a reusable content option, prefer extending `portfolio.json` + `portfolio.schema.json` and deriving it in `src/portfolio/` instead of adding a second editable source.

## 2. Visual theme

Edit `src/styles/theme.css` first for global design tokens:

- main sans / serif / handwritten font stacks
- accent color
- text hierarchy
- page/card backgrounds
- borders
- shadows
- editor/collaboration accents

Route-specific CSS remains separate when a page needs specialized selectors or layout behavior.

Avoid broad search/replace in `globals.css` before checking whether the property is already a theme token.

## 3. Project layouts

Homepage projects are rendered from `portfolio.json > projects`.

The built-in variants intentionally stay limited:

- `standard`
- `featured`
- `story`
- `carousel`

These cover the repeated homepage patterns without pretending that every case study should use the same universal page builder.

If a new homepage presentation can be reused, add another project variant. If it is truly unique editorial content, create a dedicated App Router page instead.

## 4. Custom project/case-study routes

For a custom project page:

1. add the homepage card to `portfolio.json > projects`;
2. create a route under `src/app/`;
3. point a project `actions[].href` at that route;
4. add route-specific metadata in `src/config/seo.ts` when necessary;
5. include the route in the sitemap if it should be indexed;
6. run the validation suite.

The bundled product/blog/privacy routes are examples. Set `features.demoRoutes` to `false` to remove them from the public site without deleting their source.

## 5. Navigation and scrolling

Navigation content comes from `portfolio.json > site.navigation` through `siteConfig.navigation`.

Section entries use a hash route plus a `sectionId`. Internal pages use a site path and `sectionId: null`.

The project uses shared helpers:

- `useMediaQuery` / `useMobileViewport` for responsive state
- `useLenis` for desktop smooth-scroll lifecycle
- native touch scrolling on coarse-pointer devices
- `scrollToElement` / `scrollToPosition` for consistent Lenis/fallback scrolling

Do not create independent page-level Lenis instances or ad-hoc resize listeners unless a feature genuinely needs different behavior.

## 6. Live integrations

### Weather

- enabled by `portfolio.json > features.weather`
- location comes from `site.location`
- cache policy comes from `src/config/cache.ts`
- Route Handler: `src/app/api/weather/route.ts`

### Podcasts

- feeds come from `src/config/podcasts.ts`
- raw RSS is fetched with a request timeout
- only compact parsed summaries are cached
- cache/timeout policy lives in `src/config/cache.ts`
- Route Handler: `src/app/api/podcasts/route.ts`

Keep integration mechanics separate from portfolio content.

## 7. Privacy pages

Use shared primitives from `src/components/privacy-page.tsx`:

```tsx
<PrivacyPageShell prefix="myapp" subtitle="MyApp">
  <PrivacySection prefix="myapp" title="1. Introduction">
    <p>...</p>
  </PrivacySection>
</PrivacyPageShell>
```

For an analytics-oriented policy, reuse `AnalyticsPrivacy` rather than duplicating its section structure.

## 8. Error states

The template includes:

- `app/not-found.tsx`
- `app/error.tsx`
- `app/global-error.tsx`

Their shared styling lives in `src/styles/system-state.css`.

Quality QA checks that unknown routes return HTTP 404 and include `noindex`.

## 9. Asset policy

Personal assets should normally live under `public/portfolio/`.

Bundled demo assets remain under their original paths because they form a working example site and are covered by QA integrity checks.

`qa/assets-manifest.json` records protected demo assets. Do not run automated "delete unused assets" cleanup against `public/` without deliberately updating that policy.

Run:

```bash
npm run qa:assets
```

before and after demo-asset maintenance.

## 10. Content validation

`npm run content:check` verifies `portfolio.json` and configured local asset paths.

It runs automatically before development/build commands. Extend `scripts/portfolio-check.mjs` when adding a new public content field that references a local asset or has an important cross-field invariant.

The JSON schema exists for editor assistance; the Node validator is the authoritative project-specific semantic check.

## 11. Full validation workflow

During normal development:

```bash
npm run content:check
npm run lint
npm run typecheck
```

Before publishing:

```bash
npm run check
npm run audit:prod
npm run qa:all
```

The browser suite covers assets, functionality, quality, media health, font fallback, the Resume state machine, and bundle budgets.

## 12. What remains intentionally explicit

Some explicit code is healthier than a universal abstraction:

- custom case-study page storytelling
- the multi-perspective Clipt blog example
- camera/resume/gallery state machines
- specialized privacy/legal copy
- integration/cache mechanics
- custom SVG geometry that belongs to the visual design

FolioWeave centralizes repeated portfolio content, not every possible application concern.
