---
name: ship-shared-change
description: Ship a reusable FolioWeave change (src, scripts, qa, docs, schema) through develop and main to the personal site, with the checks and Windows visual baselines each branch requires.
---

# Ship a shared change

Shared paths: `src/`, `scripts/`, `qa/` (except `qa/baselines/personal/`),
`docs/`, `portfolio.schema.json`, `resume.schema.json`,
`governance/demo-portfolio.json`. Profile paths stay on `personal`
(docs/REPOSITORY-MODEL.md).

## Flow

1. Branch from `develop` (`git switch -c <type>/<topic> origin/develop`).
2. Make the change reusable: no personal names, media or copy, and no
   dependency on `src/demo/`.
3. `npm run check`, then the suites the change touches (docs/COMMANDS.md), for
   example `npm run qa:all`, `npm run qa:visual-fixtures`, `npm run qa:profiles`.
   A motion change is also checked in a browser with motion on (AGENTS.md).
4. Pixels changed? On Windows: `npm run qa:visual-baseline` (the demo profile is
   active on `develop`), open every replaced image and keep only the intended
   ones, then `npm run qa:visual-compare`.
5. PR into `develop`; when green, PR `develop` → `main` (`validate` and
   `visual-regression` must pass). That merge is a release: its
   `CHANGELOG.md` entry and `package.json` version land on `develop` first,
   and `main` is tagged and released after it (docs/REPOSITORY-MODEL.md,
   "Releases").
6. Bring `main` into `personal`: branch from `personal`, merge `origin/main`,
   `npm run content:build`, `npm run check`, recapture the personal baselines
   that changed on Windows, PR into `personal`.
