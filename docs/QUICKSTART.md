# FolioWeave in five minutes

FolioWeave is a portfolio framework with three selectable templates. You customize content and media; each template provides its own layout and interactions, and plugins add independent features.

## 1. Install

Requirements: Node.js 24 and npm.

```bash
npm ci
```

## 2. Create your profile

`main` and `develop` keep the canonical demo profile, and the content build refuses to publish anything else there. Your profile lives on its own branch:

```bash
git switch -c personal
npm run personalize
```

The branch names come from `governance/branch-policy.json`. A copy of the project without Git history can be personalized in place.

Then edit the authoring surfaces directly:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
content/resume/            optional, see RECIPES.md
```

Do not edit `public/portfolio/` or `src/portfolio/*.generated.ts`. They are generated publication output.

## 3. Choose a template and start development

List the available designs, then select one:

```bash
npm run folio -- templates
npm run folio -- template use refract-light
```

The template ids are `classic`, `refract-light`, and `refract-dark`. Classic is the default. The two Refract styles are separate choices made before building the site, with no visitor-facing switcher. Selection retains your content and each template's saved settings.

```bash
npm run dev
```

Open `http://localhost:3000`.

Development watches `portfolio.json`, portfolio assets, Markdown posts, the custom-blog registry, the schema, and the route registry. Valid changes are rebuilt atomically while Next dev keeps running. If a content edit is invalid, FolioWeave prints the validation error and keeps serving the last valid generated output.

Stop development before switching templates or enabling plugins, then restart it so generated imports and security headers agree. See [TEMPLATES.md](TEMPLATES.md) for selection options and [PLUGINS.md](PLUGINS.md) for music and comments.

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
npm run build
```

The build publishes and validates your content, then compiles the site; if it
passes, the site is deployable. `npm run folio -- doctor` checks the selected
template and plugins without building. `npm run check` is the maintainers' gate
for changes to shared code and is not needed for a personal site.

On Vercel, set the project's production branch to `personal`
(Settings → Environments → Production → Branch Tracking); a new project tracks
`main`, which carries the bundled demo profile.

For ordinary content editing, `npm run content:check` is a faster sanity check.
For design verification, `npm run qa:refract` builds and checks both Refract styles
in isolated fixtures. Classic's `npm run qa:maintainer` suite runs against a Classic
build and adds runtime budgets, accessibility/interaction checks, visual regression,
profile fixtures, and Chromium/Firefox/WebKit coverage. Do not run Classic's visual
baselines against Refract or replace your profile just to perform a check.

## Next steps

- [Personalization reference](PERSONALIZATION.md)
- [Template selection](TEMPLATES.md)
- [Refract configuration and content mapping](REFRACT.md)
- [Shared plugins](PLUGINS.md)
- [Common recipes](RECIPES.md)
- [Design system and visual contract](DESIGN-SYSTEM.md)
- [Architecture](ARCHITECTURE.md)
- [Repository and branch model](REPOSITORY-MODEL.md)
- [Deployment](DEPLOYMENT.md)
- [Upgrading](UPGRADING.md)
