# Demo / Reference Asset Policy

The original portfolio assets are intentionally retained as useful examples for the reusable theme.

## Licensing boundary

The repository's MIT license covers the software source and documentation. Demo photography, resumes, product/brand artwork, trademarks and other reference media under `public/` are not automatically granted for reuse by that software license. Replace demo media with assets you own or are licensed to use before publishing your own portfolio.

## Reference inventory

`qa/assets-manifest.json` currently protects **103 reference assets** from the deployed portfolio:

- 60 WebP images
- 31 WOFF2 font files
- 6 PNG files
- 3 JPG files
- 1 PDF resume
- 1 ICO
- 1 SVG bird animation source

All 103 are checked by SHA-256 through:

```bash
npm run qa:assets
```

The original bird SVG was served from an external S3 path. The Next version stores the exact same bytes locally at:

```text
public/assets/bird-cells-new.svg
```

This removes a runtime external dependency without changing the asset.

## Template extras

The theme also keeps a few local assets that were added while reconstructing and hardening the project:

- `public/assets/app-store-badge.svg`
- `public/fonts/satoshi-0.woff2`
- `public/fonts/satoshi-1.woff2`
- `public/fonts/satoshi-2.woff2`

These are checked for presence by the asset QA.

## What may be deleted

Files that are clearly framework boilerplate, have no project/reference value, and have zero source references can be removed. For example, the unused create-next-app SVG examples (`next.svg`, `vercel.svg`, `globe.svg`, `window.svg`, `file.svg`) were removed.

## What should not be auto-deleted

Do not remove a file only because a static "unused asset" scanner says it is unreferenced.

Some original files are intentionally preserved so template users can:

- see alternative artwork and project examples;
- swap images without recovering files from the reference deployment;
- reuse local fonts/assets while customizing the theme;
- compare future changes with the original reference.

If an intentional reference asset really needs to be removed, update `qa/assets-manifest.json` deliberately and document why.

## Where assets live

```text
public/assets/   icons, app-store badge, reference SVG/PNG assets
public/media/    portfolio photography, case-study and product artwork
public/brink/    Brink-specific assets
public/fonts/    local/reference fonts
public/*.pdf     resume/download assets
```

The asset manifest records the expected public path, size and SHA-256 for each protected reference file.
