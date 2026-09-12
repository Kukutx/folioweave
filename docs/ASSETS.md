# Asset policy

FolioWeave separates author-owned source media from generated publication output and bundled demo media.

## Author assets

Put original personal files under:

```text
content/assets/portfolio/
  profile/
  projects/
  photography/
  resume/
  blogs/
```

Reference them from `portfolio.json` or Markdown with browser paths beginning `/portfolio/...`.

`npm run content:build` validates the references and atomically publishes only the required files to `public/portfolio/`. **Do not author files directly in `public/portfolio/`; it is generated output.**

Unreferenced originals are allowed and remain in author storage. Draft-only Blog assets and disabled/unreferenced content are not published unless another published item references them.

Photography has a 2 MiB per-image source limit; other configured images have a 4 MiB limit. Image dimensions and hashes are measured automatically.

## Bundled demo assets

The reusable starter also contains demo media under shared `public/` paths so the canonical demo can run immediately.

`qa/assets-manifest.json` records protected demo paths, sizes, and SHA-256 hashes. Run:

```bash
npm run qa:assets
```

after an intentional demo asset change.

## License boundary

The MIT license covers software source and documentation. It does **not** automatically grant redistribution rights for every bundled photograph, logo, trademark, font, resume, or product screenshot.

Before publishing a personal site, replace demo media with assets you own or are licensed to use. Before creating a public FolioWeave repository, review every bundled demo asset for redistribution rights; replace or clearly exclude anything whose public redistribution is not established.

See `docs/PUBLIC-PRIVATE.md` for the clean-history public export model.
