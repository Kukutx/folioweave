# Branch and content boundaries

The GitHub repository `Kukutx/folioweave` is public. All branches and committed
history are publicly readable. Branch names are organization boundaries, never
privacy boundaries.

| Ownership                                  | main / develop                 | personal                  |
| ------------------------------------------ | ------------------------------ | ------------------------- |
| App, schema, scripts, QA, docs             | reusable implementation        | shared improvements       |
| portfolio.json                             | governance/demo-portfolio.json | personal profile          |
| content/assets/portfolio/, content/blogs/  | shared README files only       | author media and posts    |
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

Because the repository is public, commit only material intended for publication.
Secrets, tokens, private records and unpublished confidential media must stay out
of Git history. If confidential authoring is needed in the future, use storage or
a repository with an actual access boundary rather than relying on a branch name.
Deployment access remains independent from repository visibility.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the publication and recovery contract.
