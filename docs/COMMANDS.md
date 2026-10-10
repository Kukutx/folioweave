# Commands

Everything runs through `npm run`. Most people need only the first table.

## Making your site

| Command                               | What it does                                                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                         | Local development. Content, assets, posts and the schema are rebuilt as you save.                                                                                    |
| `npm run build`                       | Publishes and validates your content, then builds the production site. If it passes, the site is deployable.                                                         |
| `npm run personalize`                 | The guided setup: identity, links, location, a clean start, template and plugins. `-- --defaults` asks nothing; `npm run folio -- setup` is the same wizard.         |
| `npm run folio -- templates`          | Lists the templates and marks the active one.                                                                                                                        |
| `npm run folio -- template use <id>`  | Switches template. `--options file.json` sets its options; `--dry-run` only validates.                                                                               |
| `npm run folio -- plugins`            | Lists the plugins and marks the enabled ones.                                                                                                                        |
| `npm run folio -- plugin enable <id>` | Enables a plugin (`--options file.json`); `plugin disable <id>` turns it off.                                                                                        |
| `npm run folio -- doctor`             | Checks the selected template, plugins and published content without building. `--json` (also on `templates` and `plugins`) prints machine-readable output.           |
| `npm run content:build`               | Publishes content and regenerates the profile-derived files after a manual edit; `dev` and `build` do this themselves.                                               |
| `npm run content:check`               | Validates content and generated output; faster than a build.                                                                                                         |
| `npm run resume:build`                | Renders the resume PDF and preview from `content/resume/resume.json`. `-- --adopt` takes over hand-made files once; `-- --force` renders again when nothing changed. |

## Changing shared code

| Command                                           | What it does                                                                                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                   | The gate of CI's `check` job: lint, the branch boundary, the content test suites, then the build.                                                                                       |
| `npm run typecheck`                               | TypeScript alone, without emitting.                                                                                                                                                     |
| `npm run format:styles`                           | Formats the stylesheets under `src/` with Prettier.                                                                                                                                     |
| `npm run qa:all`                                  | Classic's site suites against a production build: runtime budgets, functionality, media, fonts, bundle, lifecycle.                                                                      |
| `npm run qa:refract`                              | Refract's scene and contract tests, then both styles in a browser. `-- --style=light` runs one; `--retain` keeps the built fixture and `--fixture=<path>` reuses it.                    |
| `npm run qa:music-quality`, `npm run qa:comments` | The plugins: controller and option tests, the design sample, and isolated builds with each plugin enabled.                                                                              |
| `npm run qa:maintainer`                           | `qa:all`, the fixture and profile suites, the visual comparison, all three browser engines and the plugin suites in one command. Not `check`, `audit:prod` or `qa:refract`.             |
| `npm run qa:visual-compare`                       | Compares the home page with the approved baselines for this platform.                                                                                                                   |
| `npm run qa:visual-baseline`                      | Captures new baselines. Review the images before committing them.                                                                                                                       |
| `npm run qa:runtime`                              | Runtime budgets alone. Flags: `--reference` (CI's strict gate), `--diagnostic` or `--trace` (one sample, never fails), with `--motion=normal`, `--viewport=mobile`, `--profile=native`. |
| `npm run qa:boundary`                             | Checks that a personal branch differs from `main` only in profile-owned files, and that shared code does not depend on the examples.                                                    |
| `npm run audit:prod`                              | `npm audit` for production dependencies.                                                                                                                                                |
| `npm run demo:deploy -- <classic\|light\|dark>`   | Uploads one public demo by hand. They also redeploy themselves on every push to `main`.                                                                                                 |
| `npm run folio -- template create <id>`           | Scaffolds a new template under `src/templates/`.                                                                                                                                        |
| `npm run plugins:generate`                        | Regenerates plugin option types after editing a plugin manifest.                                                                                                                        |

Pass flags after `--`, for example `npm run qa:runtime -- --diagnostic --viewport=mobile`.

The remaining scripts in `package.json` are the individual suites those commands
are built from (`qa:functionality`, `qa:media`, `qa:fonts` and so on), their
`:direct` forms, which expect a running server and are started for you by
`qa/run-with-server.mjs`, and a few single-purpose tools: `analyze` (bundle
report), `preview:comments` (a local comments service to try the plugin
against) and `qa:upstream` (checks the third-party endpoints the site calls).

### What the suites need

- A production build. Every suite started through `qa/run-with-server.mjs`
  (`qa:all`, `qa:maintainer`, `qa:visual-compare`, `qa:visual-baseline`) serves
  the existing `.next` build and stops if there is none: run `npm run build` or
  `npm run check` first. `qa:refract`, `qa:visual-fixtures`, `qa:profiles` and
  the plugin suites build their own disposable fixtures.
- A browser. Most suites drive an installed Chrome, Edge or Chromium; set
  `CHROME_PATH` to choose one. `qa:visual-compare`, `qa:visual-baseline` and
  `resume:build` use the lockfile-pinned Chromium, and the cross-browser suite
  adds Firefox and WebKit:
  `node node_modules/playwright-core/cli.js install chromium firefox webkit`.
- Windows, for the visual comparison only. Baselines are captured per platform
  and the reviewed set is `win32`, so `qa:visual-compare`, and `qa:maintainer`
  with it, pass on Windows; elsewhere the `visual-regression` check on the pull
  request does the comparison.

`NEXT_BUILD_WORKERS` sets how many workers the production build uses (4 by
default).

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
