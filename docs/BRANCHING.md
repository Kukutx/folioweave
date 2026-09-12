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
source does not depend on `src/demo/`. CI applies the PR base branch or pushed
branch policy. Promote shared patches from `personal` to `develop` to `main`;
exclude the profile-specific paths in the report and regenerate outputs from the
destination profile. Never treat merging a whole `personal` branch into `main` as
a content export mechanism.

All content producers use `npm run content:build`. Publication re-checks the
branch/profile boundary immediately before generated outputs are replaced, so the
canonical Demo cannot be published over `personal` even if `portfolio.json` is
accidentally replaced. Never copy `governance/demo-portfolio.json` over the real
`portfolio.json`, even temporarily; use `npm run qa:profiles`,
`npm run qa:visual-fixtures`, or a disposable worktree for alternate-profile QA.
Schema changes are deliberately breaking: update both author profiles and their
tests together. There is no runtime compatibility adapter or legacy migration CLI.

Because the repository is public, commit only material intended for publication.
Secrets, tokens, private records and unpublished confidential media must stay out
of Git history. If confidential authoring is needed in the future, use storage or
a repository with an actual access boundary rather than relying on a branch name.
Deployment access remains independent from repository visibility.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the publication and recovery contract.
