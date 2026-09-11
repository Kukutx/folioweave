# Markdown blogs

Drop a lowercase kebab-case `.md` file in this folder and FolioWeave will publish it automatically.
The filename becomes the route slug, so `building-devmate.md` becomes `/blogs/building-devmate`.
Files beginning with `_` or `.` are ignored by the blog engine.

Use this frontmatter shape:

```md
---
title: "How I Built DevMate"
subtitle: "Optional secondary title"
date: "2026-09-07"
description: "A short summary used on the blog index and in SEO metadata."
cover: "/portfolio/blogs/devmate/cover.webp"
tags:
  - Engineering
  - AI
draft: false
---

## Why I built it

Normal Markdown works here, including **bold text**, links, local images, lists, blockquotes,
code fences, tables, task lists, and GitHub-flavored Markdown.

![Architecture diagram](/portfolio/blogs/devmate/architecture.webp)
```

Required frontmatter: `title`, `date`, `description`.
Optional frontmatter: `subtitle`, `cover`, `tags`, `draft`.

The frontmatter `title` is the article's one and only H1. Start body sections at `##`; a Markdown `# Heading` in the body is rejected.
`cover` and every Markdown image must use a canonical local image path without query parameters, fragments, or percent-encoded aliases. Put author files under `content/assets/portfolio/` and reference them as `/portfolio/...`; other shared assets live under `public/`. Remote and protocol-relative images are rejected.
Inline and reference-style links to local files (for example `[Guide](/portfolio/blogs/guide.pdf#page=2)`) are included in the publication manifest. Links to unpublished local routes are rejected. Image URLs cannot use fragments, but download links can.
`draft: true` keeps the article out of routes, the blog index, the sitemap, and browser QA.
Files referenced only by drafts remain in author storage and are not copied into `public/portfolio/`.
The build-time content check rejects invalid filenames, unknown frontmatter fields, missing local assets, invalid dates, invalid image URLs, H1 headings in the body, and slugs that collide with registered custom blogs.
