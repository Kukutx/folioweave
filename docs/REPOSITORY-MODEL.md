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

## Branch and content boundaries

| Ownership                                  | main / develop                 | personal                  |
| ------------------------------------------ | ------------------------------ | ------------------------- |
| App, schema, scripts, QA, docs             | reusable implementation        | shared improvements       |
| portfolio.json                             | governance/demo-portfolio.json | personal profile          |
| content/assets/portfolio/, content/blogs/  | shared README files only       | author media and posts    |
| content/resume/                            | README and example source only | resume source and lock    |
| Generated profile, media and article files | regenerated from demo          | regenerated from personal |
| public/portfolio/                          | generated, ignored             | generated, ignored        |

`main` and `develop` stay clean so the repository remains useful as a starter.
`personal` is the public author profile for the maintained personal site. Keeping
those profiles on separate branches prevents personal content from becoming the
default template; it does not make that content confidential.

Run `npm run qa:boundary` to classify profile changes and verify that reusable
source does not depend on `src/demo/`. On `personal`, the check compares the net
tree with `main` and fails if any reusable path exists only on the personal
branch. CI fetches the relevant shared base explicitly, so this check cannot
silently fall back to an empty shallow-clone comparison. Promote shared patches
through `develop` to `main` before updating `personal`; exclude only the
profile-specific paths in the report and regenerate outputs from the destination
profile. Never treat merging a whole `personal` branch into `main` as a content
export mechanism.

`main` is protected by both `validate` and `visual-regression`; shared changes are
not complete until both checks pass. Pull requests that change only the explicitly
maintained documentation paths keep those required contexts but use the CI
lightweight path; every unknown or executable/content/configuration path fails
closed to the full suites.

`personal` is the production branch, so it carries the same two required checks.
Author changes and `main` syncs reach it through a pull request and deploy when
that pull request merges; a push that has not passed `validate` and
`visual-regression` is rejected instead of going live. The run triggered by the
merge itself re-validates the deployed revision with the full suites.

All content producers use `npm run content:build`. Publication re-checks the
branch/profile boundary immediately before generated outputs are replaced, so the
canonical Demo cannot be published over `personal` even if `portfolio.json` is
accidentally replaced. Never copy `governance/demo-portfolio.json` over the real
`portfolio.json`, even temporarily; use `npm run qa:profiles` or
`npm run qa:visual-fixtures` for alternate-profile QA. FolioWeave uses one
top-level project directory only: do not create sibling verification, cleanup,
artifact, or Git-worktree directories. Temporary QA state stays under ignored
project-local paths and is cleaned up by the command that creates it.
Schema changes are deliberately breaking: update both author profiles and their
tests together. There is no runtime compatibility adapter or legacy migration CLI.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the publication and recovery contract.

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
route entries sit together in the `src/app/(demo)/` route group because App
Router routes are filesystem owned. `features.demoRoutes: false` removes demo routes from publication, sitemap,
navigation, and browser targets while leaving example source available.

The MIT license covers software and documentation, not automatically every
photograph, logo, trademark, font, resume, or product screenshot. Review
[ASSETS.md](ASSETS.md) before redistributing bundled media.
