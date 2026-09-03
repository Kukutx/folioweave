# Template Customization Guide

This project is designed so most people can replace the demo portfolio without editing animation or framework internals.

## 1. Change the site identity

Edit `src/config/site.ts` first.

Typical fields:

- `identity.name`
- `identity.firstName`
- `identity.initials`
- `identity.role`
- `identity.company`
- `identity.country`
- `origin`
- primary contact email and mail subjects
- social links
- navigation
- location/timezone/weather coordinates
- resume image/PDF/download filename
- social preview image

Changing the domain here automatically updates root metadata, robots, sitemap, JSON-LD and API User-Agent values that derive from the site configuration.

## 2. Change products and project destinations

Edit `src/config/products.ts`.

Use it for stable cross-page identifiers:

- product name
- internal product route
- story route
- privacy route
- icon
- App Store / Play Store URL
- press URL
- product support email
- product award

Do not move long project descriptions into this file. Long editorial content belongs in `src/content/`.

## 3. Replace the portfolio copy

Edit:

- `src/content/home.ts` — greeting languages and footer-book quote
- `src/content/about.ts` — About story segments and timeline
- `src/content/work.ts` — portfolio/project descriptions, dates and work images

About story segments use `muted`, `strong` and `highlight` roles. This preserves the original Story/TL;DR visual behavior while keeping the text editable without touching the component.

## 4. Replace images

Edit `src/content/media.ts` after placing your files in `public/`.

The lists cover:

- hero portrait rotation
- About story gallery
- Photography gallery/lightbox
- NotchShelf carousel demo images

Work-card images live in `src/content/work.ts` because they belong to individual projects.

The original demo assets are intentionally kept. You can replace references gradually instead of deleting the examples immediately.

## 5. Change the visual theme

Edit `src/styles/theme.css` first.

It contains the global design tokens for:

- main sans / serif / handwritten font stacks
- accent color
- text hierarchy
- page/card backgrounds
- borders
- shadows
- editor/collaboration accents

Route-specific CSS remains separate when pixel parity requires exact selectors or specialized layouts.

Avoid global search/replace in `globals.css` before checking whether the property is a theme token. The theme file is the intended public customization surface.

## 6. Navigation and scrolling

Navigation comes from `siteConfig.navigation`.

Section entries use a hash route plus a `sectionId`. External/internal pages can use an internal path and `sectionId: null`.

The project uses shared helpers:

- `useMediaQuery` / `useMobileViewport` for responsive state
- `useLenis` for the smooth-scroll lifecycle
- `scrollToElement` / `scrollToPosition` for consistent Lenis/fallback scrolling

Do not create independent page-level Lenis instances or ad-hoc resize listeners unless a feature genuinely needs different behavior.

## 7. Adding another privacy page

Use the shared primitives in `src/components/privacy-page.tsx`:

```tsx
<PrivacyPageShell prefix="myapp" subtitle="MyApp">
  <PrivacySection prefix="myapp" title="1. Introduction">
    <p>...</p>
  </PrivacySection>
</PrivacyPageShell>
```

The shell provides:

- shared privacy layout classes
- exact date formatting
- the client-only date correction used to match browser-local date behavior

If the page follows the analytics-heavy Habee/NotchShelf policy, reuse `AnalyticsPrivacy` instead of duplicating the sections.

## 8. Adding a new product or work item

1. Add stable product identifiers to `src/config/products.ts`.
2. Add work copy/images to `src/content/work.ts`.
3. Add any new media to `public/`.
4. Render the project in `src/components/home/work-section.tsx`.
5. Add a route under `src/app/` if the project has a standalone page.
6. Add route SEO in `src/config/seo.ts`.
7. Add the public route to `src/app/sitemap.ts` when it should be indexed.
8. Run the validation suite.

Work layout is deliberately still explicit JSX instead of a universal JSON renderer. The current projects have genuinely different badges, story-time content, previews and destinations; forcing them into one over-general component would make the template harder to understand and would risk visual parity.

## 9. Live integrations

### Weather

- location comes from `siteConfig.location`
- cache policy comes from `src/config/cache.ts`
- Route Handler: `src/app/api/weather/route.ts`

### Podcasts

- feeds come from `src/config/podcasts.ts`
- large raw RSS documents are fetched with a request timeout and are not stored in Next's per-entry Data Cache
- only the compact parsed podcast summaries are cached
- browser/API cache and timeout policy comes from `src/config/cache.ts`
- Route Handler: `src/app/api/podcasts/route.ts`

Keep cache settings centralized unless Next requires a statically analyzable route constant.

## 10. Error states

The template includes:

- `app/not-found.tsx`
- `app/error.tsx`
- `app/global-error.tsx`

Their shared styling is `src/styles/system-state.css`.

Quality QA checks that an unknown route returns HTTP 404 and includes `noindex`.

## 11. Asset policy

The portfolio's original assets remain as demo/reference material. `qa/assets-manifest.json` records the expected SHA-256 of all 103 reference assets.

Do not run "delete unused assets" automation against `public/` without first updating the intended demo-asset policy. Some files are retained specifically as examples even if a current page does not render them.

Run:

```bash
npm run qa:assets
```

before and after asset cleanup.

## 12. Validation workflow

During normal development:

```bash
npm run lint
npm run typecheck
```

Before publishing:

```bash
npm run check
npm run audit:prod
```

With the production server running on port 4181:

```bash
npm run qa:all
```

This self-contained suite includes asset, functionality, quality, media-health, font-fallback, Resume state-machine and bundle-budget checks. Browser QA auto-detects Chrome, Chromium or Edge; set `CHROME_PATH` only for a non-standard browser installation.

Maintainers with both the production server (4181) and optional reference mirror (4173) running can add the strict reference suite:

```bash
npm run qa:reference
```

`qa:parity` first gathers real semantic content, then freezes genuinely dynamic visuals for screenshot comparison. Dynamic behavior remains covered by `qa:functionality`.

## 13. Things intentionally not generalized further

Some explicit code is healthier than a universal abstraction:

- Work cards have different badges, links and story content.
- District has a unique case-study interaction model.
- Clipt blog has multiple perspective modes.
- Camera/Resume/Gallery are separate feature modules because their state machines are unrelated.
- Pixel-locked reference SVGs live in `reference-icons.tsx` so dependency upgrades cannot silently change their geometry.

The template should be easy to edit, not "generic at any cost".
