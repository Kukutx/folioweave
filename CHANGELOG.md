# Changelog

FolioWeave follows [Semantic Versioning](https://semver.org). A major version
changes the profile schema or an extension contract in a way that needs a
migration ([docs/UPGRADING.md](docs/UPGRADING.md)); a minor version adds
features; a patch fixes behaviour. Every release is a tag on `main` with the
same notes as a GitHub release.

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
