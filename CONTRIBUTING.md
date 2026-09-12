# Contributing to FolioWeave

Thanks for improving FolioWeave.

## Development

```bash
npm ci
npm run dev
```

Normal author content lives in:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
```

Do not hand-edit `public/portfolio/`, `src/portfolio/*.generated.ts`, or `src/blog/posts.generated.ts`; the content pipeline owns them.

Reusable implementation belongs in the normal `src/` modules. Branded/example implementation belongs under `src/demo/`; thin filesystem route entry points remain under `src/app/`.

## Required checks

Before opening a pull request:

```bash
npm run check
npm run audit:prod
npm run qa:boundary
```

For shared UI, interaction, content-pipeline, responsive, or performance work, run the maintainer suite:

```bash
npm run qa:maintainer
```

`qa:maintainer` includes runtime budgets, interaction/quality/media checks, reusable fixtures, profile variants, visual regression, and Chromium/Firefox/WebKit coverage.

## Visual compatibility

An approved visual is a compatibility contract.

Refactors, performance improvements, dependency upgrades, and abstractions must preserve the approved output unless the previous visual has been explicitly identified as incorrect. A test suite passing is not evidence that an unreviewed visual change is acceptable.

When visual regression fails:

1. identify the cause;
2. compare the affected breakpoint/state;
3. fix accidental drift;
4. update only deliberately changed baseline files after review.

Never regenerate all baselines simply to make CI green.

See `docs/DESIGN-SYSTEM.md` and `docs/VISUAL-QA.md`.

## Architecture constraints

- Keep authoring inputs separate from generated/publication outputs.
- Reusable modules must not depend on `src/demo/`.
- Prefer focused feature modules over a universal plugin/page-builder abstraction.
- Keep server composition static where possible and interaction islands focused.
- Preserve keyboard behavior, focus restoration, reduced motion, no-JavaScript readability, and the single document scroller.
- Keep continuous animation work scoped to its useful viewport/document lifetime.
- Update protected demo asset manifests only for intentional asset changes.

`npm run qa:boundary` also runs the reusable-vs-demo dependency guard.

## Pull requests

Explain:

1. the problem being solved;
2. whether behavior or visuals change;
3. which validation commands were run;
4. any intentional profile, asset-manifest, or visual-baseline changes.
