# Public core and private personal portfolio

For a reusable public FolioWeave project, keep the reusable product and the deployed personal instance in separate repositories.

## Recommended topology

```text
folioweave                  public
  reusable app
  canonical demo profile
  demo/example implementation
  schema, content pipeline, QA, docs

folioweave-personal         private
  latest FolioWeave core
  personal portfolio.json
  personal source assets
  personal Markdown posts
  personal visual baselines
```

Branches are workflow tools, not privacy boundaries.

## Do not make an existing personal-history repository public

If a repository has ever contained private author content, changing its current files or deleting a branch does not erase that content from Git history. Create the public repository from a reviewed clean snapshot and start a new Git history.

The repository includes a guarded snapshot exporter:

```bash
npm run export:public -- ../folioweave-public --ref main
```

It reads the requested Git ref rather than the dirty working tree, requires the canonical demo profile, rejects Personal-only/local/credential-like paths, writes outside the source repository, and copies no `.git` history. It does **not** publish anything or waive the media-license review.

A safe publication process is:

1. use a fully validated core `main`;
2. export that validated committed ref into a new empty directory, without `.git`;
3. inspect the exported tree for personal names, addresses, private media, secrets, `.vercel`, local QA output, and unlicensed assets;
4. run the full validation suite in the export;
5. initialize a new Git repository and create the first public commit;
6. only then connect the new public remote.

Do not force-push the old private repository into a public one to simulate clean history.

## Private instance workflow

In the private personal repository, use the public project as an upstream:

```bash
git remote add upstream https://github.com/OWNER/folioweave.git
git fetch upstream
git merge upstream/main
```

The private repository should treat these paths as author-owned:

```text
portfolio.json
content/assets/portfolio/
content/blogs/
qa/baselines/personal/
```

Generated files and `public/portfolio/` come from the same content pipeline.

Before accepting an upstream update:

```bash
npm run content:build
npm run content:check
npm run check
npm run qa:maintainer
```

Never resolve an upstream conflict by accepting a new visual baseline without reviewing the visual result.

## Public demo code

Branded/example route implementation is isolated under `src/demo/`. Thin Next.js route entry points stay under `src/app/` because the App Router requires filesystem routes, but reusable components/config do not import the demo layer.

`features.demoRoutes: false` removes those routes from publication, sitemap, navigation, and browser targets.

## Media and licensing

The MIT license applies to software and documentation; it does not automatically grant rights to every bundled photograph, logo, trademark, font, or product screenshot. A public export must contain only media that may legally be redistributed, or clearly mark non-reusable demo material and replace it before general distribution.

See [ASSETS.md](ASSETS.md).
