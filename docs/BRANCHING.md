# Branch, profile, and repository boundaries

Branches are workflow tools, not privacy boundaries.

## Current private development repository

The current repository uses core branches plus a personal author profile while FolioWeave is being developed:

| Ownership | main / develop | personal |
| --- | --- | --- |
| reusable app, schema, scripts, QA, docs | canonical | inherits shared implementation |
| `portfolio.json` | canonical demo profile | personal profile |
| `content/assets/portfolio/`, `content/blogs/` | shared README files only | author media/posts |
| generated profile/media/article files | generated from demo | generated from personal |
| `qa/baselines/personal/` | absent | personal golden state |

`npm run qa:boundary` classifies changes and also verifies that reusable source does not depend on `src/demo/`.

Never merge a whole personal branch into a core branch as a publishing mechanism. Shared changes move to `develop`/`main`; author inputs stay personal.

Schema changes deliberately update the canonical demo profile and generated contracts together.

## Recommended public architecture

Once FolioWeave is published for others to use, prefer **two repositories**:

- public `folioweave`: reusable product + reviewed demo;
- private `folioweave-personal`: deployed personal instance, with the public repository configured as `upstream`.

This removes the need to use a branch as an author/privacy boundary.

If a repository has ever contained personal content, do not simply switch that repository to public. Create a reviewed clean-history export from validated core `main`.

See [PUBLIC-PRIVATE.md](PUBLIC-PRIVATE.md) for the migration and update workflow.
