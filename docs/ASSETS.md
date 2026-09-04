# Demo Asset Policy

FolioWeave includes bundled demo media so the starter can be explored immediately after cloning.

## License boundary

The MIT license covers the software source and documentation. Demo photography, resumes, product or brand artwork, trademarks, fonts, and other third-party media under `public/` are not automatically licensed for reuse by the software license.

Before publishing your own portfolio, replace demo media with assets you own or are licensed to use.

## Asset inventory

`qa/assets-manifest.json` records the expected path, size, and SHA-256 hash for protected demo files used by the project.

The main asset groups are:

```text
public/assets/   UI icons, badges, and decorative assets
public/fonts/    local fonts
public/media/    bundled demo portfolio/product media
public/portfolio/ recommended home for your own profile, project, photo, and resume assets
```

Run the asset check after changing or removing protected files:

```bash
npm run qa:assets
```

## Cleanup guidelines

Remove assets only when you have confirmed they are no longer used by routes, content configuration, CSS, or runtime interactions.

Some files may be loaded dynamically and therefore will not always appear in simple static import scans. When intentionally removing a protected asset, update `qa/assets-manifest.json` in the same change.

## Publishing your own portfolio

Put your own files under `public/portfolio/` and reference them from `portfolio.json`. `npm run content:check` verifies those configured local paths exist before development/builds.

A typical customization pass should replace:

- profile and photography images
- resume previews and downloads
- project screenshots and product artwork
- company and product logos
- social preview images
- store badges or third-party brand marks that are not yours
- any font whose license does not permit your intended use
