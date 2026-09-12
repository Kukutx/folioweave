# Deployment

FolioWeave follows standard Next.js deployment conventions. A deployment is a publication step, not an authoring step.

## Before deploying

Set the canonical URL in `portfolio.json`:

```json
{
  "site": {
    "origin": "https://example.com"
  }
}
```

For a personal site, normally keep `features.demoRoutes: false` so bundled examples and the demo podcast API are not published.

Run:

```bash
npm run content:build
npm run content:check
npm run check
npm run audit:prod
npm run qa:maintainer
```

Do not deploy from a working tree whose visual regression is unexplained.

## Vercel

Create a project from the repository and use the standard Next.js preset. No FolioWeave-specific build adapter is required.

Recommended settings:

- Production branch: `personal` for the maintained personal site in this repository; use `main` only when deploying the reusable starter/demo profile.
- Build command: the normal Next.js build (`npm run build`).
- Install command: `npm ci`.
- Node.js: the version declared in `package.json`.
- Canonical domain: match `site.origin`.

After attaching a custom domain, update `site.origin`, rebuild, and redeploy so canonical URLs, sitemap, Open Graph metadata, and JSON-LD point at the real production origin.

## Other Next.js hosts

Use the provider's current Next.js integration. The application uses App Router routes and Route Handlers, so the host must support the project's Next.js runtime rather than only static HTML export.

## Post-deploy checks

Verify:

- `/` loads without console errors;
- navigation anchors and mobile menu work;
- photography opens/closes and restores focus;
- resume download works when enabled;
- `robots.txt`, `sitemap.xml`, and `manifest.webmanifest` return 200;
- disabled demo routes return 404 on a personal profile;
- the production URL and social preview metadata use the intended domain.

See [REPOSITORY-MODEL.md](REPOSITORY-MODEL.md) for the public branch and profile ownership model.
