import routeDefinitions from "./routes.json" with { type: "json" };

export const DEMO_ONLY_ROUTES = Object.freeze(
  routeDefinitions.filter((route) => route.demoOnly).map((route) => route.path),
);

export const HOME_SECTIONS = Object.freeze([
  "home",
  "about",
  "interlude",
  "work",
  "photography",
  "contact",
]);

/** @template {{ sectionId: string | null, demoOnly?: boolean }} T
 * @param {T[]} navigation
 * @param {{demoRoutes: boolean, about: boolean, work: boolean, photography: boolean}} features
 * @returns {T[]}
 */
export function resolveNavigation(navigation, features) {
  return navigation.filter((item) => {
    if (item.demoOnly && !features.demoRoutes) return false;
    if (["about", "work", "photography"].includes(item.sectionId))
      return features[item.sectionId];
    return true;
  });
}

/** @param {{ demoRoutesEnabled: boolean, blogRoutes?: string[] }} options */
export function resolvePublishedRoutes({ demoRoutesEnabled, blogRoutes = [] }) {
  return [
    ...new Set([
      "/",
      ...routeDefinitions
        .filter((route) => !route.demoOnly)
        .map((route) => route.path),
      ...(demoRoutesEnabled ? DEMO_ONLY_ROUTES : []),
      ...(blogRoutes.length ? ["/blogs", ...blogRoutes] : []),
    ]),
  ];
}

/** @param {{ demoRoutesEnabled: boolean, blogRoutes?: string[] }} options */
export function resolveDisabledDemoRoutes({
  demoRoutesEnabled,
  blogRoutes = [],
}) {
  if (demoRoutesEnabled) return [];
  return [...DEMO_ONLY_ROUTES, ...(blogRoutes.length ? [] : ["/blogs"])];
}

export function isDemoOnlyRoute(route) {
  return DEMO_ONLY_ROUTES.includes(route);
}
