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

- Production branch: `personal` for the maintained personal site in this repository; use `main` only when deploying the reusable starter/demo profile. Protect the production branch with the `validate` and `visual-regression` required checks: Vercel deploys every deployable push to it, so the checks must gate the merge rather than report afterwards.
- Build command: the normal Next.js build (`npm run build`).
- Install command: `npm ci`.
- Node.js: the version declared in `package.json`.
- Canonical domain: match `site.origin`.

The tracked `vercel.json` uses Vercel's native `ignoreCommand` capability and the
same fail-closed path classifier as GitHub CI. Documentation-only commits skip
the application build; any author content, runtime, configuration, dependency,
governance, workflow, unknown path, or unavailable parent commit proceeds with a
normal build. This reduces redundant preview/production build work without
changing which branch owns production.

When the ignore policy changes, verify it with both a documentation-only commit
and a deployable change: the former should be reported by Vercel as ignored or
skipped, while the latter must still build normally.

After attaching a custom domain, update `site.origin`, rebuild, and redeploy so canonical URLs, sitemap, Open Graph metadata, and JSON-LD point at the real production origin.

## The public Refract demos

The two Refract demos are not built from a branch: `main` always carries the
Classic demo profile. Each is an isolated snapshot assembled from
`governance/templates/` and uploaded to its own Vercel project
(`folioweave-refract-light`, `folioweave-refract-dark`). After changing Refract or
its demo profiles, a maintainer signed in to the Vercel CLI redeploys them with:

```bash
npm run demo:deploy -- light
npm run demo:deploy -- dark
```

Add `--preview` to upload without promoting to production. The command never
reads or writes `portfolio.json` or author media, and removes its snapshot when it
finishes.

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
