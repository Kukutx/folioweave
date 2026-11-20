// The Worker entry for Cloudflare (npm run deploy -- cloudflare): the Next
// adapter's own Worker, which `opennextjs-cloudflare build` writes to
// .open-next/worker.js, with Next's caching put back on optimised images
// (src/config/image-cache.mjs). See
// https://opennext.js.org/cloudflare/howtos/custom-worker.
import adapter from "./.open-next/worker.js";
import { withImageCaching } from "./src/config/image-cache.mjs";

const worker = {
  async fetch(request, env, context) {
    return withImageCaching(request.url, await adapter.fetch(request, env, context));
  },
};

export default worker;
