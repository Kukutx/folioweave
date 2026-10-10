# Templates and the integration contract

FolioWeave selects one template per build. The available templates are `classic`,
`refract-light`, and `refract-dark`.
Profiles without a `template` field use `classic` and do not enable plugins.
Template selection, source content and plugin settings are independent.

| Template        | Presentation                                                   | Implementation                 |
| --------------- | -------------------------------------------------------------- | ------------------------------ |
| `classic`       | Editorial sections, photography and tactile objects            | `src/templates/classic/`       |
| `refract-light` | White opening and contrasting dark sections with a globe scene | `src/templates/refract-light/` |
| `refract-dark`  | Warm dark opening and light drawing stages with a globe scene  | `src/templates/refract-dark/`  |

Refract's two styles share components under `src/components/refract/`. Each has
its own manifest and template entries. Selecting one fixes the style for that
build; visitors do not get a light/dark switch. See [REFRACT.md](REFRACT.md) for
the profile adapter, available settings and credits.

## Use the CLI

```sh
npm run personalize
npm run folio -- templates
npm run folio -- template use classic --dry-run
npm run folio -- template use classic
npm run folio -- template use refract-light --dry-run
npm run folio -- template use refract-dark
npm run folio -- doctor
```

`main` and `develop` retain the canonical demo. Authors use their profile branch,
as before. Stop development before changing extensions; restart it after a CLI
change so generated imports and CSP headers agree. Production changes require a
new build and deployment. `doctor` checks configuration and generated publication;
it does not contact or provision third-party services.

The CLI validates the candidate before changing the profile and rolls back the
profile if publication fails. Switching retains content, asset sources and plugin
options. Incompatible enabled plugins produce an error: disable that plugin or
add its required slot to the destination template before switching.

```json
{
  "template": {
    "id": "classic",
    "settings": {
      "classic": {}
    }
  }
}
```

Settings are keyed by template id so switching can preserve each design's options.
`--options file.json` replaces the selected template's settings object with the
JSON file's contents; include any existing options you want to retain. Other
templates' saved settings stay intact. Only the selected template's settings
enter generated publication. These are public settings, never secrets.

## Bring in another Next.js + React design

```sh
npm run folio -- template create your-template
```

This creates an integration scaffold under `src/templates/your-template/`. It is
a starting point for the incoming design, not another finished portfolio theme.
The command refuses to overwrite an existing directory. The catalog discovers
manifests at build time; registering a template does not add it to the browser.
Template source changes belong on a feature branch from `develop`; the CLI refuses
to create shared template source on the protected `personal` branch.

Keep the incoming design's components, local styles and assets together. Each
view has its own entry file and default export, typed with `TemplateModule` in
`src/core/contracts.ts`. Do not combine these entries into a barrel imported by
the root layout: that also pulls page-specific client code into other routes.

| Export      | Input                             | Responsibility                                                     |
| ----------- | --------------------------------- | ------------------------------------------------------------------ |
| `Layout`    | `children`, `context`, `slots`    | Persistent site shell; render children and each supplied slot once |
| `Home`      | `context`                         | Homepage and declared navigation sections                          |
| `BlogIndex` | `posts`, `context`                | Published article list                                             |
| `BlogPost`  | `post`, `afterArticle`, `context` | Article and the supplied comments slot                             |
| `BlogTag`   | `tag`, `context`                  | Filtered articles and tag navigation                               |

`context` supplies published site identity, introduction, biography, projects,
photography, writing settings, feature switches and this template's options.
It does not expose another template's options. The first API retains the existing
author schema, with one exception: `photography`, `footerBook` and `interlude`
are optional in a profile. A template that renders one lists it under
`"requires"` in its manifest, and selecting that template for a profile without
the block fails with the block's name. Classic requires all three; Refract none.
Publication fills an omitted block with an inert value, so every template reads
one complete shape. Existing `footerBook` and `interlude` data remain available to
Classic without forcing another template to render those objects.

The core retains filesystem routes, metadata, static article parameters, sitemap,
content publication, validation and the root HTML document. Do not copy another
project's `app/layout.tsx`, `next.config`, lockfile or content build over these.
Declare additional routes in the existing route registry and use the publication
guard. Template selection alone does not register new filesystem routes.

The root supplies `slots.footer` and `slots.floating` to the persistent template
layout. Place them in its footer and floating layer. Render `afterArticle`
exactly once in `BlogPost`. Include a slot
in the manifest only when the template actually supports it. Per-article plugins
receive a stable id, title and canonical site-relative href; a template must not
replace this id with a DOM selector or a visual title.

```json
{
  "id": "your-template",
  "name": "Your template",
  "description": "A short description for the CLI.",
  "version": "1.0.0",
  "apiVersion": 1,
  "entries": {
    "Layout": "layout.tsx",
    "Home": "home.tsx",
    "BlogIndex": "blog-index.tsx",
    "BlogPost": "blog-post.tsx",
    "BlogTag": "blog-tag.tsx"
  },
  "slots": ["site.floating", "site.footer", "article.after"],
  "sections": ["home", "work", "contact"],
  "optionsSchema": { "type": "object", "additionalProperties": false }
}
```

The id must match the directory. Entry files are local `.tsx` modules. API version
mismatches, missing entries, invalid settings and unsupported slots fail before
publication. Template-specific navigation is checked against `sections`; existing
Classic navigation entries for unavailable sections are omitted from publication
without deleting author input.

Use `ArticleBody` from `@/components/blog/article-body` for Markdown content. It
owns GFM, stable heading anchors, image geometry and external-link behavior; its
`components` prop allows code-block presentation. The core article route emits
BlogPosting JSON-LD exactly once. Use `context.capabilities.writing` to omit a
Writing link when the published site has no articles. The scaffold demonstrates
these contracts, including feature-aware work sections.

## Styles and interaction

Classic owns its ordered cascade under `src/templates/classic/styles.css` and
`styles/`. Its home composition, About, navigation and scroll interactions live
in the same template directory. Shared media components remain reusable.
The application root no longer imports Classic's portfolio styles unconditionally.

Refract owns its shared styles and scene modules under `src/components/refract/`.
Its two template entry sets select a fixed style and consume the same profile
contract. Keep scene implementation in that shared directory rather than having
one template import the other. Blog views belong to the template contract; a
homepage Canvas scene must not become a dependency of every article route.

Classic's blog index has a native search control at the Home button's bottom-right
position. It searches published titles, subtitles, summaries and tags; Markdown
body content is not sent to the search client. The search panel loads when opened.
Classic articles and the built-in Clipt article show a return-to-top control after
scrolling. These controls are not plugins. Other templates can opt into the shared
components under `src/components/blog/` and the summary projection in
`src/blog/search.ts`; they are not injected into another template's views.

Use CSS Modules for new components. Define plugin tokens on the persistent shell
or on `:root[data-template="your-template"]`:

```css
--fw-font: system-ui, sans-serif;
--fw-surface: #ffffff;
--fw-text: #18212b;
--fw-border: #ccd6dd;
--fw-accent: #145a73;
--fw-on-accent: #ffffff;
--fw-radius: 16px;
--fw-plugin-layer: 18000;
```

The optional `--fw-floating-right` token gives right-docked controls a common
right edge. Classic publishes Home's existing inset (responsive 16–32px, 16px
at widths up to 900px). Music uses it without importing Classic or moving native
controls; templates that omit it keep the player's own 14px/9px fallback. This
controls horizontal placement only. Optional `--fw-floating-bottom-right` and
`--fw-floating-bottom-center` tokens provide music's default bottom spacing for
each position. Classic reserves 80px on the right (including a 20px gap above its
44px native control) and 16px at bottom center, increasing both for safe areas.
Explicit music `offsetBottom` overrides these defaults. Other templates can omit
the tokens to retain the player's 24px desktop / 18px small-screen fallback.

Avoid importing another template or global resets from plugins. Own one scroller,
respect reduced motion, preserve keyboard access and make content readable before
hydration. Plugins do not depend on Classic's Motion values, section ids or Lenis.
Module isolation is not a sandbox for untrusted third-party code.

Author images and audio belong under `content/assets/portfolio/`, with public
URLs under `/portfolio/`. Existing shared demo assets remain governed by the
asset manifest. Namespace any additional static design assets to avoid collisions;
static files placed directly in `public/` are publicly served independently of
template selection and are not filtered by the author publication pipeline.

## Verify an incoming template

```sh
npm run check
npm run qa:extensions
npm run qa:extension-browser
npm run qa:route-loading
```

The extension browser suite creates an independent template in an ignored,
project-local sandbox, builds it with music and comments, verifies navigation and
failure states, then switches back to Classic with plugins disabled and builds
again. It never rewrites the real profile. It uses a simulated Giscus transport,
so no live comments or GitHub discussions are created.

Each finished design also needs its own reviewed visual and interaction coverage.
The existing geometry, lifecycle and pixel suites describe Classic. Keep them as
Classic's compatibility contract; do not compare a new design to its screenshots
or update its baselines to accommodate another template.

For the two bundled Refract templates, run `npm run qa:refract`. It validates their
shared option and scene contracts, builds each style in a disposable project-local
demo fixture, and checks the resulting pages in a browser. It preserves the real
profile and original media. See [REFRACT.md](REFRACT.md) for focused commands.

The handoff for a new template should include code, route list, content examples,
dependencies, asset ownership and desktop/mobile reference images. Registering a
manifest is not a substitute for reviewing that design's production output.
