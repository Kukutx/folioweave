import {
  HOME_SECTIONS,
  resolveNavigation,
  resolvePublishedRoutes,
} from "./publication-policy.mjs";

export function localAssetPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return null;
  const clean = value.split(/[?#]/)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    throw new Error(`Invalid asset path: ${value}`);
  }
  if (
    /[\\\s\x00-\x1f]/.test(decoded) ||
    decoded.split("/").some((part) => part === ".." || part === ".")
  ) {
    throw new Error(`Unsafe asset path: ${value}`);
  }
  return /\.(?:avif|gif|jpe?g|png|webp|svg|ico|pdf|mp4|webm|mp3|m4a|ogg|wav|aac|flac|woff2?)$/i.test(
    clean,
  )
    ? clean
    : null;
}

export function collectAssets(value, result = new Set()) {
  if (typeof value === "string") {
    const asset = localAssetPath(value);
    if (asset) result.add(asset);
  } else if (Array.isArray(value))
    value.forEach((item) => collectAssets(item, result));
  else if (value && typeof value === "object")
    Object.values(value).forEach((item) => collectAssets(item, result));
  return result;
}

/** Image URLs and manifest keys must be identical, unambiguous local paths. */
export function requireImagePath(value) {
  const asset = localAssetPath(value);
  if (
    !asset ||
    asset !== value ||
    /[%:]/.test(value) ||
    value.includes("//") ||
    !/\.(?:avif|gif|jpe?g|png|webp|svg)$/i.test(value)
  )
    throw new Error(
      `Image must use a canonical local public path without query or fragment: ${value}`,
    );
  return value;
}

export function validateContentLinks(links, publishedRoutes) {
  const routes = new Set(publishedRoutes);
  for (const href of links) {
    if (/[\\\s\x00-\x1f]/.test(href) || href.startsWith("//"))
      throw new Error(`Unsafe content link: ${href}`);
    if (href.startsWith("#")) continue;
    if (href.startsWith("/")) {
      if (!localAssetPath(href) && !routes.has(href.split(/[?#]/)[0]))
        throw new Error(`Content link points to an unpublished route: ${href}`);
    } else {
      const url = new URL(href);
      if (!["https:", "http:", "mailto:", "tel:"].includes(url.protocol))
        throw new Error(`Unsafe content link protocol: ${url.protocol}`);
    }
  }
}

/** The scheme and host a profile should use for a URL, or null if it has none. */
export function canonicalOrigin(value) {
  if (typeof value !== "string" || !URL.canParse(value)) return null;
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) ? url.origin : null;
}

export const isEmailAddress = (value) =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Source content is retained; only this view is eligible for publication. */
export function publishedPortfolio(config, sections = HOME_SECTIONS) {
  return {
    ...config,
    ...(config.template
      ? {
          template: {
            id: config.template.id,
            settings: {
              [config.template.id]:
                config.template.settings?.[config.template.id] ?? {},
            },
          },
        }
      : {}),
    ...(config.plugins
      ? {
          plugins: Object.fromEntries(
            Object.entries(config.plugins).filter(
              ([, plugin]) => plugin.enabled,
            ),
          ),
        }
      : {}),
    site: {
      ...config.site,
      resume: config.features.resume
        ? config.site.resume
        : { image: "", pdf: "", downloadName: "" },
      navigation: resolveNavigation(
        config.site.navigation,
        config.features,
        sections,
      ),
    },
    about: config.features.about
      ? config.about
      : { timeline: [], story: [], galleryImages: [] },
    projects: config.features.work
      ? config.projects.filter((project) => project.enabled)
      : [],
    photography: config.features.photography
      ? config.photography
      : { intro: "", images: [] },
  };
}

export function validatePublicationLinks(
  config,
  blogRoutes = [],
  sections = HOME_SECTIONS,
  definitions,
) {
  try {
    new Intl.Locale(config.site.identity.locale);
    new Intl.DateTimeFormat(config.site.identity.locale, {
      timeZone: config.site.location.timeZone,
    });
  } catch {
    throw new Error("Profile locale or time zone is invalid.");
  }
  // Canonical URLs, the sitemap and JSON-LD append paths to the origin, so a
  // trailing slash or path would publish addresses such as `//blogs`.
  const { origin } = config.site;
  const canonical = canonicalOrigin(origin);
  if (canonical !== origin)
    throw new Error(
      `site.origin must be a canonical origin without a path or trailing slash${canonical ? `, such as ${canonical}` : " such as https://example.com"}; received ${origin}`,
    );
  if (!isEmailAddress(config.site.contact.email))
    throw new Error(
      `site.contact.email is not an email address: ${config.site.contact.email}`,
    );
  const ids = config.projects.map((project) => project.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Project ids must be unique.");
  if (config.about.timeline.filter((item) => item.current).length > 1)
    throw new Error("Only one timeline item can be current.");
  const routes = new Set(
    resolvePublishedRoutes({
      demoRoutesEnabled: config.features.demoRoutes,
      blogRoutes,
      definitions,
    }),
  );
  for (const item of resolveNavigation(
    config.site.navigation,
    config.features,
    sections,
  )) {
    if (
      item.sectionId &&
      (!sections.includes(item.sectionId) || item.href !== `#${item.sectionId}`)
    ) {
      throw new Error(
        `Navigation ${item.label} must reference an existing matching section.`,
      );
    }
  }
  const inspect = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.href === "string" && value.href.startsWith("/")) {
      const pathname = value.href.split(/[?#]/)[0];
      if (
        pathname.startsWith("//") ||
        (!localAssetPath(pathname) && !routes.has(pathname))
      ) {
        throw new Error(`Link points to an unpublished route: ${value.href}`);
      }
    } else if (typeof value.href === "string") {
      if (value.href.startsWith("#")) {
        if (!sections.includes(value.href.slice(1)))
          throw new Error(`Unknown section: ${value.href}`);
      } else {
        const url = new URL(value.href);
        if (!["https:", "http:", "mailto:"].includes(url.protocol))
          throw new Error(`Unsafe link protocol: ${url.protocol}`);
      }
    }
    Object.values(value).forEach(inspect);
  };
  inspect(publishedPortfolio(config, sections));
}
