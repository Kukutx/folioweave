import type { NextConfig } from "next";
import { nextRedirects } from "./src/config/redirects.mjs";
import { securityHeaders as sharedSecurityHeaders } from "./src/config/security-headers.mjs";
import movedAddresses from "./src/portfolio/redirects.generated.json";
import extensionNetwork from "./src/portfolio/security.generated.json";

const isDevelopment = process.env.NODE_ENV !== "production";

const parsedBuildWorkers = Number.parseInt(
  process.env.NEXT_BUILD_WORKERS ?? "4",
  10,
);
const buildWorkers = Number.isFinite(parsedBuildWorkers)
  ? Math.max(1, Math.min(parsedBuildWorkers, 16))
  : 4;

const securityHeaders = sharedSecurityHeaders({
  development: isDevelopment,
  network: extensionNetwork as Record<string, string[]>,
});

/** Static hosts (npm run deploy -- firebase) get the site as files; their
 * own configuration serves the headers. */
const staticExport = process.env.FOLIO_HOSTING === "firebase";

/** The profile's old addresses (deployment.redirects, written by content:build);
 * a static export gets them from its host's configuration instead. */
const redirects = nextRedirects(movedAddresses);

const nextConfig: NextConfig = {
  // Route handlers that answer live (`route.server.ts`, such as the weather)
  // exist only where a server runs; a static export leaves them out.
  pageExtensions: staticExport
    ? ["tsx", "ts", "jsx", "js"]
    : ["tsx", "ts", "jsx", "js", "server.ts"],
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Next 16 otherwise uses nearly every logical CPU for page-data generation.
    // A conservative default avoids native worker crashes on Windows/CI while
    // NEXT_BUILD_WORKERS keeps the setting portable for larger build hosts.
    cpus: buildWorkers,
  },
  ...(staticExport
    ? { output: "export", images: { unoptimized: true } }
    : {
        ...(redirects.length > 0
          ? {
              async redirects() {
                return redirects;
              },
            }
          : {}),
        async headers() {
          return [
            {
              source: "/:path*",
              headers: securityHeaders,
            },
          ];
        },
      }),
};

export default nextConfig;
