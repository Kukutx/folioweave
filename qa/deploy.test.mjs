// npm run deploy: provider selection and the per-host configuration it writes.
import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudflareAssetHeaders,
  firebaseConfig,
  removeUnpublished,
  target,
  wranglerConfig,
} from "../scripts/deploy.mjs";
import { OPTIMISED_IMAGE_CACHE, withImageCaching } from "../src/config/image-cache.mjs";
import { nextRedirects, profileRedirects } from "../src/config/redirects.mjs";

const profile = {
  site: { origin: "https://example.vercel.app" },
  deployment: {
    provider: "vercel",
    providers: {
      vercel: { project: "example" },
      cloudflare: {
        accountId: "0123456789abcdef0123456789abcdef",
        worker: "example",
        origin: "https://example.someone.workers.dev",
      },
    },
  },
};

test("the profile's provider is the default; another listed one can be named", () => {
  assert.equal(target(profile).provider, "vercel");
  assert.equal(target(profile, "cloudflare").provider, "cloudflare");
});

test("each provider builds with its own address, else the site's", () => {
  assert.equal(target(profile).origin, "https://example.vercel.app");
  assert.equal(target(profile, "cloudflare").origin, "https://example.someone.workers.dev");
});

test("the Cloudflare Worker config carries what the Next adapter needs", () => {
  const config = wranglerConfig(profile.deployment.providers.cloudflare);
  assert.equal(config.name, "example");
  assert.equal(config.account_id, "0123456789abcdef0123456789abcdef");
  assert.equal(config.main, "cloudflare-worker.mjs");
  assert.ok(config.compatibility_flags.includes("nodejs_compat"));
  assert.deepEqual(config.assets, { directory: ".open-next/assets", binding: "ASSETS" });
  assert.equal(config.services[0].service, "example", "the Worker can call itself");
  assert.equal(config.keep_names, false);
});

test("Firebase serves the export with the site's headers and the weather service allowed", () => {
  const { hosting } = firebaseConfig("example-site");
  assert.equal(hosting.site, "example-site");
  assert.equal(hosting.public, "out");
  const headers = Object.fromEntries(hosting.headers[0].headers.map((h) => [h.key, h.value]));
  assert.match(headers["Content-Security-Policy"], /connect-src 'self'[^;]*https:\/\/api\.open-meteo\.com/);
  assert.match(headers["Strict-Transport-Security"], /max-age=/);
});

test("a profile's redirects reach every host in its own form", () => {
  const redirects = [
    { from: "/services/sewing", to: "/sartoria", subpaths: true },
    { from: "/old", to: "/#services" },
  ];
  const routed = target({ ...profile, deployment: { ...profile.deployment, redirects } }, "cloudflare");
  assert.deepEqual(routed.redirects, redirects);
  assert.deepEqual(nextRedirects(redirects), [
    { source: "/services/sewing/:rest*", destination: "/sartoria", permanent: true },
    { source: "/old", destination: "/#services", permanent: true },
  ]);
  const { hosting } = firebaseConfig("example-site", redirects);
  assert.deepEqual(hosting.redirects, [
    { source: "/services/sewing", destination: "/sartoria", type: 301 },
    { source: "/services/sewing/**", destination: "/sartoria", type: 301 },
    { source: "/old", destination: "/#services", type: 301 },
  ]);
  assert.deepEqual(firebaseConfig("example-site").hosting.redirects, []);
});

test("a redirect whose destination is itself redirected is refused", () => {
  const looping = { deployment: { redirects: [
    { from: "/zh", to: "/", subpaths: true },
    { from: "/a", to: "/zh/b" },
  ] } };
  assert.throws(() => profileRedirects(looping), /"\/zh\/b" is itself redirected by "\/zh"/);
});

test("Next's hashed build output is cached for good on Firebase", () => {
  const { hosting } = firebaseConfig("example-site");
  const immutable = hosting.headers.find((h) => h.source === "/_next/static/**");
  assert.match(immutable.headers[0].value, /immutable/);
});

test("everything the app answers can be exported for a static host", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const app = path.resolve(import.meta.dirname, "../src/app");
  // One separator on every system, so files in folders are seen on Windows too.
  const files = fs
    .readdirSync(app, { recursive: true })
    .map((file) => String(file).split(path.sep).join("/"));
  // A live handler is named route.server.ts and is left out of static exports;
  // any other handler or metadata route must be marked static.
  const handlers = files.filter((file) =>
    /(?:^|\/)(?:route\.[jt]sx?|(?:manifest|robots|sitemap)\.[jt]s)$/.test(file),
  );
  assert.ok(
    files.some((file) => file.endsWith("/route.server.ts")),
    "files inside folders are seen",
  );
  assert.ok(handlers.length > 0);
  for (const file of handlers) {
    const source = fs.readFileSync(path.join(app, file), "utf8");
    assert.match(source, /export const dynamic = "force-static"/, `${file} is not marked static`);
  }
});

test("a static export keeps only what the site publishes", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { exportableParams, UNPUBLISHED } = await import("../src/lib/static-params.mjs");
  const before = process.env.FOLIO_HOSTING;
  try {
    process.env.FOLIO_HOSTING = "firebase";
    assert.deepEqual(exportableParams([], "slug"), [{ slug: UNPUBLISHED }]);
    assert.deepEqual(exportableParams([{ slug: "a" }], "slug"), [{ slug: "a" }]);
    delete process.env.FOLIO_HOSTING;
    assert.deepEqual(exportableParams([], "slug"), [], "hosts that run the app need none");
  } finally {
    if (before === undefined) delete process.env.FOLIO_HOSTING;
    else process.env.FOLIO_HOSTING = before;
  }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "folio-export-"));
  try {
    const off = '<script>self.__next_f.push([1,"NEXT_HTTP_ERROR_FALLBACK;404"])</script>';
    const files = {
      [`blogs/${UNPUBLISHED}.html`]: off,
      [`blogs/${UNPUBLISHED}.txt`]: "",
      [`blogs/${UNPUBLISHED}/__next._tree.txt`]: "",
      "blogs/kept.html": "<p>post</p>",
      "demo.html": off,
      "demo.txt": "",
      "demo/__next._tree.txt": "",
      "demo/logo.png": "",
      "gone.html": off,
      "gone/__next._full.txt": "",
      "404.html": "<title>Page Not Found</title>",
      "index.html": "<p>home</p>",
    };
    for (const [file, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
      fs.writeFileSync(path.join(out, file), body);
    }
    removeUnpublished(out);
    const left = fs.readdirSync(out, { recursive: true }).map((p) => String(p).replaceAll("\\", "/")).sort();
    assert.deepEqual(left, ["404.html", "blogs", "blogs/kept.html", "demo", "demo/logo.png", "index.html"]);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("Cloudflare caches Next's hashed build output for good", () => {
  assert.equal(
    cloudflareAssetHeaders(),
    "/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n",
  );
});

test("optimised images keep Next's caching on Cloudflare", async () => {
  const { imageConfigDefault } = await import("next/dist/shared/lib/image-config.js");
  assert.equal(
    OPTIMISED_IMAGE_CACHE,
    `public, max-age=${imageConfigDefault.minimumCacheTTL}, must-revalidate`,
    "the same as Next's own optimiser",
  );
  const image = "https://example.com/_next/image?url=%2Fa.jpg&w=640&q=75";
  const bare = new Response("img", { headers: { "Content-Type": "image/webp", Vary: "Accept" } });
  const cached = withImageCaching(image, bare);
  assert.equal(cached.headers.get("Cache-Control"), OPTIMISED_IMAGE_CACHE);
  assert.equal(cached.headers.get("Vary"), "Accept");
  assert.equal(await cached.text(), "img");
  // The adapter's own header (static imports, immutable sources) stays.
  const immutable = new Response("img", { headers: { "Cache-Control": "public, max-age=315360000, immutable" } });
  assert.equal(withImageCaching(image, immutable).headers.get("Cache-Control"), "public, max-age=315360000, immutable");
  // Errors and every other address pass through untouched.
  assert.equal(withImageCaching(image, new Response("bad", { status: 400 })).headers.get("Cache-Control"), null);
  assert.equal(withImageCaching("https://example.com/about", new Response("page")).headers.get("Cache-Control"), null);
});
