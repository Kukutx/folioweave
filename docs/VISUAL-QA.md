# Visual contracts

A reviewed visual baseline is a compatibility contract, not a disposable test artifact. Refactors, performance work, and dependency changes must preserve approved output unless the previous visual has been explicitly judged incorrect. Never regenerate the whole baseline set simply to make a regression test pass. See [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

The browser and React reviews resulted in native modal layering, responsive
image source selection before hydration, removal of eager original-image
preloads, and explicit coverage of optional media states. These changes are
shared application behavior; profile content and artwork remain separate.

## Repeatable checks

- `npm run build && npm run qa:all` checks the production site, including six
  widths: 360, 390, 767, 768, 820, and 1440 pixels.
  It also checks a desktop browser with classic scrollbars exposed, so a
  zero-width overlay scrollbar cannot accidentally make the scroll-lock test pass.
- `npm run qa:visual-fixtures` checks reusable components in a disposable,
  local-only app: empty/single/multiple carousel slides, repeated placeholder
  images, six About photos, portrait blog covers, and Markdown content. It uses
  the current profile's first hero portrait; no private image path is embedded
  in the shared fixture. Its route never enters the production app.
- Screenshot-producing QA writes ignored evidence under `qa/screens/` while it
  runs and JSON reports under `qa/`. Successful runs delete their screenshot
  directories by default; failures retain them for diagnosis/artifact upload.
  Set `KEEP_QA_SCREENSHOTS=1` when you explicitly want successful local captures
  for manual review. Inspect retained screenshots as well as assertions: hit
  testing alone cannot establish which element is painted on top of another inert
  element.

Install the lockfile-pinned browsers with
`node node_modules/playwright-core/cli.js install chromium firefox webkit`.
Run `npm run qa:visual-compare` after building. It compares against **tracked**
baselines in `qa/baselines/<demo|personal>/<platform>/`, enforcing both a 1px
geometry limit and a 0.2% changed-pixel limit (pixelmatch color threshold 0.15).
Missing regions, missing baselines, damaged image hashes, and a changed browser
version fail closed. Weather and wall-clock time are fixed; artwork is not masked.
The canonical screenshot CI uses Windows 2025 and Playwright's pinned Chromium;
the Linux job tests behavior separately. Baselines are not portable between OSes.

Only for an intentional reviewed visual/content change, run
`npm run qa:visual-baseline` on the canonical platform. This explicitly replaces
baseline candidates; inspect their images and Git diff before staging/accepting.
CI refuses this update command and never auto-accepts changes. Both commands own
their local production server. The manifest records browser version, geometry,
coverage and image hashes. Personal screenshots are profile-owned material and
are forbidden on core branches by the branch boundary check. A reusable export
must capture and review its own demo baseline, not copy personal screenshots.
Only a profile exactly matching the canonical demo can write the shared demo
baseline; turning on demo routes does not change personal artwork ownership.

The capture loads lazy images, scrolls the horizontal About gallery, captures
full-page and in-viewport section views, and exercises the real lightbox.
It does not hide images, branding or headings. Server-rendered headings remain visible without hydration; in-view captures still verify their context. Reduced
motion makes this matrix stable; the existing functionality suite exercises
normal interactions separately. `node qa/run-with-server.mjs qa:browsers` tests
390px/1440px navigation, native modal layering, repeated open/close, focus and
overflow in Chromium, Firefox and WebKit. These are desktop engine tests, not
physical-device Safari certification.

## Performance and service contracts

`npm run qa:runtime` exercises reduced and normal motion at 390px and 1440px in
two synthetic profiles: native CPU/network and constrained (4x CPU slowdown,
150ms latency, 200,000 B/s download). The mobile viewport also enables touch and
mobile browser behavior. Each scenario uses three fresh browser contexts and the
summary uses the median for timing metrics while CLS keeps the worst sample.

Runtime QA deliberately separates deterministic application budgets from timing
that is strongly affected by the host compositor/scheduler:

| Metric                                          |               Native |          Constrained | Local `qa:runtime` | Reference CI |
| ----------------------------------------------- | -------------------: | -------------------: | ------------------ | ------------ |
| CLS                                             |                  0.1 |                  0.1 | fail               | fail         |
| LCP                                             |               2500ms |               6000ms | fail               | fail         |
| Interaction work p95 (input delay + processing) |                 50ms |                100ms | fail               | fail         |
| Longest main-thread task                        |                200ms |                500ms | warn               | fail         |
| RAF frame-interval p95                          |                 50ms |                100ms | warn               | fail         |
| Event-duration p95                              | 200ms warning target | 200ms warning target | warn               | warn         |

This split does not loosen protected CI. GitHub `validate` sets
`QA_RUNTIME_REFERENCE=1`, so the full long-task and frame budgets remain blocking
on the reference runner. Use `npm run qa:runtime-reference` to request the same
strict host-sensitive gate locally. Ordinary `npm run qa:runtime` still fails on
CLS, LCP and deterministic interaction-work regressions, but records host-sensitive
long-task/frame overruns as warnings instead of treating machine pressure as an
application failure.

Event Timing includes presentation delay, which can move substantially with a
headless compositor even when input queueing and handler work are unchanged.
For that reason raw event-duration p95 is diagnostic-only and its 200ms target is
a warning in every mode; deterministic interaction work is gated separately.
These synthetic budgets are not field INP, a 60fps guarantee or real-user Core
Web Vitals.

`qa:runtime-diagnostic` runs one constrained desktop/reduced-motion sample and
reports every overrun without failing. `qa:runtime-trace` additionally captures a
Chrome timeline and sampled CPU profile. The normal/mobile/native diagnostic
variants narrow that diagnostic sample only; they cannot narrow the acceptance
matrix. Profiling overhead can itself exceed timing budgets, so a trace is evidence
for investigation, not an acceptance result.

Runtime reports include Node/browser/platform, CPU count, total/free host memory,
budget mode, raw samples, event breakdowns and QA phase marks. Inspect the ignored
`qa/runtime-budget-report.json` when diagnosing a run. Do not rerun unchanged code
merely to select a green sample; the protected GitHub reference run is the shared
acceptance authority for host-sensitive timing.

`qa:gallery-loading` deliberately holds the large image response and compares the
undecoded/decoded image box. The viewer must reserve the final dimensions before
pixels arrive; HTML width/height alone do not suffice with `width:auto`.

Core UI tests use deterministic weather responses. `qa:weather` separately checks
fresh, 503 unavailable, malformed, timeout and recovery states. Unit tests exercise
the actual HTTP boundary with injected transports, including cache headers and
disabled-feature behavior. `npm run qa:upstream` is the explicit live-service
health diagnostic; upstream outages must not become unrelated visual failures.

Historical optimization checkpoints and one-off timing samples belong in Git
history and generated QA reports, not in this living contract. Keep this document
aligned with the current scripts and protected CI semantics.

## Invariants

- The lightbox uses `dialog.showModal()`, the browser's top layer and native
  background inertness. Do not replace it with ever-larger `z-index` values.
- Scroll locking preserves an existing scrollbar gutter without adding a
  gutter to overlay-scrollbar devices. Focus and scroll position are restored.
- Image elements must respect their natural aspect ratio unless the card
  explicitly owns a crop. Blog cover height is automatic; gallery thumbnails
  use `fill` inside fixed-ratio cards.
- Project art direction uses `<picture>` and Next's `getImageProps`, not a
  post-hydration `src` swap. Carousel images remain inside a stable frame.
- About photo transforms repeat safely. Desktop galleries use safe centering
  and horizontal scrolling when more photos no longer fit.
- Carousels pause for keyboard focus and reduced motion; original images are
  not eagerly fetched in addition to the optimized image requests.

Fixture sandboxes live only under ignored `.generated/qa-sandboxes/` inside the
FolioWeave project. Each run removes its `node_modules` junction/symlink first,
then deletes the disposable sandbox before exiting. QA must never create or retain
sibling project, verification, cleanup, artifact, or Git-worktree directories.

## Interaction lifecycle

`npm run qa:profiles` exercises an isolated real homepage with optional sections,
weather and resume disabled, plus a single greeting/portrait. The functionality
suite verifies absent features instead of requiring the personal profile's layout.
`qa:ownership` keeps an independent browser session alive while a child QA runner
starts and stops its own server. Browser cleanup must never scan and kill unrelated
Playwright/Chrome processes on the host.

`qa:all` also runs `qa:lifecycle`: decoration cancellation, live reduced-motion
changes, main landmark coverage, Escape/focus/inert cleanup, hash reload and
JavaScript-disabled content. It also requires zero CSS transition-run events
during a reduced-motion scroll, no duplicate CSS navigation interpolation, and
viewport-scoped image compositing in both motion modes. Offscreen theme scopes
must stop receiving foreground updates while the photography scope becomes white.
Fixtures also clear/refill a carousel, verify that autoplay resumes, then stop it
with a live reduced-motion change. Switching the same preference during photo
hover must clear both scale and tilt. Font-failure tests block every local webfont,
including Caveat, and assert readable content without overflow. They report font
metric differences instead of pretending different font families are identical.

CSS source formatting is enforced. CI runs component fixtures and retains reports
and screenshots on failure. See [ARCHITECTURE.md](ARCHITECTURE.md).
