# Changelog

FolioWeave follows [Semantic Versioning](https://semver.org). A major version
changes the profile schema or an extension contract in a way that needs a
migration ([docs/UPGRADING.md](docs/UPGRADING.md)); a minor version adds
features; a patch fixes behaviour. Every release is a tag on `main` with the
same notes as a GitHub release.

## 1.2.1 — 2026-11-20

- Tool launcher: its links no longer prefetch while the fan is closed; the
  pages load when the fan opens. A tool page's fonts and code (EmojiCut brings
  about 100 KB of CJK font rules) stay off every page that shows the launcher.
- Tests: the plugin check turns off every plugin the profile has on before it
  expects a page without plugins, so an author's profile with more plugins
  passes it.

## 1.2.0 — 2026-11-20

- Templates: Stack, Pond, Ticket Club and the store template Bottega, driven
  by the profile. A template may bring its own 404 view and its own pages,
  published only when their data exists; Refract Light and Dark get the
  carrier 404.
- Profile: an optional `store` block for shops (locations, hours, catalog,
  services); `site.contact` is optional and the resume is required only while
  it is shown; template `requires` may name a dotted path such as
  `site.contact`; `seo.title` may replace the generated title.
- Plugins: EmojiCut (sticker cutting, and AI design with the visitor's own
  key), the tool launcher that fans out to plugin pages, and the work badge,
  a 3D lanyard with one or more cards that can each be taken, swung and
  flipped. A plugin may add a page under `/tools` or an action opened in place.
- Hosting: the profile's `deployment` block lists Vercel, Cloudflare (OpenNext
  Workers) and Firebase (static export) side by side, built with
  `npm run deploy -- <provider> [--apply]`; `deployment.redirects` keeps a
  replaced site's old addresses working on every host. Live route handlers
  are `route.server.ts` and are left out of static exports.
- Tooling: `preview:template` runs any template on any profile in a sandbox,
  Studio shows the templates as a gallery, and QA follows the selected
  template instead of assuming Classic.
- Dependencies: Next.js 16.4.6, fast-xml-parser 5.12.1, prettier 3.10.1.

## 1.1.5 — 2026-11-06

- Tooling: the lint toolchain's `minimatch` is pinned to 11.0.5, which fixes
  the globparts denial-of-service advisory (GHSA-g3hv-75wg-m249). The site
  itself never ships it.

## 1.1.4 — 2026-11-06

- Classic: on screens up to 768px the About view toggle spans the text column
  as three equal segments instead of sitting against the right edge.

## 1.1.3 — 2026-10-31

- Classic: on screens up to 900px the floating Home button is a 56px circle,
  the same size as the collapsed music record and on the same right edge, with
  a 12px gap between them.

## 1.1.2 — 2026-10-27

- Tests: the extension browser check drops hero brand links when it removes
  the projects, so a profile whose hero links to a Work project passes it.

## 1.1.1 — 2026-10-27

- Tests: the disabled-content test drops hero brand links along with the
  projects, so a profile whose hero links to a Work project passes
  `npm run check`.

## 1.1.0 — 2026-10-27

- Hero brand segments accept `project`: the brand becomes a link that scrolls
  to that Work project (Classic). A brand pointing at a missing or disabled
  project fails the content build.
- TL;DR: a highlighted word reads like the rest of the summary instead of
  turning grey.
- Authoring guidance: copy that stays true after the next update, and About
  story `strong` sentences that work as the TL;DR on their own.

## 1.0.0 — 2026-10-27

The first tagged release.

- Three templates — Classic, Refract Light and Refract Dark — chosen in
  `npm run personalize` and switched with `npm run folio -- template use <id>`.
- New templates start from `npm run folio -- template create <id>`.
- Music and comments plugins, mounted through template slots.
- An atomic, validated content pipeline for the profile, media, Markdown blog
  and routes.
- One-source resume: JSON rendered to a one-page tagged PDF and the printer
  preview, with an optional Word copy offered in the preview.
- Classic: scroll reveals and on-screen openings after its reference design, a
  scroll cue, app screenshots as a row of screens, and a reading preview of the
  printed resume.
- QA across Chromium, Firefox and WebKit, Windows visual baselines, and CI that
  caches its browsers.
