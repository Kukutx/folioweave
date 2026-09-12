# Branch and content boundaries

The GitHub repository `Kukutx/folioweave` is private (verified 2026-09-08).
Branch names themselves are never a privacy boundary.

| Ownership | main / develop | personal |
| --- | --- | --- |
| App, schema, scripts, QA, docs | reusable implementation | shared improvements |
| portfolio.json | governance/demo-portfolio.json | personal profile |
| content/assets/portfolio/, content/blogs/ | shared README files only | author media and posts |
| Generated profile, media and article files | regenerated from demo | regenerated from personal |
| public/portfolio/ | generated, ignored | generated, ignored |

Run `npm run qa:boundary` to classify changes. CI applies the PR base branch or
pushed branch policy. Promote shared patches from personal to develop to main;
exclude the profile-specific paths in the report and regenerate outputs from
the destination profile. Never treat merging a whole personal branch into main
as a content export mechanism.

All content producers use `npm run content:build`. Schema changes are deliberately
breaking: update both author profiles and their tests together. There is no
runtime compatibility adapter or legacy migration CLI.

Private visibility does not revoke historical downloads, public forks or external
deployments. A future public edition must be a reviewed, clean-history export.
Do not make the current repository's personal history public again. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the publication and recovery contract.
