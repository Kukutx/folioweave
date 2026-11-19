// Cloudflare Workers adapter settings (npm run deploy -- cloudflare).
// Every page is prerendered, so pages are read from the Worker's static
// assets; nothing at runtime writes to a cache.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
