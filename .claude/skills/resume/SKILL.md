---
name: resume
description: Change the resume (content/resume/resume.json), the one document the site prints, previews and offers for download and that goes out with applications; rebuild it and archive the dated PDF, DOCX and Markdown copies.
---

# Change the resume

There is one resume. `content/resume/resume.json` is its source; the PDF a
visitor downloads, the sheet the printer shows and the copies sent with
applications are that same document. `resume.schema.json` documents the format
and `content/resume/README.md` the pipeline. A different text means a different
`resume.json`, rebuilt and archived, never a second CV made elsewhere.

## Steps

1. Branch from `personal` (the resume is profile-owned).
2. Edit `resume.json`. Inline marks are `**bold**`, `[label](https://…)` and
   `\*`. `"density": "compact"` fits a fuller page; a closing line such as a
   consent statement goes in `footnote`.
3. `npm run resume:build`. It needs the pinned Chromium and Arial or Liberation
   Sans, and fails, saying by how much, when the content does not fit one A4
   page: shorten the text, never the template.
4. Open the generated preview image and read the whole page.
5. Archive the build in `content/resume/history/<YYYY-MM-DD>/`:
   - `<Name>_CV_<date>.pdf`, a byte copy of the built PDF (its sha256 matches
     `resume.lock.json`);
   - `<Name>_CV_<date>.docx` and `.md`, conversions of `resume.json` with the
     same text, links and order.
   Finished years move to `history/archive/`.
6. Commit `resume.json`, `resume.lock.json`, the PDF, the preview and the dated
   folder together; `content:check` rejects a stale or partial set.
7. If a fact changed (a title, a date, a project), correct `portfolio.json` too
   so the site and the resume agree.

## Content

- Facts come only from the author's own material: previous resumes,
  repositories and what they state. Keep their wording; change what they asked
  for or what corrects a verifiable fact.
- Everything committed here is public.
