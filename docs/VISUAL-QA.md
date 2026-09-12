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
- Both checks write ignored screenshots under `qa/screens/` and JSON reports
  under `qa/`. Stable named review directories are cleared before capture;
  successful pixel-regression runs also delete their per-run screenshots and diff
  images, while failures retain them for diagnosis/artifact upload. Inspect
  retained failure screenshots as well as assertions: hit testing alone cannot
  establish which element is painted on top of another inert element.

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

`qa:runtime` tests reduced/normal motion at 390px/1440px in two profiles: native
CPU/network and constrained (4x CPU slowdown, 150ms latency, 200,000 B/s download).
The mobile viewport also enables touch/mobile browser behavior. It exercises repeated
menu/portrait/gallery actions and a four-second scroll. Gallery actions wait for
the image to decode and the response to become visible before the next action;
rapid interruption belongs to the separate lifecycle suite. Blocking synthetic
budgets are:

| Metric | Native | Constrained |
| --- | --- | --- |
| CLS | 0.1 | 0.1 |
| LCP | 2500ms | 6000ms |
| Longest main-thread task | 200ms | 500ms |
| Event-duration p95 | 200ms | 300ms |
| Frame-interval p95 | 50ms | 100ms |

Constrained interactions above 200ms remain explicit report warnings. These
budgets distinguish normal responsiveness from stress tolerance; they are not a
claim of 60fps, field INP or good real-user Core Web Vitals. Empty event samples
mean no events above the observer's 16ms reporting floor, not zero latency.
Each scenario has three cold-context samples: timing gates use their median,
while CLS uses their worst value. Every raw sample is retained alongside the
summary. This dampens host scheduling noise without averaging away layout shifts.
`qa:runtime-diagnostic` inspects one constrained desktop/reduced-motion sample;
`qa:runtime-trace` also captures a Chrome timeline and sampled CPU profile.
`qa:runtime-trace-normal` selects normal motion; `--motion=normal|reduce` is only
valid in diagnostic mode and cannot shrink the acceptance matrix.
`qa:runtime-diagnostic-normal` omits profiler overhead; `qa:runtime-trace-mobile`
targets the constrained mobile/normal-motion case. `--viewport=mobile|desktop`
is also diagnostic-only. `qa:runtime-diagnostic-native` selects desktop normal
motion without CPU or network throttling; `--profile=native|constrained` is
diagnostic-only. Long-task records include duration, start time and QA phase,
rather than an unlocatable duration alone. Trace marks
separate loading, hero actions, scrolling and gallery actions. Reports include
Node/browser/platform, CPU count, total memory and available host memory before
and after each sample. Memory snapshots are diagnostic context, not a substitute
for measuring contention throughout a run. Separate diagnostic output is not the
full matrix and profiling overhead can exceed the budgets.

`qa:gallery-loading` deliberately holds the large image response and compares
the undecoded/decoded image box. The viewer must reserve the final dimensions
before pixels arrive; HTML width/height alone do not suffice with `width:auto`.

Core UI tests use deterministic weather responses. `qa:weather` separately checks
fresh, 503 unavailable, malformed, timeout and recovery states. Unit tests exercise
the actual HTTP boundary with injected transports, including cache headers and
disabled-feature behavior. `npm run qa:upstream` is the explicit live-service
health diagnostic; upstream outages must not become unrelated visual failures.

## Local verification checkpoints — 2026-09-08

Build, TypeScript, lint and 28 content/contract tests passed. The visual comparison
passed 48 regions with 0px geometry drift. Three browser engines, reusable fixtures,
the minimal profile, modal lifecycle and viewport-scoped parallax checks passed.
These are local results; the configured GitHub jobs have not been executed here.

The earlier 24-sample runtime matrix **did not pass in full**. Native scenarios and
constrained mobile scenarios passed. Remaining constrained desktop results:

| Motion | Event-duration p95 | Frame-interval p95 |
| --- | --- | --- |
| Reduced | 440ms (limit 300ms) | 183.3ms (limit 100ms) |
| Normal | 272ms (within 300ms) | 150ms (limit 100ms) |

Values use the three-sample median specified above. Timing varied between runs;
that was not evidence that the unresolved cost was solely environmental.
Subsequent tracing found a code-level cause: the universal 0.01ms transition
duration activated inherited color transitions even on otherwise static elements.
A four-second reduced-motion scroll emitted 1,290 transition starts in the trace.
The fix removes CSS transitions in reduced-motion mode and removes duplicate
CSS interpolation of navigation Motion values. The lifecycle suite now requires
zero CSS transition-run events during a reduced-motion scroll.

The first post-fix visual run found a 767px photography raster difference with
unchanged geometry. An in-browser compositing probe reduced the difference from
5,436 pixels to zero. Image compositing now shares the near-viewport lifecycle
with parallax; distant images release the hint. The subsequent complete visual
comparison matched all 48 baseline regions exactly (zero changed pixels, 0px
geometry drift), without baseline changes. Live reduced-motion switching,
offscreen release/reactivation, 20 functionality checks and all three browser
engines passed after this change.

The post-fix 24-sample matrix still **did not pass in full**. Six of eight
scenarios passed; two normal-motion desktop gates remain unresolved:

| Scenario | Event-duration p95 | Frame-interval p95 |
| --- | --- | --- |
| Native desktop, reduced motion | 104ms (limit 200ms) | 16.8ms (limit 50ms) |
| Native desktop, normal motion | **264ms** (limit 200ms) | 16.8ms (limit 50ms) |
| Constrained desktop, reduced motion | 160ms (limit 300ms) | 50ms (limit 100ms) |
| Constrained desktop, normal motion | 272ms (limit 300ms) | **133.4ms** (limit 100ms) |

Both native mobile scenarios and both constrained mobile scenarios passed.
All eight scenarios passed CLS, LCP and longest-task budgets. The native desktop
normal-motion event p95 was 264ms in all three samples; the slow keyboard events
corresponded to gallery image navigation, predominantly presentation time rather
than input processing. Preserve this failing result, including the regression
from the earlier native checkpoint. The normal-motion trace additionally shows
scroll-time style/layout work and gallery layerization costs; those observations
are leads, not proof of a single remaining cause. Do not remove blur, shorten
animations or loosen thresholds merely to hide these failures.

Reproduce performance acceptance with `npm run qa:runtime`; the public runtime
commands start and own their production server, while `*:direct` scripts are
internal targets used by the shared QA runner. Inspect the ignored
`qa/runtime-budget-report.json` for every raw sample and event breakdown. Do not
keep rerunning unchanged code to select a green result.
Neither a single diagnostic pass nor a profiling trace replaces the full matrix.

### Final checkpoint for this iteration

Further fixes scope foreground Motion subscriptions to near-viewport sections,
separate gallery blur from moving images, and retain only the open modal's opacity
layer. The original opaque background and animation curves remain unchanged.
An intermediate matrix passed seven scenarios but failed constrained mobile
normal-motion longest-task median (730ms). The next matrix passed seven scenarios
but failed native desktop normal-motion event p95 (224ms); it also retained a
1,287ms constrained desktop load-task outlier. A permanent image-layer experiment
improved one diagnostic but changed image rasterization and was removed, not
accepted by updating baselines. These intermediate failures are not explained
away as host noise.

The final production build passed all eight scenarios / 24 cold-context samples,
with no budget failures or 200ms constrained-interaction warnings:

| Profile / viewport | Motion | Event-duration p95 | Frame-interval p95 |
| --- | --- | --- | --- |
| Native / 390 | Reduced | 32ms | 16.8ms |
| Native / 390 | Normal | 40ms | 16.7ms |
| Native / 1440 | Reduced | 112ms | 16.7ms |
| Native / 1440 | Normal | 168ms | 16.8ms |
| Constrained / 390 | Reduced | 80ms | 16.8ms |
| Constrained / 390 | Normal | 80ms | 33.4ms |
| Constrained / 1440 | Reduced | 128ms | 16.8ms |
| Constrained / 1440 | Normal | 176ms | 33.4ms |

Native desktop normal-motion raw event p95 samples were 176, 168 and 160ms;
constrained desktop normal-motion samples were 152, 176 and 192ms. All scenarios
also passed CLS, LCP and longest-task budgets. Host memory snapshots ranged from
1.44 to 4.95GiB available; no concurrent builds or other QA suites ran during this
matrix. Results remain local synthetic measurements, not real-user INP or a
guarantee of performance on every device.

The final visual comparison matched all 48 regions exactly: zero changed pixels
and 0px geometry drift, with no baseline edits in this iteration. Chromium,
Firefox and WebKit passed at 390 and 1440px. Classic-gutter modal open/close
repeated five times with zero scroll shift. Build, TypeScript, lint, 28
content/contract tests, functional/error-state/media/font/resume checks, bundle
budgets, slow gallery loading, lifecycle checks, reusable fixtures (including live
hover preference switching), and the minimal profile passed. The suites were
executed individually and with the shared runner; this does not claim that the
earlier interrupted `qa:maintainer` invocation passed.

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
