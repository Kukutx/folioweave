// Caching for optimised images (/_next/image) where the host's adapter
// leaves it out. Shared by the Cloudflare Worker entry (cloudflare-worker.mjs)
// and its tests.

/** What Next answers /_next/image with for an image that is not a static
 * import: images.minimumCacheTTL (4 hours by default), then revalidate. */
export const OPTIMISED_IMAGE_CACHE = "public, max-age=14400, must-revalidate";

/** The response with Next's caching for an optimised image, when the adapter
 * sent none. The Cloudflare adapter only marks images it can call immutable,
 * so browsers fetched every other optimised image again on each visit. */
export function withImageCaching(url, response) {
  if (
    new URL(url).pathname !== "/_next/image" ||
    !response.ok ||
    response.headers.has("Cache-Control")
  )
    return response;
  const cached = new Response(response.body, response);
  cached.headers.set("Cache-Control", OPTIMISED_IMAGE_CACHE);
  return cached;
}
