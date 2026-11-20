# Upgrading FolioWeave

Treat upgrades as code integration, not as replacement of author content.

## Template and plugin API 1

No author migration is required: a missing `template` selects Classic, and missing `plugins` enables none. Rebuild after integrating shared code to generate `template.generated.ts`, the per-view `template-*.generated.ts` and per-slot `plugins-*.generated.tsx` entries, and `security.generated.json` together with content. These files are profile-derived outputs, never hand-edited. CLI template switching retains each template's settings and all author content. Before renaming a commented Markdown file, pin its frontmatter `id` to its old slug.

Build commands changed with this API. `npm run build` publishes and validates
content and compiles the site; it no longer runs the repository's test suites or
the branch boundary. `npm run check` runs those before the build and is what CI
uses. `npm run content:check` is the read-only content validation on its own.
A deployment that called `npm run build` needs no change.

Refract's `continentalDrift` option applies to every project chapter when
`true`; set `"first"` to keep it to the first. The separation now follows the
scroll position instead of playing on a timer. Refract no longer turns a GitHub
social link into the hero tile: the tile is the `featuredLink` option, and is
absent without it. The menu's foot now shows that tile in whichever state it
is in, so a tile with no `href` appears there as the placeholder; remove the
option to remove both.

The music plugin (1.2.0) accepts `autoplay`, off by default, and no longer
prints "Open" or "Close" over the record under the pointer. From 1.3.0 a local
track that names no `cover` shows the cover embedded in its MP3, FLAC or M4A
file, if it has one; a track that already names a `cover` is unchanged.
Existing options need no change.

Ticket Club 2.0.0 is a new design: a box office printed on warm paper, the
links on a roll of tickets, the letter in a sealed envelope and the projects
and articles as the programme. `editionPath` and the labels that still name a
part of the page keep their meaning. `tickets` now takes up to six and no
longer has `icon` or `light`; the card's colour is the `stock` option. Without
a `tickets` list the roll holds the profile's social links and then the e-mail
address. The labels of parts that are gone are no longer accepted: remove
`brandTop`, `brandBottom`, `edition`, `tagline`, `titleTop`, `titleBottom`,
`subLead`, `subTail`, `edit`, `fresh`, `pass`, `club`, `year`, `hintPull`,
`clipboard`, `clipboardFoot`, `keys`, `envelopeOpening`, `envelopeTag`,
`close`, `previous`, `next`, `stampCity`, `stampCaption`, `stampRainy`,
`stampPost`, `stampWithLove` and `readPost` from
`template.settings["ticket-club"].labels`; the build names any that remain.

Pond 2.0.0 is a new design: a garden pond seen from above, the whole pond on
the home page and a band of it over every other page. Every setting it
accepted still validates and keeps its meaning. Only the labels' defaults
changed, to Work, Photographs, Day and Night, and the blog's to the profile's
blog title; set `labels` to keep the old words. The new `time` setting opens
the site in the visitor's system scheme (`auto`, the default) or always in
`day` or `night`; before, Pond always opened dark. A visitor's saved choice
carries over.

Stack 2.0 is a new design, so its settings changed. `camera` and `ending` keep
their meaning. `labels` now names the new interface's wording; its keys `now`,
`writing`, `minutes`, `shotWith`, `copy`, `contact`, `allWriting`, `home`,
`notFoundTitle` and `notFoundText` remain, the others are gone. Remove
`established`, `chat`, `tools`, `art`, `shuffle`, `pocketLabel` and the
removed `labels` keys from `template.settings.stack` before upgrading;
validation names any that remain.

## Same repository: update `personal` from `main`

In the maintained FolioWeave repository, shared implementation lands on `main`
and the public personal site lives on `personal`. The personal branch owns these
author paths:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
content/resume/
qa/baselines/personal/
```

Generated files and `public/portfolio/` are outputs, not conflict-resolution
sources.

Before an upgrade:

```bash
git status
git fetch origin
git switch -c sync/main personal
git merge origin/main
```

`personal` is protected, so the sync lands through a pull request once
`validate` and `visual-regression` pass.

Keep a normal backup branch before a large integration. Preserve the intent of
the author-owned files when conflicts occur. If `portfolio.schema.json` changed,
do not blindly choose either side of `portfolio.json`; adapt the personal profile
to the new schema deliberately, then regenerate:

```bash
npm run content:build
npm run content:check
```

If `content:check` reports a stale resume, the shared resume template changed:
run `npm run resume:build`, review the regenerated PDF and preview, and commit
them with the sync.

## Fork or downstream repository

If your portfolio is a fork/clone of FolioWeave, add the canonical project as an
upstream remote if needed:

```bash
git remote add upstream https://github.com/OWNER/folioweave.git
git fetch upstream
git merge upstream/main
```

Resolve shared-code conflicts while preserving your author inputs, regenerate the
publication outputs, and run the release validation suite.

## Dependency upgrades

Keep framework-sensitive upgrades isolated so a failed check identifies one cause:

- update `next` and `eslint-config-next` together;
- keep Framer Motion free of transitive `motion-dom`/`motion-utils` overrides so its declared compatible versions can resolve normally;
- review Lucide minor releases separately because icon/package changes can alter both pixels and route bundle composition;
- treat React/React DOM minor releases as reviewed migrations when they change bundle/runtime behavior rather than folding them into unrelated dependency updates;
- treat Playwright minor releases as visual-environment migrations because they can change the pinned browser version recorded by visual baselines.

Patch-level React and Playwright updates can still be automated when the existing contracts pass.

## Validate the result

Run:

```bash
npm run check
npm run audit:prod
```

`check` includes the branch boundary. After integrating shared UI or runtime
changes, also run the suites in [COMMANDS.md](COMMANDS.md) that your system can
(`qa:maintainer` compares against Windows baselines), or let the pull request's
`validate` and `visual-regression` checks run them. Review the site locally
before deploying.

## Visual compatibility

An upstream refactor is not permission to accept a changed visual. If visual
comparison fails:

1. identify the exact component and breakpoint;
2. determine whether the old visual was actually wrong;
3. fix accidental drift;
4. update only reviewed baseline files for intentional changes.

Never refresh the entire baseline set merely because an upgrade changed rendering.

## Generated-output conflicts

Do not hand-merge:

```text
src/portfolio/*.generated.ts
src/portfolio/*.generated.tsx
src/portfolio/security.generated.json
src/blog/*.generated.ts
public/portfolio/
```

Resolve the author inputs first, then run `npm run content:build`.

## Demo changes

The reusable starter may update `governance/demo-portfolio.json` and `src/demo/`.
The `personal` branch can take those shared implementation changes while keeping
`features.demoRoutes: false`; the publication pipeline removes demo-only custom
posts/routes from the personal runtime.

See [REPOSITORY-MODEL.md](REPOSITORY-MODEL.md) for branch ownership and the
shared-change workflow.
