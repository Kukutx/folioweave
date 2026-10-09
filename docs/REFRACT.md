# Refract Light and Refract Dark

Refract is a portfolio design built around a scroll-driven globe, layered
geometry, and chapter-based storytelling. FolioWeave includes two separate
templates:

| CLI id          | Style                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `refract-light` | White opening, grayscale globe surfaces, contrasting dark content sections, and colored accents |
| `refract-dark`  | Warm dark opening, luminous accents, and a warm light background during the drawing stage       |

Both styles share layout, geometry and interactions. They are selected before
building the site; there is no visitor-facing theme switcher. Their contrasting
sections are part of each design's scroll narrative.

Live demos: [Refract Light](https://folioweave-refract-light.vercel.app) ·
[Refract Dark](https://folioweave-refract-dark.vercel.app). Both use the same fictional
demo profile.

## Select a style

From an author profile branch, with the development server stopped:

```sh
npm run folio -- templates
npm run folio -- template use refract-light --dry-run
npm run folio -- template use refract-light
npm run dev
```

Use `refract-dark` to select the dark design or `classic` to return to Classic.
Template selection keeps author content, media and plugin configuration. Settings
are stored separately under each template id, so changing a style does not erase
the other style's settings.

`main` and `develop` keep the canonical demo profile. Do not replace a personal
profile with demo data to test another design; use an isolated profile fixture.
See [TEMPLATES.md](TEMPLATES.md) for the CLI and publication contract.

## Content and routes

Refract consumes FolioWeave's published profile through `TemplateContext`.
Identity, introduction, biography, projects, contact links and writing settings
remain in `portfolio.json`; media remains in `content/assets/portfolio/` and
articles remain in `content/blogs/`. You do not maintain a second personal-data
module copied from the original project.

| Author input                                | Refract presentation                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `site.identity`                             | Name, role and affiliation                                                          |
| `site.location`                             | Location label and city-level globe marker                                          |
| `site.contact.email` and `site.socialLinks` | Contact links; the GitHub link also supplies the featured link when present         |
| `hero.roleLine`, `hero.summary`             | Introductory copy; a template `tagline` can override the role line                  |
| First `hero.portraits` item                 | About portrait                                                                      |
| `about.story` and `about.timeline`          | Biography and CV experience                                                         |
| Enabled `projects`                          | Scroll chapters; first artwork and first action provide the default figure and link |
| A project's `date`                          | Caption beside the chapter's position in the series, such as `02 / 04`              |
| `content/blogs/`                            | Blog index, articles and tags through the shared publication pipeline               |

The homepage adapts those fields to Refract's scene and editorial sections.
Classic-only objects are not required to appear in Refract, and a Refract
profile may leave `photography`, `footerBook` and `interlude` out of
`portfolio.json` altogether. The same core owns
`/blogs`, article routes and tag routes for every template, and Refract supplies
matching blog views. Metadata, sitemap generation, Markdown rendering and stable
article identity continue to use the common publication pipeline.

Use the profile's existing feature flags to control optional content. A navigation
destination must correspond to a rendered section or published route. Empty
content must not create a broken anchor or a placeholder personal claim.

`features.about` controls the biography and its source timeline;
`features.work` controls project chapters. Photography, the resume printer and
Classic's decorative objects are not part of Refract's home layout. Their author
data remains available when switching back to Classic.

## Template settings

Refract-specific settings live in `portfolio.json > template.settings` under the
selected id. Both styles accept the same option schema. For example, save this as
`refract-options.json`:

```json
{
  "tagline": "Designing interfaces",
  "rotatingTopics": ["interfaces", "visual systems", "open tools"],
  "projectHeading": "Selected work",
  "toolsHeading": "Open tools",
  "focus": ["Interaction design", "Creative coding"],
  "layerLabels": ["Observation", "Structure", "Motion", "Material"],
  "fracturedGlass": true,
  "continentalDrift": true
}
```

Apply it with development stopped:

```sh
npm run folio -- template use refract-light --options refract-options.json
```

`--options` replaces that template's saved options object. Include all options you
want to retain. Omitted options use their defaults; omit optional text instead of
supplying an empty string. These settings are public and must not contain secrets.

| Option                           | Purpose and default                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `tagline`                        | Intro text override; defaults to the shared hero role line                                                                                  |
| `rotatingTopics`                 | Optional rotating endings for the tagline; defaults to an empty list                                                                        |
| `projectHeading`, `toolsHeading` | Section labels; default to `Projects` and `Tools`                                                                                           |
| `focus`, `group`                 | Optional About details; omitted by default                                                                                                  |
| `layerLabels`                    | Up to four captions for the drawing stage's sheets on desktop; defaults to the first four `focus` entries, otherwise none                   |
| `tools`                          | Tool entries with `id`, `name`, `description`, optional `url`, and optional `links` containing `label`/`url`                                |
| `news`                           | Entries with `id`, `date`, `description`, and optional `url`                                                                                |
| `publications`                   | Entries with `id`, `title`, `authors`, `year`, `journal`, `citation`, optional `url` and optional `highlight`                               |
| `researchFigures`                | Figure overrides keyed by project id; each has `source`, `width`, `height`, optional `animatedSource` and optional `caption`                |
| `fracturedGlass`                 | Glass shards in the tools stage; enabled by default                                                                                         |
| `continentalDrift`               | Each project chapter turns its own hemisphere into view and separates its continents; `"first"` limits it to the first, `false` disables it |
| `labels`                         | Replacements for individual interface labels, keyed as in `src/components/refract/copy.ts`                                                  |

Interface wording follows `site.identity.locale`: English by default and Chinese
for `zh-*` profiles. `labels` overrides single entries in any language, for
example `{ "contact": "Say hello", "cv": "Experience" }`; an unknown key fails
validation. Section headings you set yourself (`projectHeading`, `toolsHeading`)
are never translated.

Tools, news and publications default to empty lists. They do not contain sample
academic claims. With no tools, the scene retains a shorter geometric transition
without a Tools heading or navigation link. Use stable, unique ids for entries.
Figure overrides bind to a
project id so reordering projects does not mismatch their artwork; otherwise the
project's first image supplies the figure with dimensions from the media manifest.
Use local `/portfolio/` image paths and accurate dimensions for custom figures.

To enable topic rotation, supply at least two topics and end `tagline` with the
first one. In the example above, `Designing interfaces` becomes `Designing visual
systems` and then `Designing open tools`. A nonmatching tagline stays static.

The complete field limits and accepted values are defined once for both styles in
`src/templates/_refract/options.schema.json`, which each manifest references. Invalid options fail validation before publication. The effect
options control presentation only: the geographic and layered animations remain
illustrations, not a claim about the author's work or scientific measurements.

## Plugins

Both templates implement `site.floating`, `site.footer`, and `article.after`.
Music can use the floating slot; comments can use the article slot. Enabling a
plugin remains an explicit CLI/configuration action, independent of template
selection. No comments service or authentication account is provisioned by
switching to Refract.

Plugins consume shared visual tokens and their own options. They do not move
Refract's native controls or own its scrolling behavior. See
[PLUGINS.md](PLUGINS.md) for provider setup and music placement settings.

The selected template publishes font, surface, text, border, accent and radius
tokens on the root, along with floating-control spacing that reserves room for
its timeline and Home control. A plugin can inherit those defaults without
importing scene code; explicit plugin placement options still take precedence.

## Implementation boundary

On the opening screen the globe can be turned by hand: drag it sideways and it
carries the momentum to the nearest whole turn, settling on the pose it would
have shown untouched. Vertical gestures still scroll, the offset never reaches a
later chapter, and reduced motion or a paused scene disables it.

The manifests and five view entries live in `src/templates/refract-light/` and
`src/templates/refract-dark/`. Shared home views, profile adaptation, CSS and scene
code live under `src/components/refract/`. Its stylesheet is a stack of ordered
layers in `styles/`, imported by `styles.css`; a later layer refines the earlier
ones, so add a rule to the layer that owns the component's current behaviour
instead of appending a new override at the end. Shared blog views and their CSS Module
live in `src/components/refract-blog/`. Neither template imports the other.

The globe is a Canvas2D scene with reusable geometry. Its progressive transitions,
chapter timeline and mobile reading stages belong to the homepage. Blog routes
must not load the homepage renderer merely to reuse a header or palette.

Keep the scene's lifecycle explicit: stop continuous work while hidden or paused,
respect reduced motion, release listeners and rendering resources on unmount,
and preserve readable content if JavaScript or scene initialization fails.
Changing a palette must not change geometry or interaction timing independently
between the two styles.

Classic's existing screenshots describe Classic. Review Refract at desktop,
mobile and short landscape sizes against its own design, including direct links,
refresh at a restored scroll position, keyboard navigation, timeline controls,
reduced motion and no-JavaScript output. A successful build alone does not verify
those interactions.

## Design contract

Refract's composition is deliberate. Fix alignment, overflow and interaction
defects inside it; a change to any rule below is a redesign and needs the owner's
decision first.

- The stage fills the viewport and the globe stays at its centre: horizontally at
  half the viewport width, and on desktop vertically at half its height. Text and
  figures never move or shrink the globe to make room.
- Content uses a 1500px container. The header has 24px gutters; stage content
  has 64px gutters.
- Two build-time styles share all geometry, content and motion. Dark opens on
  `#252423` with a `#DAD5D0` drawing stage. Light keeps a black-and-white
  foundation: white opening and drawing stages, black project and profile
  chapters, a grayscale globe. The outer ring, location marker, chapter headings,
  cursor and hover states keep the shared accent palette in both.
- `lib/scene-theme.ts` owns surfaces, accents and the DOM theme variables; the
  canvas reads the same source. A local colour request is not a palette change.
- Scroll owns the narrative. Chapter progress is read from the document
  position, both endpoints included, with no lagging proxy; every pose is
  reversible. Time drives only ambient loops, which stop when paused, hidden or
  under reduced motion.
- Every project chapter faces a different hemisphere and separates the continents
  seen there, so no two chapters show the same globe. The sequence plays in time
  inside its chapter and never adds scroll distance.
- The overview unfolds into a layered rectangular terrain, mesh and data field,
  then folds back into the globe. Leaders run from the label through a horizontal
  segment and a 45-degree bend. Ring arcs fill continuously with scroll.
- The tools stage opens into independently tilted glass shards with their
  geographic dots attached, and never fades them out at full opening.
- The timeline is a 336 by 40px track with a 12px radius, dense ticks and a red
  cursor, with no extra buttons in it. Home is a separate control. Both appear
  only after the hero's bottom row has left the viewport.
- Below 1200px, copy and figures appear in their own scroll phases while the
  scene is suppressed, then the scene returns at the same centre. The mobile
  menu is a narrow draggable pane with a dimmed backdrop, not a full-screen
  takeover.
- Performance work keeps the approved pixels and motion. Geometry is measured
  outside scroll updates, caches are invalidated on viewport, pose and
  reduced-motion changes, and offscreen stores are released on destroy.

Pointer parallax was removed during design review: it added poses that broke
text clearance and repeatable scroll positions. Decorations the owner removed are
not restored on the grounds that an earlier version had them.

## Verification

```sh
npm run qa:refract
```

This runs the template and scene contract tests, then builds and checks both
styles in isolated demo fixtures under `.generated/`. It validates template
selection, blog routes, responsive layouts, article navigation, worker and
main-thread drawing, timeline seeking, pause controls, mobile-menu dismissal and
live reduced-motion changes. It does so without rewriting the real `portfolio.json`
or copying private author media. By default, the browser suite cleans up the
fixture it creates.

To focus the browser stage on one style while retaining the contract tests:

```sh
npm run qa:refract -- --style=light
npm run qa:refract -- --style=dark
```

These checks cover the stated fixture and browser conditions. They do not replace
reviewing your own content, screenshots or deployment, and do not establish a
performance guarantee for every device.

## Public demo and attribution

Refract began as a personal-site design and is distributed here as reusable
template code. Its public demo content is generic: the original person's name,
portrait, email, publications and institutional affiliations are not starter
defaults. The example author and project history are explicitly identified as
fictional demonstration content. Replace them with your own work before publishing
a personal site.

Both styles demonstrate one profile, `governance/templates/refract.json`; the
template id, address and theme colour are set per style when a demo is
assembled. Original demo artwork lives in
`governance/templates/assets/`. Verification prepares those inputs in a disposable
project-local fixture. Do not copy a demo profile over an existing author profile.

The layout and motion study takes inspiration from the [Anime.js site](https://animejs.com/).
The Refract implementation is included under FolioWeave's MIT license. Font and
geography assets retain their own licenses: DINish under SIL OFL 1.1, Natural Earth
data in the public domain, and the retained World Atlas ISC notice. The
continental fragments are regenerated offline with
`scripts/refract-continental-mesh.py` (Python with Shapely; not a site dependency). The reference
Berkeley Mono font and the original personal site's research media are excluded
from this distribution. See [ASSETS.md](ASSETS.md) and the bundled credit records
before redistributing assets.
