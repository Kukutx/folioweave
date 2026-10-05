# Repository model

FolioWeave uses one public repository. The reusable starter and the maintained
personal portfolio are separated by branch/profile ownership, not by repository
privacy.

## Current topology

```text
Kukutx/folioweave            public repository

main                         stable reusable starter + canonical demo profile
develop                      integration branch for shared changes
personal                     public maintained personal profile + author media
```

All committed branches and history are public. The `personal` branch exists so
personal author content does not become the default starter content on `main`.
It is not a confidentiality boundary.

## Ownership

Shared implementation belongs on `develop` and then `main`:

```text
src/
scripts/
qa/ shared checks and demo baselines
docs/
portfolio.schema.json
governance/demo-portfolio.json
```

The personal branch owns the author-specific surface:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
content/resume/
qa/baselines/personal/
```

Generated TypeScript and `public/portfolio/` are rebuilt from those inputs. Do
not hand-maintain generated publication output.

`npm run qa:boundary` enforces both profile ownership and the reusable-core/demo
layering rule. Reusable modules must not depend on `src/demo/`.

## Shared change workflow

For reusable code, documentation, schema, QA, or design-system changes:

1. make the shared change on `develop` or a feature branch based on it;
2. run the relevant validation;
3. merge to `main` through the normal protected-branch flow;
4. bring the updated `main` back into `personal` on a branch and open a pull request;
5. regenerate and validate the personal profile, then merge once both checks pass.

Do not merge the entire `personal` branch into `main`; that would make the author
profile the starter default.

## Personal content workflow

Personal content is intentionally publishable in this repository. Edit the
normal authoring surface on a branch based on `personal`, then run:

```bash
npm run content:build
npm run content:check
npm run check
```

After editing `content/resume/resume.json`, run `npm run resume:build` as well and
commit the regenerated PDF, preview and lock with it.

Open a pull request into `personal`. It is the production branch and requires the
`validate` and `visual-regression` checks, so a change deploys only after both
pass. Copy that is visible on the homepage changes pixels: capture the affected
regions with `npm run qa:visual-baseline` on the canonical platform, review them,
and commit them in the same pull request.

Use `npm run qa:maintainer` before a release or after a visual/runtime change.
Personal visual baselines belong on `personal` and must be reviewed like the demo
baselines.

## Public-safety rule

Because the repository is public, only commit material intended for public
access. Do not commit secrets, tokens, private records, credentials, unpublished
confidential media, or provider-local state. A branch name cannot protect them.

If a future use case genuinely requires confidential author content, use a real
access boundary such as a private repository or private storage for that content.
That is optional and is not part of the current FolioWeave topology.

## Forks and downstream portfolios

Other users can fork or clone `main`, create a `personal` branch, and run
`npm run personalize` there. The core branches accept only the canonical demo
profile. Pulling
upstream changes remains a normal Git integration task; preserve author-owned
inputs when resolving schema/content conflicts and regenerate outputs afterward.

## Demo code and licensing

Branded/example route implementation is isolated under `src/demo/`. Thin Next.js
route entries remain under `src/app/` because App Router routes are filesystem
owned. `features.demoRoutes: false` removes demo routes from publication, sitemap,
navigation, and browser targets while leaving example source available.

The MIT license covers software and documentation, not automatically every
photograph, logo, trademark, font, resume, or product screenshot. Review
[ASSETS.md](ASSETS.md) before redistributing bundled media.
