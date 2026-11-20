// Build and deploy the site to one of the hosts listed in the profile's
// `deployment` block (docs/DEPLOYMENT.md).
//
//   npm run deploy                     build for the profile's provider
//   npm run deploy -- cloudflare       build for another listed provider
//   npm run deploy -- cloudflare --apply   build, then publish
//
// Without --apply nothing leaves the machine. Each provider builds with its
// own address (its `origin`, else site.origin) for canonical links, the
// sitemap and social cards. Credentials never live in the repository: the
// providers' own CLIs keep them (`wrangler login`, `vercel login`,
// `firebase login`) or read them from the environment in CI
// (CLOUDFLARE_API_TOKEN, VERCEL_TOKEN, FIREBASE_TOKEN).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { firebaseRedirects, profileRedirects } from "../src/config/redirects.mjs";
import { isPlaceholderPath } from "../src/lib/static-params.mjs";
import { securityHeaders } from "../src/config/security-headers.mjs";

/** Kept in step with WEATHER_SERVICE in src/lib/weather-client.ts. */
const WEATHER_SERVICE = "https://api.open-meteo.com";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROVIDERS = ["vercel", "cloudflare", "firebase"];
/** Workers runtime date and flags the Next adapter needs. */
const CLOUDFLARE_RUNTIME = {
  compatibility_date: "2026-11-01",
  compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
};

function fail(message) {
  console.error(`deploy: ${message}`);
  process.exit(1);
}

function run(command, args, env = {}) {
  console.log(`\n> ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) fail(`${command} ${args[0] ?? ""} exited with ${result.status}`);
}

export function readDeployment(profile) {
  const deployment = profile.deployment;
  if (!deployment) fail("portfolio.json has no `deployment` block (see docs/DEPLOYMENT.md).");
  return deployment;
}

/** The provider to use and its settings, with the address builds use. */
export function target(profile, requested) {
  const deployment = readDeployment(profile);
  const provider = requested ?? deployment.provider;
  if (!PROVIDERS.includes(provider))
    fail(`unknown provider "${provider}"; use one of ${PROVIDERS.join(", ")}.`);
  const settings = deployment.providers[provider];
  if (!settings) fail(`portfolio.json lists no settings for ${provider} under deployment.providers.`);
  return {
    provider,
    settings,
    origin: settings.origin ?? profile.site.origin,
    redirects: profileRedirects(profile),
  };
}

/** Workers serve static assets with `max-age=0, must-revalidate` unless the
 * assets folder holds a `_headers` file. Next's build output is
 * content-hashed, so it is cached for good, as Vercel and Firebase do. */
export function cloudflareAssetHeaders() {
  return "/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n";
}

/** Wrangler configuration for the Next adapter, from the profile. */
export function wranglerConfig(settings) {
  return {
    $schema: "node_modules/wrangler/config-schema.json",
    name: settings.worker,
    account_id: settings.accountId,
    main: ".open-next/worker.js",
    ...CLOUDFLARE_RUNTIME,
    // Keeps function names short in the bundle; on, they break the adapter.
    keep_names: false,
    assets: { directory: ".open-next/assets", binding: "ASSETS" },
    images: { binding: "IMAGES" },
    services: [{ binding: "WORKER_SELF_REFERENCE", service: settings.worker }],
    workers_dev: true,
    preview_urls: false,
    observability: { enabled: true },
  };
}

/** On static hosts the browser fetches the weather itself
 * (src/lib/weather-client.ts), so the policy lets it reach the service. */
function staticNetwork(network) {
  const connect = network["connect-src"] ?? [];
  return { ...network, "connect-src": [...connect, WEATHER_SERVICE] };
}

/** Firebase Hosting serving the exported site with the shared headers and
 * the profile's redirects. Next's build output is content-hashed, so it is
 * cached for good; everything else keeps Firebase's default. */
export function firebaseConfig(site, redirects = []) {
  const network = JSON.parse(
    fs.readFileSync(path.join(root, "src/portfolio/security.generated.json"), "utf8"),
  );
  return {
    hosting: {
      site,
      public: "out",
      cleanUrls: true,
      trailingSlash: false,
      redirects: firebaseRedirects(redirects),
      headers: [
        { source: "**", headers: securityHeaders({ network: staticNetwork(network) }) },
        {
          source: "/_next/static/**",
          headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
        },
      ],
    },
  };
}

/** Next's mark on a page that rendered notFound(). */
const NOT_FOUND_MARK = "NEXT_HTTP_ERROR_FALLBACK;404";

/** Drops from a static export what the site does not publish, so the host
 * answers those addresses with its real 404: the placeholders of unused
 * dynamic routes (src/lib/static-params.mjs) and every page that rendered as
 * not found (routes the profile turns off, such as the demos). A page's own
 * files go (`x.html`, `x.txt`, `x/__next.*`); files beside them stay.
 * Returns what it removed. */
export function removeUnpublished(out) {
  const files = fs.readdirSync(out, { recursive: true }).map(String);
  const placeholders = files
    .filter((relative) => isPlaceholderPath(relative))
    .sort((a, b) => a.length - b.length)
    .filter(
      (relative, index, all) =>
        !all
          .slice(0, index)
          .some((parent) => relative.startsWith(`${parent}${path.sep}`)),
    );
  const notFound = files
    .filter(
      (relative) => relative.endsWith(".html") && !isPlaceholderPath(relative),
    )
    .filter((relative) =>
      fs
        .readFileSync(path.join(out, relative), "utf8")
        .includes(NOT_FOUND_MARK),
    )
    .flatMap((relative) => {
      const page = relative.slice(0, -".html".length);
      const segments = files.filter(
        (file) =>
          path.dirname(file) === page &&
          path.basename(file).startsWith("__next."),
      );
      return [
        relative,
        ...[`${page}.txt`].filter((file) => files.includes(file)),
        ...segments,
      ];
    });
  const removed = [...placeholders, ...notFound];
  for (const relative of removed)
    fs.rmSync(path.join(out, relative), { recursive: true, force: true });
  // Folders those pages leave empty go too.
  for (const relative of new Set(notFound.map((file) => path.dirname(file)))) {
    const folder = path.join(out, relative);
    if (
      relative !== "." &&
      fs.existsSync(folder) &&
      fs.readdirSync(folder).length === 0
    )
      fs.rmdirSync(folder);
  }
  return removed;
}

const steps = {
  cloudflare({ settings, origin }, apply) {
    // At the root: Wrangler resolves the config's paths from its folder.
    const config = path.join(root, "wrangler.generated.json");
    fs.writeFileSync(config, `${JSON.stringify(wranglerConfig(settings), null, 2)}\n`);
    const env = { NEXT_PUBLIC_SITE_ORIGIN: origin, FOLIO_HOSTING: "cloudflare" };
    run("npx", ["opennextjs-cloudflare", "build", "--config", config], env);
    fs.writeFileSync(path.join(root, ".open-next/assets/_headers"), cloudflareAssetHeaders());
    if (apply) run("npx", ["opennextjs-cloudflare", "deploy", "--config", config], env);
    else console.log(`\nBuilt for Cloudflare (${settings.worker}). Add --apply to publish.`);
  },
  vercel({ settings, origin }, apply) {
    // Vercel builds from Git; a manual deployment builds here and uploads.
    const env = { NEXT_PUBLIC_SITE_ORIGIN: origin, FOLIO_HOSTING: "vercel" };
    if (!apply) {
      run("npm", ["run", "build"], env);
      console.log("\nBuilt for Vercel. Pushes deploy through its Git integration; --apply deploys from here.");
      return;
    }
    const project = settings.project ? ["--project", settings.project] : [];
    run("npx", ["--yes", "vercel", "deploy", "--prod", ...project], env);
  },
  firebase({ settings, origin, redirects }, apply) {
    // Firebase's free plan serves static files: the site is exported as such.
    const env = {
      NEXT_PUBLIC_SITE_ORIGIN: origin,
      NEXT_PUBLIC_WEATHER_DIRECT: "1",
      FOLIO_HOSTING: "firebase",
    };
    run("npm", ["run", "build"], env);
    removeUnpublished(path.join(root, "out"));
    const site = settings.site ?? settings.projectId;
    fs.writeFileSync(
      path.join(root, "firebase.generated.json"),
      `${JSON.stringify(firebaseConfig(site, redirects), null, 2)}\n`,
    );
    if (apply)
      run("npx", ["--yes", "firebase-tools", "deploy", "--only", "hosting", "--project", settings.projectId, "--config", "firebase.generated.json"], env);
    else console.log(`\nExported for Firebase (${site}). Add --apply to publish.`);
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const requested = args.find((arg) => !arg.startsWith("--"));
  const profile = JSON.parse(fs.readFileSync(path.join(root, "portfolio.json"), "utf8"));
  const chosen = target(profile, requested);
  console.log(`Deploying to ${chosen.provider} as ${chosen.origin}${apply ? "" : " (build only)"}.`);
  steps[chosen.provider](chosen, apply);
}
