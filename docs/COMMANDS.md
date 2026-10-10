# Commands

Everything runs through `npm run`. Most people need only the first table.

## Making your site

| Command                               | What it does                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                         | Local development. Content, assets, posts and the schema are rebuilt as you save.                            |
| `npm run build`                       | Publishes and validates your content, then builds the production site. If it passes, the site is deployable. |
| `npm run personalize`                 | The guided setup: identity, links, location, a clean start, template and plugins.                            |
| `npm run folio -- templates`          | Lists the templates and marks the active one.                                                                |
| `npm run folio -- template use <id>`  | Switches template. `--options file.json` sets its options; `--dry-run` only validates.                       |
| `npm run folio -- plugins`            | Lists the plugins and marks the enabled ones.                                                                |
| `npm run folio -- plugin enable <id>` | Enables a plugin (`--options file.json`); `plugin disable <id>` turns it off.                                |
| `npm run folio -- doctor`             | Checks the selected template, plugins and published content without building.                                |
| `npm run content:check`               | Validates content and generated output; faster than a build.                                                 |
| `npm run resume:build`                | Renders the resume PDF and preview from `content/resume/resume.json`.                                        |

## Changing shared code

| Command                                         | What it does                                                                                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                 | The gate CI runs first: lint, the branch boundary, the content test suites, then the build.                                                                                             |
| `npm run qa:all`                                | Classic's site suites against a production build: runtime budgets, functionality, media, fonts, bundle, lifecycle.                                                                      |
| `npm run qa:refract`                            | Refract's scene and contract tests, then both styles in a browser. `-- --style=light` runs one.                                                                                         |
| `npm run qa:maintainer`                         | Everything CI runs on Linux, in one local command.                                                                                                                                      |
| `npm run qa:visual-compare`                     | Compares the home page with the approved baselines for this platform.                                                                                                                   |
| `npm run qa:visual-baseline`                    | Captures new baselines. Review the images before committing them.                                                                                                                       |
| `npm run qa:runtime`                            | Runtime budgets alone. Flags: `--reference` (CI's strict gate), `--diagnostic` or `--trace` (one sample, never fails), with `--motion=normal`, `--viewport=mobile`, `--profile=native`. |
| `npm run qa:boundary`                           | Checks that a personal branch differs from `main` only in profile-owned files, and that shared code does not depend on the examples.                                                    |
| `npm run audit:prod`                            | `npm audit` for production dependencies.                                                                                                                                                |
| `npm run demo:deploy -- <classic\|light\|dark>` | Uploads one public demo by hand. They also redeploy themselves on every push to `main`.                                                                                                 |
| `npm run folio -- template create <id>`         | Scaffolds a new template under `src/templates/`.                                                                                                                                        |
| `npm run plugins:generate`                      | Regenerates plugin option types after editing a plugin manifest.                                                                                                                        |

Pass flags after `--`, for example `npm run qa:runtime -- --diagnostic --viewport=mobile`.

The remaining scripts in `package.json` are the individual suites those commands
are built from (`qa:functionality`, `qa:media`, `qa:fonts` and so on) and
their `:direct` forms, which expect a running server and are started for you by
`qa/run-with-server.mjs`.

## How CI uses them

A pull request runs six suites side by side and one Windows job:

| Job                 | Runs                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `check`             | `npm run check`, `npm run audit:prod`                                     |
| `site`              | `npm run qa:all` with the strict runtime gate                             |
| `fixtures`          | `npm run qa:visual-fixtures`, `npm run qa:profiles`                       |
| `extensions`        | `npm run qa:music-quality`, `npm run qa:comments`                         |
| `browsers`          | Chromium, Firefox and WebKit against the production build                 |
| `refract-templates` | `npm run qa:refract` for each style                                       |
| `visual-regression` | `npm run qa:visual-compare` on Windows, where the baselines were captured |

`validate` passes only when the first six did; it and `visual-regression` are
the two checks `main` and `personal` require. A change that touches only
documentation takes a fast path through every job.
