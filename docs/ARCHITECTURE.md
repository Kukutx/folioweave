# Content, publication and interaction contracts

FolioWeave is a single application with a shared publication core, selectable templates, local plugins and separately owned author content. Profiles without explicit extension settings select Classic with no plugins. The other built-in templates are Refract Light and Refract Dark. See [TEMPLATES.md](TEMPLATES.md), [REFRACT.md](REFRACT.md), and [PLUGINS.md](PLUGINS.md).

## Template ownership

The core owns routes, metadata, published content, article identity, validation,
and plugin slots. A template implements five view entries: layout, home, blog
index, blog article, and tag page. Only the selected template's entries are
generated into the application. Templates consume `TemplateContext` rather than
reading another template's configuration or importing another project's app root.

Classic owns its editorial composition under `src/templates/classic/`. Refract
Light and Refract Dark have separate manifest directories and share their scene,
content adapter, and views under `src/components/refract/`. Their palette is fixed
by the selected entry; it is not a stored visitor theme. Scene geometry and
interaction fixes apply to both styles through the shared implementation.

Both Refract templates read the same author profile as Classic. Template options
provide presentation-specific details, while author identity, project content,
articles, and contact links retain their existing sources. A template need not
render every Classic section or object. It must honor its declared sections and
slots, omit unavailable navigation destinations, and keep article ids stable.

Home-only scene code stays outside the shared layout and article import graphs.
Plugins receive the core's semantic context and styling tokens; they do not
control a template's native navigation or Canvas lifecycle.

## One authoring and build workflow

Edit `portfolio.json`, Markdown in `content/blogs/`, original files in
`content/assets/portfolio/`, and optionally the resume source in
`content/resume/`. URLs remain `/portfolio/...`; source filesystem paths
are not browser URLs. `public/portfolio/` is ignored, generated output, never an
authoring directory.

Run `npm run content:build` after editing content. Development and production
builds invoke it automatically. `npm run content:check` is read-only validation
of source and generated output; it rejects stale, missing or extra published
files. The personalization wizard uses the same pipeline.

1. Validate JSON Schema, locale/time zone, unique project IDs and route references.
2. Validate author references, including disabled projects and draft articles.
3. Resolve the published profile, registered routes and published articles.
4. Read actual image dimensions, sizes and hashes.
5. Prepare all configuration, type, validator, article and media outputs.
6. Re-check the branch/profile publication boundary immediately before writing.
7. Commit generated outputs under an exclusive lock, rolling back on failure.

Image references must be canonical local image paths, without URL parameters,
fragments or encoded path aliases. Profile image/PDF/icon fields are distinct
schema contracts. Markdown inline and reference links are analyzed: local
downloads participate in the publication manifest, and published articles cannot
link to unpublished local routes. Draft-only downloads stay in author storage.

Published portfolio assets are byte snapshots from validation, not source paths
read again during replacement. Their dimensions, hashes and copied bytes therefore
describe the same version even if an author edits a source during the build.

Unreferenced originals are allowed in the author directory. Disabled content is
removed from the runtime configuration, not only hidden with CSS. Draft images
are not copied into `public/portfolio/`. Rebuild before deployment after changing
publication flags. During local development, `scripts/dev.mjs` watches the authoring
inputs and runs this same atomic publication pipeline without restarting Next.js.
Invalid edits keep the last valid generated output and report the validation error.
The publication lock remains authoritative, so do not run competing manual writers
against an active content rebuild.

### Resume source

The resume is the one author asset that is derived rather than supplied.
`content/resume/resume.json` is validated against `resume.schema.json` and
rendered by a pure function to a self-contained HTML document;
`npm run resume:build` prints that document with the pinned Chromium into the
PDF and preview that `site.resume` references. Rendering needs a browser, which
deployment builds do not have, so the outputs are committed and
`content/resume/resume.lock.json` records the fingerprint of the rendered HTML
and render settings together with the output hashes. `content:check` recomputes
the fingerprint without a browser and fails closed when the source, the
template, the configured targets, or the committed bytes disagree, and when a
lock or a misnamed source is present without `resume.json`. The build writes
only canonical `/portfolio/` targets, replaces only files recorded in the lock
unless told to adopt them, and renders only when the output is stale.

The template uses no positioned or transformed boxes: those paint after normal
flow, and a PDF text layer follows paint order. Keeping every box in flow is what
keeps the extracted text in reading order. Text is laid out by glyph advance
width alone, and the build refuses to render without Arial-compatible font
metrics, when content exceeds one A4 page, or when it runs past the right
margin: each of those would change the document without changing its source.

If a process is killed during output replacement, inspect
`.generated/content-transaction-*` before rebuilding. Its `previous-*` entries
retain previous outputs. A surviving `.generated/content.lock` intentionally
blocks concurrent/restarted builds. Its JSON records the owner PID and transaction
directory; `journal.json` maps every target to its staged and previous paths.
Verify no build is running and complete recovery before removing that one lock.
Ordinary errors roll back and release it automatically; a failed rollback retains
both the lock and recovery files and rejects subsequent writers.

## One route policy

`src/portfolio/routes.json` registers hand-authored pages. Add a route there and
call `requirePublishedRoute("/your-path")` as the unconditional first statement
of its default-exported page function. The TypeScript AST check validates the
import, call and exact path; comments and conditional/dead calls do not qualify.
The checker scans pages in both directions: unregistered pages, missing pages,
duplicate URLs and unregistered custom blogs fail the build. Route groups are
normalized and private folders excluded. Unsupported public routing conventions
must acquire an explicit policy before use. `demoOnly`
belongs to this registry, not to a second blog metadata flag.

The same policy feeds navigation filtering, link checks, sitemap, custom article
publication and browser test targets. Markdown routes are derived from published
posts, so they do not need manual registration. Optional sections stay in source
navigation and become visible when their feature is enabled.

### Demo implementation boundary

Bundled branded examples are implementation examples, not reusable configuration.
Their product data, metadata, components, and route-specific styles live under
`src/demo/`. Their App Router entry files are thin filesystem route shims in the
`src/app/(demo)/` route group, which may import that demo layer; the group does
not appear in URLs, and the route contract rejects an example page outside it or
any other page inside it. Reusable modules under `src/config/`,
`src/components/`, `src/content/`, `src/hooks/`, and `src/lib/` must not depend on
`src/demo/`. `qa/demo-boundary.test.mjs` enforces that dependency direction and
keeps known demo-brand copy out of the generic config/component layers.

## Server and client ownership

The following implementation details describe Classic's rendering and motion
contract. Refract's scene ownership and lifecycle are documented in
[REFRACT.md](REFRACT.md); those designs are verified independently.

`HomePage` composes the page on the server. `HomeExperience` owns scrolling, theme
transitions and chrome, accepting server-rendered children. Static contact markup
does not belong to its client import graph. Stateful gallery, portrait, camera
and resume components remain client islands.

`useViewportActivity` owns observation and document visibility.
`useMotionActivity` adds reduced-motion and pointer-capability policy. Continuous
effects stop outside their useful lifetime; cursor decoration never writes styles
onto content elements. Content is visible in server HTML before hydration.
Hero greeting/portrait updates do not rerender About. Gallery selection does not
rerender the photography motion subtree. Reduced motion also removes staggered
text/filter work and theme spring lag, not only positional animation.
SSR-visible motion text and theme preferences use the shared media-query store:
its server snapshot matches hydration, and subsequent preference changes stay live.
Photography parallax subscriptions exist only near the viewport (240px prewarm)
while the document is visible; static/mobile/reduced-motion cards skip them.
The same viewport lifecycle owns photography image compositing, including static
cards: visible fractional-sized images keep stable sampling, while distant cards
release their `will-change` hint. Gallery preferences use the shared media-query
store so changing reduced motion also stops existing parallax subscriptions.

`ThemeScope` keeps foreground-color inheritance local to server-composed content
regions. A stable client-only Motion value is shared through `HomeForeground`;
only near-viewport, visible scopes subscribe, and re-entry immediately samples
the current color. The root still owns the original opaque background and color
curve, preserving text rasterization. Do not animate inherited `color` on `.app`:
it needlessly invalidates distant content throughout each theme spring update.
These wrappers do not import their server-rendered children into the client graph.

Each animated property has one interpolation owner. Navigation scroll geometry
and colors belong to Motion values, not an additional CSS `transition: all`.
Hover styles list only the properties they actually animate. Reduced-motion CSS
sets `transition: none`, zero animation duration and zero delay. A tiny nonzero
universal duration would activate the default `transition-property: all` on
otherwise static elements, multiplying inherited color transitions across the
document. No component depends on transition-end events for cleanup.

Navigation releases its scroll lock before starting a scroll. It keeps native
history restoration, addressable hashes, Escape handling and focus restoration.
The animated home shell opts out of automatic scroll anchoring for its entire
lifetime. Media reserves its own dimensions; the shared scroll lock restores the
viewport synchronously. This avoids a second, delayed browser correction after
modal/gutter changes without timers that could override subsequent navigation.
Other page shells keep their native anchoring policy.
The exclusion belongs directly to `.app`, not a document-wide `:has()` selector.
The gallery owns/restores the root background only when a classic gutter exists,
including the previous inline priority. Its original backdrop blur is preserved
on an independent `::before` layer, not on the moving image subtree.
The open modal retains its opacity layer for the fade lifecycle. Do not promote
individual images permanently: fractional rasterization changes their pixels.
The lightbox image box follows the authored dimensions and aspect ratio from the
media manifest before and after decode, never the raster width the optimizer
happened to select.

## Visual ownership and verification

Approved visual output is a compatibility contract. Refactoring, performance work,
dependency upgrades, and abstraction do not permit visible drift unless the prior
visual is explicitly identified as incorrect. Never regenerate baselines merely to
silence a failure; review the cause and accept only the intended regions. See
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

`src/templates/classic/styles.css` is an ordered import manifest; readable implementation lives
in `src/templates/classic/styles/`. Keep this order when moving declarations: it preserves
the existing cascade. New shell-local styles use a CSS Module. Tokens belong in
`src/styles/theme.css`; global reduced-motion policy belongs in `motion.css`.
Run `npm run format:styles` before the CSS contract check.

`MediaCarousel` is the generic carousel. Image intrinsic dimensions come from the
generated media manifest, not manual `size`, `mobileSize` or `imageSize` fields.
Art-directed image selection and intentional thumbnail cropping remain explicit.
An empty carousel does not mount its observed content; filling it later mounts
the root and observer together. Autoplay subscribes to the shared live media-query
store rather than an animation-library hook that only snapshots the preference.
Photo hover scale and tilt derive from that same live preference; disabling motion
while hovered returns both to rest, and pointer exit always clears tilt targets.

Run `npm run check`, `npm run qa:all`, and `npm run qa:visual-fixtures`.
`npm run qa:profiles` runs the real homepage in an isolated minimal profile with
all optional features disabled, one greeting and one portrait. These expectations
are selected through a test-only `QA_PROFILE_PATH`, never by rewriting the author
profile. CI runs both component fixtures and this minimal-profile flow.
QA closes only the browser instances and server process trees it owns. The
ownership regression keeps an independent browser alive across a child QA run;
there is no machine-wide Playwright/Chrome process cleanup.
The lifecycle suite tests interrupted motion, live reduced-motion preference,
menu keyboard behavior, deep links and server HTML without JavaScript. Profile
tests cover demo, personal, disabled-content and publication output states.
Fixtures exercise empty/single/multiple media and portrait content at three widths.
Geometry tests cover six widths and real scrollbar gutters. Reports and screenshots
are evidence for those states, not a guarantee about every browser or device.

Reviewed, platform-specific visual baselines are tracked separately from ignored
test artifacts. CI enforces geometry and pixel budgets; see [VISUAL-QA.md](VISUAL-QA.md)
for explicit baseline approval, cross-engine checks and throttled motion budgets.
`npm run build` publishes and validates the author's content, then compiles; the
compiler performs TypeScript checking. It runs no repository test suites, so a
site builds the same way on an author's machine and on a host. `npm run check`
is the maintainer gate: lint, the branch boundary, the content test suites, then
that build. The profile publication guard lives inside `content:build` and
applies to both.
Keep validated byte snapshots and atomic publication: optimize further asset
scans only after measuring larger content sets, not by weakening integrity checks.

Profile commands and publication share `.generated/project.lock`. The CLI and
personalization wizard use `updateProfile`; preparation binds the profile bytes
and previous publication to the target project's catalog, schema and routes.
Publication rechecks these versions after staging and rejects stale preparations.
Unchanged generated text retains its timestamp. The development watcher reads a
fresh project context on every rebuild, including changes to route definitions.

An interrupted profile update keeps `.generated/profile-update.json`, containing
the exact previous and next profile text. Stop the recorded writer before recovery.
Recover any `.generated/content-transaction-*` journal first, as described above.
Compare the author profile with both recorded versions; never overwrite later
author edits. Reconcile the intended source, then remove the resolved profile
journal and project lock and run the guarded content build. The generated-output
transaction never writes author files. A live lock is not stale just because a
second command wants to build.

Personalization creates content-addressed placeholder assets without overwriting
existing author files. The same project lock covers these additions and profile
publication; failed validation removes only unchanged files created by that run.
An unresolved profile recovery retains its new assets alongside the journal.

Template metadata, each template view and each plugin slot have separate generated
modules. `qa:route-loading` verifies the production document's module ownership;
Next Link's later speculative prefetch is measured separately from that graph.
The extension browser suite verifies the same Markdown/JSON-LD semantics with
Classic and an independent template, in addition to plugin lifecycle behavior.

## Repository visibility and ownership

Repository visibility and deployment visibility are independent. The current
FolioWeave repository is public, so every committed branch and its history must be
safe to publish. A branch name is a workflow/profile boundary, never an access
boundary.

`main` and `develop` own the reusable starter and canonical demo profile;
`personal` owns the maintained public author profile. The boundary checker keeps
profile-derived outputs with their author inputs and prevents personal content from
becoming the starter default. It also protects the reusable-core/demo dependency
boundary.

Secrets, credentials, private records and confidential media must stay outside Git
history. If a future authoring workflow genuinely requires confidentiality, use a
real access boundary rather than a branch convention. Deployment authentication
remains a separate choice from repository visibility. See
[REPOSITORY-MODEL.md](REPOSITORY-MODEL.md).
