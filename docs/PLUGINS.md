# Shared plugins

Plugins are trusted source modules under `src/plugins/<id>/`, selected at build
time. Both shipped plugins are disabled by default. They work through public
configuration and semantic slots rather than a template's DOM structure.

```sh
npm run folio -- plugins
npm run folio -- plugin enable music --options music-options.json --dry-run
npm run folio -- plugin enable music --options music-options.json
npm run folio -- plugin disable music
npm run folio -- doctor
```

Stop development before changing extension configuration, then restart it.
Disabled options stay in the author's profile but disappear from generated
configuration, plugin imports, network policy and published plugin-only assets.
Removing an asset from publication never deletes its author source.
Dormant extension options and their assets are validated when enabled again;
removing a disabled plugin's code does not invalidate the retained settings.
Ordinary author content, including draft articles, still receives source validation.

## Music

Put local audio under `content/assets/portfolio/audio/` and optional artwork under
`content/assets/portfolio/covers/`. HTTPS direct audio and artwork URLs are also
supported. An options file contains:

```json
{
  "label": "Listening",
  "skin": "capsule",
  "position": "right",
  "theme": "graphite",
  "initialExpanded": false,
  "autoplay": false,
  "volume": 0.7,
  "notes": {
    "enabled": false,
    "colors": ["#cf8750", "#ac719b", "#528ba6"]
  },
  "tracks": [
    {
      "id": "evening",
      "title": "Evening",
      "artist": "Your artist",
      "src": "/portfolio/audio/evening.mp3",
      "cover": "/portfolio/covers/evening.webp"
    }
  ]
}
```

Supported local file extensions are MP3, M4A, OGG, WAV, AAC and FLAC. Actual codec
playback depends on the browser. Files are validated for path/existence and
published as hash-checked byte snapshots; a corrupt or unsupported audio stream
is reported by the player. No tracks are bundled or enabled on the author's behalf.
Track ids must be unique. `cover` is optional per track, local or HTTPS: it
becomes the label at the centre of the record (the whole tile in the `square`
skin) and the artwork the system shows for the track. A missing or failed cover
leaves the built-in label with its note. Local artwork uses the same validated
publication pipeline as other profile images.

The player uses `site.floating` and portals its UI into the document body so a
template's transforms or clipping cannot trap it. It uses `preload="none"` and
waits for the visitor unless `autoplay` is set. One instance lives in the root
layout, so Next.js client navigation keeps playback. A full document
navigation/reload restarts the app; there is no promise of playback across a
browser reload. Unmounting releases playback.

`autoplay` starts the first track on arrival. Browsers decide whether a page may
make sound before the visitor has touched it, and most refuse a first visit.
The player then stays silent, shows no error, and starts on the visitor's first
click, tap or key press anywhere on the page; scrolling alone does not count. A
press on the player itself is the visitor taking over, so it cancels the wait
instead. No setting can override the browser's rule.

While a track plays, the player also registers with the system's media session:
the keyboard's media keys, a headset's buttons and a phone's lock screen show
the title, artist and cover and can play, pause and change track.

| Option            | Values / default                                          |
| ----------------- | --------------------------------------------------------- |
| `label`           | The player's accessible name; defaults to “Music player”  |
| `skin`            | `capsule` (default), `square`                             |
| `position`        | `right` (bottom-right, default), `bottom` (bottom-center) |
| `theme`           | `graphite` (default), `porcelain`, `cobalt`               |
| `accent`          | Optional six-digit hex; otherwise follows the theme       |
| `initialExpanded` | `false` by default; disclosure is always the left artwork |
| `autoplay`        | `false` by default; `true` starts on arrival (see above)  |
| `volume`          | 0–1, default 0.7; device media policies may override it   |
| `notes.enabled`   | `false` by default; visitors can toggle in the playlist   |
| `notes.colors`    | Exactly three six-digit hex colors                        |

Audio and artwork origins are derived from enabled tracks and added only to
`media-src` and `img-src` respectively. Credential-bearing URLs, HTTP, invalid
local paths and unknown options fail validation. Use final direct URLs: redirects
to a different, undeclared origin remain blocked. Remote resources must permit
browser embedding and use supported codecs. Configuration is public; never put
private credentials in URL query strings. Third-party playlist/share-page
providers are not adapters in this version.

Transport and progress have separate subscriptions; time updates do not rerender
the playlist or record. Collapsed controls unsubscribe from progress updates and
catch up when expanded; audio continues normally. Notes use four fixed SVGs with CSS transform/opacity
animation. Playback, buffering, document visibility and reduced-motion preferences
gate animation. The playlist is mounted only while open. Async playback requests
are invalidated on track changes, cancellation and unmount; failures can be retried.
Changing track metadata or order preserves the current audio identity when its id
and URL remain the same. Removing that track pauses and resets selection.

### Design sample and verification

The [interactive sample](design/music-player-concept.html) opens directly in a
browser and consumes the **same player stylesheet** as the runtime CSS Module.
Only its settings controls and silent demo transport are sample-specific. Importing
local files here does not modify the site's profile or upload files.

The music manifest is also the source of its TypeScript options, default values
and theme accents. After changing its schema, run `npm run plugins:generate`.
Do not edit `options.generated.ts` or `music-player-defaults.js` by hand.
`npm run plugins:check` rejects stale output during lint and before builds. Other
plugins can opt in with `generateOptions: true` and an `optionsSchema.title`
ending in `Options`. Defaults are collected from object properties; an explicit
object default takes precedence. Required authored values such as tracks are
still validated when the plugin is enabled; generation does not invent them.

Run `npm run qa:music` for controller/configuration regressions,
`npm run qa:music-concept` for the sample's responsive/interaction matrix, and
`npm run qa:extension-browser` for isolated production builds, local and mocked
HTTPS playback, navigation persistence, failure/retry, and disabling cleanup.
Use `npm run qa:music-concept -- --screenshots` to refresh the sample images.

`npm run qa:music-quality` adds Chromium/Firefox/WebKit checks and a third isolated
production build to compare the **same template with only music disabled**.
It writes `qa/music-quality-report.json`: decoded JS/CSS sizes, estimated gzip
increments, no-preload checks, and three Chromium runtime samples per state
(notes off, notes on, paused). The incremental budgets are 24,000 gzip bytes of
JS and 8,000 gzip bytes of CSS. Timing samples are diagnostic because host load
affects them; the test does not claim a device-independent CPU score. The suite
also checks bounded DOM, paused animations, failure/retry, delayed media,
keyboard focus, reduced motion, collisions and panel exclusion. CI runs it.

Playwright WebKit is browser-engine coverage, not an iPhone/Safari certification.
Physical iOS/Android playback, interruptions and hardware volume behavior require
real-device verification separately.

### Shared floating surfaces

Only plugin-owned controls participate in `src/core/floating-surfaces.ts`.
The root must declare `data-plugin`; registering a native site control is rejected.
The Classic Home button keeps its original layout and behavior. A plugin must
reserve its own space, using `offsetBottom` for music when required, rather than
moving a template's controls. New floating plugins can use `useFloatingSurface(priority)` as a React 19
callback ref, or `registerFloatingSurface(element, priority)` with its returned
cleanup. Keep the surface viewport-fixed (a body portal avoids template clipping)
and include the coordinator's offset variables in its CSS:

```css
.widget {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  translate: var(--fw-float-x, 0px) var(--fw-float-y, 0px);
}
```

CSS still defines the preferred position. Centered controls must add the offsets
to their existing `-50%` translation. Higher priority keeps its anchor; music uses 10. Ties use registration order. Layout keeps a 10px
gap where space permits and clamps to the visual viewport. The coordinator reacts
to size/viewport changes and batches reads and writes in one scheduled frame;
there is no permanent animation loop. After programmatically changing only a CSS
anchor, call `refreshFloatingLayout()`. A displaced surface receives a
`floatinglayout` event so its popovers can reposition.

For a nonmodal panel, acquire `claimFloatingPanel(element, close)` when it opens
and call the returned release function when it closes. A new owner closes the
previous panel without moving focus. Modal dialogs retain their own focus rules.
Unmounting the last registered surface releases observers, viewport listeners
and pending frames. The optional notes and media progress do not trigger layout.

Only registered controls participate; arbitrary external widgets are not scanned
or modified. When the viewport cannot fit all controls, `data-floating-crowded`
is `true` on the affected surface. Plugin authors should offer compact controls
or hide optional controls in that case. This is an opt-in coexistence contract,
not an unlimited-space guarantee or a substitute for a template's navigation
safe areas.

The default capsule is 320 × 56px. Right mode collapses to a 56 × 56px record.
Bottom-center mode slides below the viewport and leaves a double-chevron reveal
button with a 64 × 44px transparent hit area. Its glass double arrow floats upward
by 2px as one CSS animation; reduced motion disables it and background tabs pause
it. Hidden controls are inert; keyboard focus moves
between the record and reveal button, without interrupting audio. Only the visible
surface participates in plugin collision handling. On narrow screens the centered
capsule reserves side space; tracks remain selectable in the playlist.

Optional notes rise from the bottom edge in center mode. The subtle bottom glow
shares their three colors and switch. Both are decorative CSS animations, gated
by playback, page visibility and reduced-motion preferences, not beat detection.

Optional
`offsetBottom` (0–240 CSS pixels) changes only the plugin’s bottom spacing.
Omit it to use the template's `--fw-floating-bottom-right` or
`--fw-floating-bottom-center` token. Classic defaults to 80px on the right and 16px
at bottom center, adjusted for safe areas. Templates without these tokens use
24px on desktop / 18px on small screens. Explicit values override the template
default; native controls are unchanged.

## Comments: independent guest UI

The comments plugin ships a native React interface backed by the
[Waline API](https://waline.js.org/en/reference/server/api.html). Readers can
comment as guests; account login is off by default and can be enabled explicitly.
It is **not enabled in any shipped
template or author profile**. Preview it independently:

```sh
npm run preview:comments
```

Open the local URL printed by the command. The playground includes light/dark
themes, two layouts, accent colors, optional login, multiple article identities,
and empty/error/moderation states. Its local service stores demo comments in
memory; restarting discards them. It sends nothing to a real comments server.
Stopping the command removes its own sandbox under `.generated/`.

For later production use, deploy a
[Waline service](https://waline.js.org/en/guide/get-started/) with persistent
storage and allow the site's origin. Example **public** options:

```json
{
  "provider": "waline",
  "serverURL": "https://comments.example.com",
  "theme": "preferred_color_scheme",
  "appearance": "minimal",
  "login": "disabled",
  "loading": "viewport",
  "pageSize": 6,
  "maxLength": 2000
}
```

Saving options alone does not activate a plugin. The existing explicit CLI enable
command below is the later integration step, when wanted. No app API routes or
database are installed by this plugin. `serverURL` may include a service base
path, must use credential-free HTTPS, and cannot contain a query or fragment.
Only its exact origin is added to `connect-src` when enabled.

The native UI supports posting, replies, likes, newest/oldest/most-liked sorting,
pagination, safe Markdown, and server moderation status. Comments are keyed by
the host-supplied permanent article ID, never by title or template DOM. Name is
required for guests; email is optional and omitted from public rendering. Backend
guest/email requirements must match these settings. Rate limits, spam filtering,
moderation, email delivery and deletion remain the service owner's responsibility.
This adapter does not implement uploads, rich HTML or CAPTCHA challenges; a
service requiring a CAPTCHA needs a matching challenge adapter before use.

`login: "disabled"` (default) removes the entire account header. Set
`login: "optional"` to offer browser sign-in. Optional login uses the service's
own login page in the same tab, preserving the draft and reply target in session
storage for up to ten minutes. The return token is consumed only for the matching
service/article/return URL and removed from the address bar. Verified sessions
are kept for at most one hour in that tab; guest posting still works when storage
is unavailable. These client limits do not replace service-side token expiry.

`loading: "viewport"` (default for Waline) loads comments near the viewport.
`"manual"` contacts the provider only after the reader selects Show comments.
Writes are never retried automatically; a timeout keeps the draft and asks the
reader to refresh first, because the server may have received the write. Requests
are canceled on unmount/article changes. The React UI, transport and session logic
are separate files; another native service adapter can implement `CommentService`
from `src/plugins/comments/types.ts` without importing a template.

Visual options include `appearance: "minimal" | "panel"`, `light`/`dark`/`preferred_color_scheme`
`theme`, a six-digit `accent`, `heading` and `placeholder`. `pageSize` takes 1–30
(default 6) and `maxLength` 100–10000 characters (default 2000). Native UI copy currently
supports Simplified Chinese and English; other configured locales use English
controls with localized dates. Giscus retains its wider native language support.
Advanced theming uses these inherited CSS variables on the plugin's wrapper:

| Variable                                          | Purpose                           |
| ------------------------------------------------- | --------------------------------- |
| `--fw-font`                                       | Font family                       |
| `--fw-comments-width`                             | Maximum width (default 760px)     |
| `--fw-comments-radius`                            | Composer/panel corner radius      |
| `--fw-comments-surface`                           | Composer/panel background         |
| `--fw-comments-text`, `--fw-comments-muted`       | Text colors                       |
| `--fw-comments-border`, `--fw-comments-soft`      | Separators and secondary surfaces |
| `--fw-comments-accent`, `--fw-comments-on-accent` | Action background/text pair       |

An explicit `accent` option automatically chooses contrasting button text; when
setting the two CSS color tokens manually, choose a readable pair. Links and
keyboard focus use the readable text color rather than an
arbitrary accent. Comment entries and Markdown bodies are memoized, so editing a
draft does not re-render the existing conversation. Styles are
scoped CSS Modules, adapt to container width and respect reduced-motion/forced
colors. No external avatar requests, remote fonts, iframe skin or animation engine
is required for the native UI. HTML, images and unsafe Markdown links are omitted.

`npm run qa:comments` checks the transport/options and runs the actual UI against
an isolated production build with a local fixture service. The login fixture
tests return/restore behavior, not a real deployment's account providers.

## Comments: Giscus

The alternative comments adapter uses [Giscus](https://giscus.app/), backed by GitHub
Discussions. Configure a public repository with Discussions enabled and the Giscus
app installed. Copy the public repo/category identifiers from its configuration
page into an options file:

```json
{
  "provider": "giscus",
  "repo": "your-account/your-discussions",
  "repoId": "R_YOUR_REPOSITORY_ID",
  "category": "Announcements",
  "categoryId": "DIC_YOUR_CATEGORY_ID",
  "theme": "preferred_color_scheme",
  "lang": "en"
}
```

```sh
npm run folio -- plugin enable comments --options comments-options.json
```

These identifiers are public and require no site-side secret. Local validation
cannot verify whether the remote repository or category exists. `doctor` reports
that distinction. FolioWeave does not create repositories, install the GitHub app,
or post comments as part of setup or QA.

Comments render in `article.after` on Markdown articles. Readers explicitly load
them; no request reaches Giscus before that action. The official `giscus` widget
is bundled locally and owns sign-in, sizing and listener cleanup; only its
discussion iframe needs an external CSP origin. Loading/network failure has a
retry state and a direct discussions link. An article without an existing
discussion remains ready for its first comment. Only trusted messages from that
discussion iframe update readiness.

When `lang` is omitted, the discussion language follows `site.identity.locale` for
supported languages, including Simplified/Traditional Chinese; unsupported locales
fall back to English. An explicit `lang` takes precedence.

Give articles a permanent `id` before renaming a file:

```markdown
---
id: my-permanent-article
title: A title that can change
date: 2026-10-08
description: An article description.
---

## Introduction

Article content.
```

The default identity is the filename slug. If an article already has comments
using that default, pin `id` to the **old slug** before renaming. Changing the id
changes the discussion mapping. Duplicate explicit or fallback ids fail content
validation. Template switching does not affect the mapping. Custom hand-authored
article routes can import the default slot component from
`@/portfolio/plugins-article-after.generated` in a Server Component and pass a
`PluginContext` with an explicit stable article identity; the core does not guess
identities for arbitrary demo pages.

## Create another plugin

A plugin directory contains a `manifest.json`, a component entry and local styles.
Use the music/comments implementations as complete examples. The manifest declares
`id`, `name`, `description`, `version`, `apiVersion: 1`, `entry`, supported `slots`
and an object `optionsSchema`. Unknown options should be rejected. A plugin
mounts in the first slot its manifest lists; `plugins.<id>.slot` in
`portfolio.json` picks another of them. A plugin's
component accepts `PluginProps<YourOptions>` from `src/core/contracts.ts`.

All enabled configuration is public. Keep credentials in server environment
variables and server-only integrations, never in profile options. The current
plugin contract composes UI; filesystem API routes still need explicit app-level
ownership and the existing publication policy. Installing arbitrary npm packages
or executing remote plugin code is outside this first local-source API.

Optional `network` entries declare exact HTTPS origins for `script-src`,
`connect-src`, `frame-src`, `img-src` or `media-src`. The core unions only enabled
declarations into the existing CSP. Wildcards, arbitrary CSP text and non-HTTPS
origins are rejected. A declaration configures policy; it is not a permission
sandbox for trusted source code.

Optional `networkOptions` derives `media-src`/`img-src`/`connect-src` origins from validated
options, for example `{ "media-src": ["tracks.*.src"] }` or
`{ "connect-src": ["serverURL"] }`. Dot-separated property
names and `*` array traversal are supported. Only local paths or credential-free
HTTPS URLs are accepted; executable script origins cannot be derived this way.
The options validator supports `format: "https-url"` and array `uniqueBy: "id"`.

Keep styles in CSS Modules and consume the `--fw-*` tokens documented in
[TEMPLATES.md](TEMPLATES.md). Do not import template components, install a scroller,
or modify another component's DOM. Clean up listeners, timers, media and embedded
frames on unmount. `PluginBoundary` contains client render errors and offers a
retry that remounts the failed plugin; a new article gets fresh boundary state. Plugins must
handle their own async failures. Server failures require server-side handling.

When a template omits a needed slot, enabling the plugin fails before any profile
write. Add meaningful behavioral tests and extend the browser integration suite
for new lifecycle or transport behavior.
