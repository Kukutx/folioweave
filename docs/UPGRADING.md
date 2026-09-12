# Upgrading FolioWeave

Treat upgrades as code integration, not as replacement of author content.

## Public template clone or fork

Add the canonical project as an upstream remote if it is not already present:

```bash
git remote add upstream https://github.com/OWNER/folioweave.git
git fetch upstream
git merge upstream/main
```

Resolve normal code conflicts, then run the release validation suite.

## Private personal repository

The private instance owns these author paths:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
qa/baselines/personal/
```

Generated files and `public/portfolio/` are outputs, not conflict-resolution sources.

Before an upgrade:

```bash
git status
git fetch upstream
```

Keep a normal Git backup/branch before a large upgrade. Merge the public `upstream/main`, preserving the intent of the private author-owned files when conflicts occur.

If upstream changed `portfolio.schema.json`, do not blindly choose either side of `portfolio.json`. Keep the personal content and adapt it to the new schema deliberately. Then regenerate:

```bash
npm run content:build
npm run content:check
```

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

An upstream refactor is not permission to accept a changed visual. If visual comparison fails:

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

The reusable repository may update `governance/demo-portfolio.json` and `src/demo/`. A private personal instance can take those shared implementation changes while keeping `features.demoRoutes: false`; the publication pipeline removes demo-only custom posts/routes from the personal runtime.

See [PUBLIC-PRIVATE.md](PUBLIC-PRIVATE.md) for the recommended repository topology.
