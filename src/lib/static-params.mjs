// A static export must render at least one page for every dynamic route,
// even one the profile does not use (a shop without posts has no
// /blogs/[slug]). Such a route then gets a single placeholder that renders as
// not found, and scripts/deploy.mjs removes its files from the export.

export const UNPUBLISHED = "__unpublished";

/**
 * @template {Record<string, string>} T
 * @param {T[]} params
 * @param {keyof T & string} key
 * @returns {T[]}
 */
export function exportableParams(params, key) {
  if (params.length > 0 || process.env.FOLIO_HOSTING !== "firebase")
    return params;
  return [/** @type {T} */ ({ [key]: UNPUBLISHED })];
}

/** Whether a path inside the export belongs to a placeholder. */
export function isPlaceholderPath(relative) {
  return relative.split(/[\\/]/).some((part) => part.startsWith(UNPUBLISHED));
}
