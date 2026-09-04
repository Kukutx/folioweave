# Personalizing FolioWeave

FolioWeave keeps normal portfolio editing separate from layout and framework code.

For most users, personalization means editing **one file** and replacing files in **one public folder**:

```text
portfolio.json
public/portfolio/
```

## Recommended first run

```bash
npm install
npm run personalize
npm run content:check
npm run dev
```

`npm run personalize` asks for your basic identity, location, contact details, social links, and whether you want to hide the bundled example content. It only changes `portfolio.json` and creates folders under `public/portfolio/`.

## Content map

### `site`

Use this for stable identity and site-level information:

- display name / first name / initials
- role, company, country and locale
- production domain
- contact email and email subjects
- social links and their icons
- navigation
- city, coordinates and time zone
- resume paths
- social preview / shared static assets

The personalization wizard can resolve latitude, longitude, and time zone from city/country using Open-Meteo. If it is offline, the existing values are kept.

### `features`

Feature switches let a portfolio start small and grow later:

```json
{
  "weather": true,
  "about": true,
  "work": true,
  "photography": true,
  "resume": true,
  "demoRoutes": true
}
```

`demoRoutes: false` hides the bundled example product/blog/privacy/case-study routes and removes them from the sitemap. This is useful when turning the starter into a real personal site.

### `hero`

`portraits` controls the portrait rotation.

`roleLine` and `summary` are arrays so text and small inline brand marks can be mixed without editing JSX:

```json
[
  { "text": "Designer at " },
  { "brand": { "name": "Studio", "icon": "/portfolio/profile/studio.svg" } }
]
```

For plain text, use a single `{ "text": "..." }` entry.

### `about`

- `timeline` — year/title/description items
- `story` — rich paragraphs using `muted`, `strong`, and `highlight` text tones
- `galleryImages` — images used by the About story gallery

The whole section can be disabled with `features.about`.

### `projects`

Projects are data-driven. Add, remove, reorder, or disable array items without editing `work-section.tsx`.

Common fields:

```json
{
  "id": "my-project",
  "enabled": true,
  "layout": "standard",
  "featuredOnMobile": false,
  "name": "My Project",
  "date": "2026",
  "description": "What the project is and why it matters.",
  "image": {
    "desktop": "/portfolio/projects/my-project/desktop.webp",
    "mobile": "/portfolio/projects/my-project/mobile.webp",
    "alt": "My Project preview"
  },
  "actions": [
    { "label": "View Project", "href": "https://example.com", "icon": "arrow" }
  ]
}
```

Available layouts:

- `standard` — the normal work image + copy pattern
- `featured` — same core structure with optional mobile emphasis
- `story` — adds an editorial story block below the project
- `carousel` — replaces the work image with a screenshot carousel

Optional project features:

- `icon`
- `badge` with `gold` or `blue` tone
- linked badges
- hover preview images for badges
- `actions` with arrow/book icons
- story image/body
- desktop/mobile intrinsic image sizes

The bundled six projects use the same generic project model. They are no longer hardcoded into the homepage component.

### `photography`

`images` can contain any number of photos. There is no fixed 18-image requirement.

If you do not use photography, set:

```json
"photography": false
```

under `features`.

### `seo`

Root metadata and Person JSON-LD read their editable description, keywords, expertise list and optional award from this block.

The detailed bundled example routes still have route-specific metadata in `src/config/seo.ts`; those routes can be disabled entirely through `features.demoRoutes`.


## Asset convention

Use this structure for your own files:

```text
public/portfolio/
├─ profile/
│  ├─ portrait.webp
│  └─ logo.svg
├─ photography/
│  ├─ photo-01.webp
│  └─ photo-02.webp
├─ projects/
│  ├─ project-a/
│  │  ├─ desktop.webp
│  │  └─ mobile.webp
│  └─ project-b/
└─ resume/
   └─ resume.pdf
```

Then reference files with site-root paths, for example:

```json
"/portfolio/projects/project-a/desktop.webp"
```

FolioWeave intentionally favors local assets. The production Content Security Policy only permits same-origin images by default, so using `public/portfolio/` also avoids third-party image availability and privacy issues.

## Automatic validation

Run:

```bash
npm run content:check
```

The checker validates the important structure and verifies every configured local asset exists under `public/`.

It detects issues such as:

- malformed identity/origin/contact fields
- invalid time zones
- duplicate project IDs
- enabled projects without media
- carousel projects without slides
- missing portraits, project media, photography, resume or preview files
- asset paths that point outside `public/`

`content:check` also runs automatically before `npm run dev` and `npm run build`, so a broken configuration fails early instead of producing a partially broken deployment.

## What not to edit for normal personalization

These are implementation/adaptation layers, not the normal user content surface:

```text
src/config/site.ts
src/config/products.ts
src/content/home.ts
src/content/about.ts
src/content/work.ts
src/content/media.ts
src/portfolio/
```

They convert `portfolio.json` into the typed shapes used by the app.

Edit components only when you are changing behavior or design, not when you are changing who the portfolio belongs to.

## Adding genuinely custom pages

The single config file is intentionally for repeated portfolio content, not for forcing every case study into a universal page builder.

For a project that needs unique storytelling or interaction:

1. add the project summary to `portfolio.json > projects`;
2. add a normal route under `src/app/`;
3. link the project action to that route;
4. add route-specific SEO when needed;
5. run the normal validation suite.

This keeps common editing easy without turning FolioWeave into a CMS.
