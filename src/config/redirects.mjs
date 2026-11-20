// Permanent redirects from the profile's `deployment.redirects`, written once
// and turned into each host's own form: Next's `redirects()` for the hosts
// that run the app (Vercel, Cloudflare) and Firebase Hosting's for the
// static export. An entry with `subpaths` also moves everything under it.

/** @typedef {{ from: string, to: string, subpaths?: boolean }} Redirect */

/** @param {{ deployment?: { redirects?: Redirect[] } }} profile */
export function profileRedirects(profile) {
  const redirects = profile.deployment?.redirects ?? [];
  for (const { to } of redirects) {
    const target = to.split("#")[0] || "/";
    const loop = redirects.find(
      ({ from, subpaths }) =>
        target === from || (subpaths && target.startsWith(`${from}/`)),
    );
    if (loop)
      throw new Error(
        `deployment.redirects: "${to}" is itself redirected by "${loop.from}".`,
      );
  }
  return redirects;
}

/** Next.js `redirects()` entries (308). */
export function nextRedirects(redirects) {
  return redirects.map(({ from, to, subpaths }) => ({
    source: subpaths ? `${from}/:rest*` : from,
    destination: to,
    permanent: true,
  }));
}

/** Firebase Hosting `redirects` entries (301). */
export function firebaseRedirects(redirects) {
  return redirects.flatMap(({ from, to, subpaths }) => [
    { source: from, destination: to, type: 301 },
    ...(subpaths ? [{ source: `${from}/**`, destination: to, type: 301 }] : []),
  ]);
}
