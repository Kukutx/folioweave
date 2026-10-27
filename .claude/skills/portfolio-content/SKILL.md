---
name: portfolio-content
description: Change what a FolioWeave profile shows (projects, actions, badges, about, timeline, photography, SEO, plugins) on a `personal` branch, then rebuild, check and recapture the affected visual baselines.
---

# Change portfolio content

For author content only; shared code, schema, QA or docs follow
`ship-shared-change`, the resume follows `resume`.

## Where things live

- `portfolio.json`: the profile. `portfolio.schema.json` documents every field.
- `content/assets/portfolio/`: author media, referenced as `/portfolio/...`.
- `content/blogs/`: posts. `content/resume/`: the resume.
- Generated, never hand-edited: `src/portfolio/*.generated.*`, `public/portfolio/`.

## Steps

1. Branch from `personal` (`git switch -c content/<topic> origin/personal`).
2. Edit `portfolio.json` and add media under `content/assets/portfolio/`.
3. `npm run content:build`: regenerates the profile files and validates references.
4. `npm run check`: lint, branch boundary, content tests and the production build.
5. Look at the page at 360, 390, 768, 820 and 1440 px with motion on: wait on
   the hero, scroll every section into view (Work into Photography, where the
   background turns dark) and hover the cards.
6. Visible copy or media changes pixels. On Windows, `npm run qa:visual-baseline`,
   open every replaced image, then `npm run qa:visual-compare`. Commit the
   regenerated files and the baselines with the content.
7. Open a pull request into `personal`; it deploys after `validate` and
   `visual-regression` pass.

## Project cards

- `media.kind: "screens"`: the choice for an app. List the store screenshots
  themselves, in store order, one per entry (1–6), each with alt text for what
  that screen shows. Every width shows the same screens in the same order:
  three side by side where there is room, two on a phone with the rest a swipe
  away. Use `frame: "none"` when the screenshots already include their device
  or window.
- `media.kind: "image"`: one picture (a workbench, a website). Add a `mobile`
  image only when it is genuinely different art.
- `media.kind: "carousel"`: the frame takes the first slide's proportions; keep
  all slides the same size.
- `actions`: any number; the row wraps. `tone: "accent"` marks a secondary
  action. Keep labels short ("View in App Store").
- `badge`: one short fact the reader can check (a store, a licence, an award).
- `story`: one real episode with a real image, not a summary of the description.
- Projects show in the order they are listed.

## Media

- Prefer WebP. Resize phone screenshots to about 900 px wide and keep every
  image well under 500 KB; the build rejects images over 4 MiB (2 MiB for
  photography).
- The social preview (`site.assets.socialPreview`) is a 1200×630 image whose
  file type matches its extension.
- When a product is renamed or redesigned, replace its icon, screens,
  description and listing screenshot together.
- Alt text names what is shown.
- Media bundled with the demo (`public/media`, `public/brink`, …) belongs to the
  demo; a personal profile uses its own.

## Copy

- Every visible line is the author's own and every fact comes from their
  material. Text left from the demo profile (the interlude, the footer note,
  greetings) is replaced by the author.
- Write copy that stays true after the next update: past dates are fine, but no
  "now" or "currently", no present status, and nothing that names what a
  gallery or repository happens to contain.
- The About story's `strong` segments are its TL;DR: each one a full sentence
  that ends with a period and reads on its own, together a short summary. Keep
  colons, "so" and other links to the muted text out of them.
