# Personalizing FolioWeave

## Authoring workflow

Edit `portfolio.json`, add original assets under `content/assets/portfolio/`,
and write articles under `content/blogs/`. Browser URLs remain `/portfolio/...`.

```bash
npm ci
npm run personalize
npm run dev
```

The wizard updates identity, contact details and optional social links. Enter
keeps a value; `-` clears optional values. A clean start removes demo content
from the author configuration, creates neutral placeholders, and disables empty
sections. It preserves existing source files without publishing unreferenced ones.

After manual edits:

```bash
npm run content:build
npm run content:check
```

Development and production builds invoke this pipeline automatically. `npm run dev` also watches the authoring inputs and atomically rebuilds valid content without restarting Next.js. Invalid edits leave the last valid generated output in place and print the validation error. Never edit
`public/portfolio/` or generated TypeScript: they are replaceable outputs.

## Configuration

- `site`: identity, origin, locale, location/time zone, contact, social links,
  navigation, resume and site icons.
- `features`: weather, about, work, photography, resume and demoRoutes switches.
- `hero`: greetings, portraits, and rich-text role/summary segments.
- `about`: story paragraphs, gallery images and timeline items. Set
  `current: true` on at most one timeline item; the year is display content.
- `interlude`: transition headings, descriptions and mountain artwork.
- `projects`: ordered project cards, actions and optional stories.
- `photography`: intro and ordered image/alt pairs.
- `blog`, `footerBook`, `seo`: editorial copy and metadata. `blog.heading` and `blog.intro` optionally provide an editorial visible heading/highlight treatment while `blog.title` remains the metadata title.

Feature switches affect navigation, content serialization and asset publication.
They are not access controls for an independently deployed website.

Rich text uses `{ "text": "..." }` or
`{ "brand": { "name": "Studio", "icon": "/portfolio/profile/studio.svg" } }`.
Media entries use `{ "src": "/portfolio/photography/photo.webp", "alt": "..." }`.
Image dimensions are measured automatically; do not supply manual size fields.

## Projects

Each project has a unique `id`, `enabled`, name/copy and discriminated
`media.kind` (`image` or `carousel`). `mobileTreatment` controls its mobile
presentation. An optional `story` can accompany either media kind.

Use `media.image.mobile` or a carousel slide's `mobile` for genuine alternate
artwork. Omit it when the same image works at every width. Actions link to HTTPS
destinations or registered internal pages. Add meaningful role, constraints and
outcomes to your own copy; never invent results to fill a template.

Disabling a project retains its author content and original files but removes it
from the client configuration and publication output.

## Articles

Create `content/blogs/my-post.md`:

```md
---
title: "My post"
date: "2026-09-08"
description: "A short summary."
---

## A section

Article body.
```

Optional frontmatter: `subtitle`, `cover`, `tags`, `draft`. Images must use
local paths. Drafts remain author content; their images are not published unless
another published item references the same file.

With `npm run dev` running, adding, editing or removing a Markdown file rebuilds the Blog publication automatically. Markdown creates routes, index entries, metadata and sitemap entries.
For interactive React articles, add metadata to `src/blog/custom-posts.json`,
register the page in `src/portfolio/routes.json` and use its route guard.
Only the route registry owns the custom page's `demoOnly` flag. Bundled interactive examples keep their metadata in `src/demo/custom-posts.json`; the content build combines both registries and generates only the currently published custom-post runtime index.

## Assets and validation

Keep originals in `content/assets/portfolio/`. Missing referenced files fail
validation, including references retained for disabled content. Unreferenced
originals are allowed and never copied to publication output.

The pipeline verifies schema, locale/time zone, routes, project IDs, actual image
metadata and output drift. Photography has a 2 MiB per-image limit; other
configured images have a 4 MiB limit. Publication output is regenerated under a
lock and rolled back on ordinary errors.

Replace placeholder social previews with your own raster artwork before public
promotion. Only use media you own or have permission to publish.

See [ARCHITECTURE.md](ARCHITECTURE.md), [BRANCHING.md](BRANCHING.md) and
[VISUAL-QA.md](VISUAL-QA.md) for implementation, privacy and verification contracts.
