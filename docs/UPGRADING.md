# Upgrading FolioWeave

Treat upgrades as code integration, not as replacement of author content.

## Same repository: update `personal` from `main`

In the maintained FolioWeave repository, shared implementation lands on `main`
and the public personal site lives on `personal`. The personal branch owns these
author paths:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
qa/baselines/personal/
```

Generated files and `public/portfolio/` are outputs, not conflict-resolution
sources.

Before an upgrade:

```bash
git status
git fetch origin
git switch personal
git merge origin/main
```

Keep a normal backup branch before a large integration. Preserve the intent of
the author-owned files when conflicts occur. If `portfolio.schema.json` changed,
do not blindly choose either side of `portfolio.json`; adapt the personal profile
to the new schema deliberately, then regenerate:

```bash
npm run content:build
npm run content:check
```

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
