# Changelog

FolioWeave follows [Semantic Versioning](https://semver.org). A major version
changes the profile schema or an extension contract in a way that needs a
migration ([docs/UPGRADING.md](docs/UPGRADING.md)); a minor version adds
features; a patch fixes behaviour. Every release is a tag on `main` with the
same notes as a GitHub release.

## Unreleased

- Stack, Pond and Ticket Club are the author's templates again, exactly as
  they were in 1.2.0. The 1.3.0 rebuilds replaced them with designs nobody
  asked for (a pile of paper, a garden pond, a box office) and are removed.
- Refract Light and Dark have their aircraft-carrier 404 page back, as the
  author asked; 1.3.0 had removed it.

## 1.3.2 — 2026-11-20

- Cloudflare: optimised images (`/_next/image`) are cached as Next caches
  them, four hours and then revalidated. The adapter sent no `Cache-Control`
  for them, so every visit downloaded each optimised image again (about
  1.4 MB on a phone for the author's home page). The Worker entry is now
  `cloudflare-worker.mjs`, which wraps the adapter's Worker.
- CI: the browser jobs keep every system package they install in their cache;
  on ubuntu-26.04 the cache held 16 of about 190, so a slow package mirror
  could run a job into its timeout.

## 1.3.1 — 2026-11-20

- Cloudflare: Next's content-hashed build output (`/_next/static/`) is cached
  for a year, as on Vercel and Firebase. Workers served it with
  `max-age=0, must-revalidate`, so every visit asked again for every script
  and stylesheet.
- Stack: small typed labels that fell under the 4.5:1 contrast WCAG AA asks
  for are one ink darker: the dates and numbers in the deck's index and the
  footer on the bare desk, the place on the calling card and the numbers on
  the contents sheet. The "Now" stamp is printed at full ink.
- Pond: the links under the pond are 24px high to a finger (WCAG 2.5.8)
  without moving their text.
- Ticket Club: each stub's spoken name starts with the words it shows, so
  voice control finds it by them (WCAG 2.5.3).
- Classic: the portrait button's name starts with the caption it shows, the
  brand icon beside its name is decorative, the weather in the menu bar is
  read with its city, and the photo strip is a named region the keyboard can
  reach and scroll, with the cards' focus ring.
- Dependencies: the copy of `minimatch` that `glob` brought in is 11.0.5,
  which closes its denial-of-service advisory (pattern
  amplification).

## 1.3.0 — 2026-11-20

- Stack, rebuilt: one person's pile of paper on a desk. A calling card with
  divider-card tabs as the navigation, the portraits as clipped prints, the
  story typed on a ruled card, the timeline as index cards and every project
  as a mounted board in one deck. Manifest 2.0.0: `camera` and `ending` keep
  their meaning; the labels that were dropped are listed in
  [docs/UPGRADING.md](docs/UPGRADING.md).
- Pond, redesigned: a garden pond seen from above. The home page is the whole
  pond, with koi to feed, lily pads to move and a day/night switch (the moon
  on the water at night); the other pages open on a band of the same water.
  Work shows each project as its own koi in a viewing bowl, photographs
  surface as they scroll in and open over the water, and articles are set in
  Newsreader. The scene is rendered on the server and shows without
  JavaScript; the canvas pauses off screen and in hidden tabs. Its settings
  stay valid, and a new `time` setting chooses day, night or the system's.
- Ticket Club, rebuilt: a box office for one person, printed in red and black
  on warm paper. A roll of admission tickets, one per link, each with a
  scannable QR stub that tears off to copy the link (by pointer or keyboard),
  and a kraft envelope whose letter is the author's story. Manifest 2.0.0:
  `tickets` takes up to six, `stock` and `editionPath` are new, and the
  dropped labels are listed in [docs/UPGRADING.md](docs/UPGRADING.md).
- Refract: the aircraft-carrier 404 that came with 1.2.0 is gone, and Refract
  Light and Dark use the site's own 404 again. The writing pages use the
  RefractDIN typeface of the home page; their stylesheet named a family that
  was never loaded, so they showed Helvetica or Arial.
- Bottega: the "open now" line skips public holidays when it names the next
  opening (on the evening of 24 December it no longer says "tomorrow at
  09:00"), and Easter Monday is an Italian holiday.
- Classic, Refract and Bottega: about 1,350 lines of CSS and code that nothing
  rendered are removed, with no visible change.
- Assets: 33 font files from the original Classic site that no page loaded
  (about 800 KB, among them Google Sans and Satoshi, whose licences do not
  allow redistribution) are removed from `public/fonts`.

## 1.2.1 — 2026-11-20

- Tool launcher: its links no longer prefetch while the fan is closed; the
  pages load when the fan opens. A tool page's fonts and code (EmojiCut brings
  about 100 KB of CJK font rules) stay off every page that shows the launcher.
- Plugins may declare a `budget` (gzip bytes of JS and CSS they add to each
  page). The page bundle budget grows by the budgets of the plugins a profile
  enables, and a new test holds every plugin to its own. Music (24,000 / 8,000,
  as before), the launcher (14,000 / 2,000) and the badge (9,000 / 2,000)
  declare theirs.
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
