# FolioWeave in five minutes

FolioWeave is an opinionated portfolio starter. You customize content and media; the approved layout, motion, accessibility, and interaction system stay reusable.

## 1. Install

Requirements: Node.js 24 and npm.

```bash
npm ci
```

## 2. Create your profile

Run the guided first pass:

```bash
npm run personalize
```

Then edit the three authoring surfaces directly:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
```

Do not edit `public/portfolio/` or `src/portfolio/*.generated.ts`. They are generated publication output.

## 3. Start local development

```bash
npm run dev
```

Open `http://localhost:3000`.

Development watches `portfolio.json`, portfolio assets, Markdown posts, the custom-blog registry, the schema, and the route registry. Valid changes are rebuilt atomically while Next dev keeps running. If a content edit is invalid, FolioWeave prints the validation error and keeps serving the last valid generated output.

## 4. Replace the starter content

The common edits are:

- identity, location, links, SEO, feature switches: `portfolio.json`
- portraits, project art, photography, resume, blog media: `content/assets/portfolio/`
- articles: `content/blogs/*.md`
- projects: `portfolio.json > projects`
- About timeline/story: `portfolio.json > about`

Image dimensions are measured automatically. Use browser paths such as `/portfolio/projects/my-app/main.webp`; the source file belongs under `content/assets/portfolio/projects/my-app/main.webp`.

## 5. Validate before deployment

```bash
npm run check
npm run audit:prod
npm run qa:maintainer
```

For ordinary content editing, `npm run content:check` is a faster sanity check. The full maintainer suite adds runtime budgets, accessibility/interaction checks, visual regression, profile fixtures, and Chromium/Firefox/WebKit coverage.

## Next steps

- [Personalization reference](PERSONALIZATION.md)
- [Common recipes](RECIPES.md)
- [Design system and visual contract](DESIGN-SYSTEM.md)
- [Architecture](ARCHITECTURE.md)
- [Repository and branch model](REPOSITORY-MODEL.md)
- [Deployment](DEPLOYMENT.md)
- [Upgrading](UPGRADING.md)
