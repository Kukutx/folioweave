# Upgrading FolioWeave

Treat upgrades as code integration, not as replacement of author content.

## Template and plugin API 1

No author migration is required: a missing `template` selects Classic, and missing `plugins` enables none. Rebuild after integrating shared code to generate `template.generated.ts`, the per-view `template-*.generated.ts` and per-slot `plugins-*.generated.tsx` entries, and `security.generated.json` together with content. These files are profile-derived outputs, never hand-edited. CLI template switching retains each template's settings and all author content. Before renaming a commented Markdown file, pin its frontmatter `id` to its old slug.

Build commands changed with this API. `npm run build` publishes and validates
content and compiles the site; it no longer runs the repository's test suites or
the branch boundary. `npm run check` runs those before the build and is what CI
uses. `npm run content:check` is the read-only content validation on its own.
A deployment that called `npm run build` needs no change.

Refract's `continentalDrift` option applies to every project chapter when
`true`; set `"first"` to keep it to the first. The separation now follows the
scroll position instead of playing on a timer. Refract no longer turns a GitHub
social link into the hero tile: the tile is the `featuredLink` option, and is
absent without it.

## Same repository: update `personal` from `main`

In the maintained FolioWeave repository, shared implementation lands on `main`
and the public personal site lives on `personal`. The personal branch owns these
author paths:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
content/resume/
qa/baselines/personal/
```

Generated files and `public/portfolio/` are outputs, not conflict-resolution
sources.

Before an upgrade:

```bash
git status
git fetch origin
git switch -c sync/main personal
git merge origin/main
```

`personal` is protected, so the sync lands through a pull request once
`validate` and `visual-regression` pass.

Keep a normal backup branch before a large integration. Preserve the intent of
the author-owned files when conflicts occur. If `portfolio.schema.json` changed,
do not blindly choose either side of `portfolio.json`; adapt the personal profile
to the new schema deliberately, then regenerate:

```bash
npm run content:build
npm run content:check
```

If `content:check` reports a stale resume, the shared resume template changed:
run `npm run resume:build`, review the regenerated PDF and preview, and commit
them with the sync.

## Fork or downstream repository

If your portfolio is a fork/clone of FolioWeave, add the canonical project as an
upstream remote if needed:

```bash
git remote add upstream https://github.com/OWNER/folioweave.git
git fetch upstream
git merge upstream/main
```

Resolve shared-code conflicts while preserving your author inputs, regenerate the
publication outputs, and run the release validation suite.

## Dependency upgrades

Keep framework-sensitive upgrades isolated so a failed check identifies one cause:

- update `next` and `eslint-config-next` together;
- keep Framer Motion free of transitive `motion-dom`/`motion-utils` overrides so its declared compatible versions can resolve normally;
- review Lucide minor releases separately because icon/package changes can alter both pixels and route bundle composition;
- treat React/React DOM minor releases as reviewed migrations when they change bundle/runtime behavior rather than folding them into unrelated dependency updates;
- treat Playwright minor releases as visual-environment migrations because they can change the pinned browser version recorded by visual baselines.

Patch-level React and Playwright updates can still be automated when the existing contracts pass.

## Validate the result

Run:

```bash
npm run check
npm run audit:prod
npm run qa:boundary
npm run qa:maintainer
```

Review the site locally before deploying.

## Visual compatibility

An upstream refactor is not permission to accept a changed visual. If visual
comparison fails:

1. identify the exact component and breakpoint;
2. determine whether the old visual was actually wrong;
3. fix accidental drift;
4. update only reviewed baseline files for intentional changes.

Never refresh the entire baseline set merely because an upgrade changed rendering.

## Generated-output conflicts

Do not hand-merge:

```text
src/portfolio/config.generated.ts
src/portfolio/media.generated.ts
src/blog/posts.generated.ts
src/blog/custom-posts.generated.ts
public/portfolio/
```

Resolve the author inputs first, then run `npm run content:build`.

## Demo changes

The reusable starter may update `governance/demo-portfolio.json` and `src/demo/`.
The `personal` branch can take those shared implementation changes while keeping
`features.demoRoutes: false`; the publication pipeline removes demo-only custom
posts/routes from the personal runtime.

See [REPOSITORY-MODEL.md](REPOSITORY-MODEL.md) for branch ownership and the
shared-change workflow.
