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
npm run build
```

The build publishes and validates your content, then compiles the site; a
personal site needs nothing more. If you also changed shared code, run
`npm run check` and `npm run audit:prod` and the suites in
[COMMANDS.md](COMMANDS.md). Do not deploy from a working tree whose visual
regression is unexplained.

## Choosing a host

A profile can list several hosts side by side in a `deployment` block and pick
one as the default; switching is one word, and each host keeps its own
settings and address:

```json
{
  "deployment": {
    "provider": "vercel",
    "providers": {
      "vercel": { "project": "example", "origin": "https://example.vercel.app" },
      "cloudflare": {
        "accountId": "0123456789abcdef0123456789abcdef",
        "worker": "example",
        "origin": "https://example.someone.workers.dev"
      },
      "firebase": { "projectId": "example-site", "origin": "https://example-site.web.app" }
    }
  }
}
```

```bash
npm run deploy                         # build for the default provider
npm run deploy -- cloudflare           # build for another listed provider
npm run deploy -- cloudflare --apply   # build, then publish
```

Without `--apply` nothing leaves the machine. A build for a host uses that
host's `origin` (else `site.origin`) for canonical links, the sitemap, social
cards and JSON-LD, so every copy of the site points at itself. Credentials
never live in the repository: each provider's CLI keeps its own sign-in
(`wrangler login`, `vercel login`, `firebase login`), and CI passes
`CLOUDFLARE_API_TOKEN`, `VERCEL_TOKEN` or `FIREBASE_TOKEN` instead.

| Host | How the site runs | Free plan notes |
| --- | --- | --- |
| Vercel | Native Next.js; pushes deploy through the Git integration | About 100 deployments a day |
| Cloudflare | A Worker through the OpenNext adapter (`@opennextjs/cloudflare`); pages are prerendered and served from the Worker's assets, `/api/weather` runs in the Worker, images are optimised by the `IMAGES` binding | 100,000 requests a day, 10 ms CPU per request; 5,000 image transformations a month |
| Firebase | Static export (`out/`) on Hosting, with the same security headers; images are served as published, and the browser fetches the weather itself | Hosting on the Spark plan; server rendering would need the paid Blaze plan |

`scripts/deploy.mjs` writes each host's configuration from the profile at
deploy time (`wrangler.generated.json`, `firebase.generated.json`), so nothing
host-specific is committed besides `open-next.config.ts` and
`cloudflare-worker.mjs`. Next's content-hashed build output
(`/_next/static/`) is cached for a year on every host: the Firebase
configuration says so, and on Cloudflare the deploy writes
`.open-next/assets/_headers` (Workers otherwise serve assets with
`max-age=0`). The Worker entry, `cloudflare-worker.mjs`, wraps the adapter's
Worker so optimised images (`/_next/image`) are cached as Next caches them,
four hours and then revalidated; the adapter sends no `Cache-Control` for
them. Build the Cloudflare
adapter on Linux or macOS (CI or a Linux machine): it does not support
Windows. Adding a host is one entry in the schema's `deployment.providers`,
one step in `scripts/deploy.mjs` and a row here.

A route handler that answers live is named `route.server.ts` (the weather,
the demo podcasts): hosts that run the app serve it, and the static export
leaves it out. Every other handler and metadata route (manifest, robots,
sitemap) is marked `force-static`, which `qa/deploy.test.mjs` checks.

### Moved addresses

When a site replaces an older one, `deployment.redirects` keeps the old links
and search results working on every host. Each entry moves one path
permanently; `subpaths` also moves everything under it:

```json
"redirects": [
  { "from": "/services/sewing", "to": "/sartoria", "subpaths": true },
  { "from": "/services/3d", "to": "/#services" }
]
```

Hosts that run the app get them through `next.config.ts` (308); Firebase gets
them in `firebase.generated.json` (301). A destination that is itself
redirected is refused.

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

## The public demos

Each template has a public demo in its own Vercel project: `folioweave-classic`,
`folioweave-refract-light` and `folioweave-refract-dark`. None has a branch of
its own. A demo is the shared code with a demo profile
(`governance/demo-portfolio.json` for Classic, `governance/templates/` for
Refract), staged as an isolated snapshot. It can be uploaded by hand with the
Vercel CLI:

```bash
npm run demo:deploy -- classic
npm run demo:deploy -- light
npm run demo:deploy -- dark
```

Add `--preview` to upload without promoting to production. The command never
reads or writes `portfolio.json` or author media, works from any branch, and
removes its snapshot when it finishes.

The three projects are also connected to this repository, so they redeploy
themselves: a push to `main` updates all three with no command and no token. Each
project carries two environment variables, `FOLIO_DEMO` (`classic`, `light` or
`dark`) and `BOUNDARY_TARGET=snapshot`. `vercel.json` runs
`scripts/demo-stage.mjs` before the build; in a project that names a demo it
writes that demo's profile, artwork and sample writing into the host's checkout,
and in every other project it does nothing. It refuses to run outside a Vercel
build, because it replaces `portfolio.json`. Demo projects build `main` and
`develop` only; other branches and pull requests are skipped.

## Other Next.js hosts

Any host with a current Next.js integration works the way Vercel does. A host
that serves only files can take the static export the Firebase step builds
(`FOLIO_HOSTING=firebase npm run build` writes `out/`).

## Post-deploy checks

Verify:

- `/` loads without console errors;
- navigation anchors and mobile menu work;
- photography opens/closes and restores focus;
- the resume prints, opens in its preview and downloads when enabled;
- `robots.txt`, `sitemap.xml`, and `manifest.webmanifest` return 200;
- disabled demo routes return 404 on a personal profile;
- the production URL and social preview metadata use the intended domain.

See [REPOSITORY-MODEL.md](REPOSITORY-MODEL.md) for the public branch and profile ownership model.
