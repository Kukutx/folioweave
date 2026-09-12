# Content, publication and interaction contracts

FolioWeave is a single application with a reusable implementation and separately
owned author content. It does not maintain legacy runtime configuration formats.

## One authoring and build workflow

Edit `portfolio.json`, Markdown in `content/blogs/`, and original files in
`content/assets/portfolio/`. URLs remain `/portfolio/...`; source filesystem paths
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
`src/demo/`. App Router entry files stay under `src/app/` as thin filesystem route
shims and may import that demo layer. Reusable modules under `src/config/`,
`src/components/`, `src/content/`, `src/hooks/`, and `src/lib/` must not depend on
`src/demo/`. `qa/demo-boundary.test.mjs` enforces that dependency direction and
keeps known demo-brand copy out of the generic config/component layers.

## Server and client ownership

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
Before image decode, source dimensions reserve the fitted box; after decode,
intrinsic sizing retains the original optimized-image rounding and appearance.

## Visual ownership and verification

Approved visual output is a compatibility contract. Refactoring, performance work,
dependency upgrades, and abstraction do not permit visible drift unless the prior
visual is explicitly identified as incorrect. Never regenerate baselines merely to
silence a failure; review the cause and accept only the intended regions. See
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

`src/app/globals.css` is an ordered import manifest; readable implementation lives
in `src/styles/portfolio/`. Keep this order when moving declarations: it preserves
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
`npm run check` runs lint then the production build, whose prebuild runs content
generation/validation once and whose compiler performs TypeScript checking.
Keep validated byte snapshots and atomic publication: optimize further asset
scans only after measuring larger content sets, not by weakening integrity checks.

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
