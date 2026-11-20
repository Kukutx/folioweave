import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import points from "./extension-points.json" with { type: "json" };

export const API_VERSION = 1;
export const SLOTS = Object.keys(points.slots);
/** Profile blocks the shared schema leaves optional (a dotted path for a
 * block inside another); a template that renders one names it under
 * "requires" and publication insists on it for that template. A shop needs
 * no email address, a portfolio does. */
export const OPTIONAL_BLOCKS = Object.freeze([
  "photography",
  "footerBook",
  "interlude",
  "store",
  "site.contact",
]);

/** The value at a dotted path in a profile, or undefined. */
export function profileValue(profile, dotted) {
  return dotted
    .split(".")
    .reduce(
      (node, key) => (node && typeof node === "object" ? node[key] : undefined),
      profile,
    );
}
export const implementationRoot = path.resolve(import.meta.dirname, "../..");
const idPattern = /^[a-z][a-z0-9-]*$/;
const entryPattern = /^[a-z][a-z0-9-]*\.tsx$/;
const optionValidators = new WeakMap();

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return (
      typeof value === "string" &&
      /^https:\/\//.test(value) &&
      !/[\s\\]/.test(value) &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function optionsValidator(schema) {
  return new Ajv2020({ allErrors: true, strict: false })
    .addFormat("https-url", { type: "string", validate: isHttpsUrl })
    .addKeyword({
      keyword: "uniqueBy",
      type: "array",
      schemaType: "string",
      validate: (key, items) =>
        new Set(items.map((item) => item?.[key])).size === items.length,
    })
    .compile(schema);
}

/** A dot-separated option path; `*` steps through an array. */
export const optionSelector =
  /^[a-zA-Z][a-zA-Z0-9]*(?:\.(?:\*|[a-zA-Z][a-zA-Z0-9]*))*$/;

/** Every value an option path selects. */
export function optionValues(value, segments) {
  if (!segments.length) return value === undefined ? [] : [value];
  const [key, ...rest] = segments;
  if (key === "*")
    return Array.isArray(value)
      ? value.flatMap((item) => optionValues(item, rest))
      : [];
  return value && Object.hasOwn(value, key)
    ? optionValues(value[key], rest)
    : [];
}

function networkFromOptions(manifest, options) {
  const result = {};
  for (const [directive, selectors] of Object.entries(
    manifest.networkOptions ?? {},
  )) {
    if (
      !["media-src", "img-src", "connect-src"].includes(directive) ||
      !Array.isArray(selectors) ||
      selectors.some(
        (selector) =>
          typeof selector !== "string" || !optionSelector.test(selector),
      )
    )
      throw new Error(`${manifest.id}: invalid networkOptions declaration`);
    const origins = [];
    for (const selector of selectors)
      for (const value of optionValues(options, selector.split("."))) {
        if (
          typeof value === "string" &&
          value.startsWith("/") &&
          !value.startsWith("//")
        )
          continue;
        if (!isHttpsUrl(value))
          throw new Error(
            `${manifest.id}: ${selector} requires a local path or credential-free HTTPS URL`,
          );
        origins.push(new URL(value).origin);
      }
    if (origins.length) result[directive] = [...new Set(origins)].sort();
  }
  return result;
}

/** URL prefix of every plugin page; one dynamic route serves them all. */
export const PLUGIN_PAGE_PREFIX = "/tools";
const pagePathPattern = /^[a-z][a-z0-9-]*$/;

/** A plugin may contribute one page, served at /tools/<path>. Its `entry`
 * renders the page; an optional `icon` component represents it in menus. */
function validatePluginPage(manifest, directory) {
  const page = manifest.page;
  if (page === undefined) return;
  const file = (name) =>
    typeof name === "string" &&
    entryPattern.test(name) &&
    fs
      .statSync(path.join(directory, manifest.id, name), {
        throwIfNoEntry: false,
      })
      ?.isFile();
  const known = new Set(["entry", "path", "title", "description", "icon"]);
  if (
    !page ||
    typeof page !== "object" ||
    Array.isArray(page) ||
    Object.keys(page).some((key) => !known.has(key)) ||
    !file(page.entry) ||
    !pagePathPattern.test(page.path ?? "") ||
    typeof page.title !== "string" ||
    !page.title.trim() ||
    (page.description !== undefined &&
      (typeof page.description !== "string" || !page.description.trim())) ||
    (page.icon !== undefined && !file(page.icon))
  )
    throw new Error(
      `${manifest.id}: page needs an existing .tsx entry, a lowercase path, a title, and optionally a description and an existing .tsx icon`,
    );
}

/** A plugin may also offer one action: something it opens in place (an
 * overlay) rather than a page. Menus link to `#<hash>`; the plugin, mounted in
 * one of its slots, opens on that hash, so the address can be shared too. */
function validatePluginAction(manifest, directory) {
  const action = manifest.action;
  if (action === undefined) return;
  const known = new Set(["hash", "title", "description", "icon"]);
  if (
    !action ||
    typeof action !== "object" ||
    Array.isArray(action) ||
    Object.keys(action).some((key) => !known.has(key)) ||
    !pagePathPattern.test(action.hash ?? "") ||
    typeof action.title !== "string" ||
    !action.title.trim() ||
    (action.description !== undefined &&
      (typeof action.description !== "string" || !action.description.trim())) ||
    (action.icon !== undefined &&
      !(
        typeof action.icon === "string" &&
        entryPattern.test(action.icon) &&
        fs
          .statSync(path.join(directory, manifest.id, action.icon), {
            throwIfNoEntry: false,
          })
          ?.isFile()
      )) ||
    !manifest.slots?.length
  )
    throw new Error(
      `${manifest.id}: action needs a lowercase hash, a title, optionally a description and an existing .tsx icon, and a slot to open in`,
    );
}

/** What a plugin mounted in a slot may add to every page it appears on, in
 * gzip bytes. The bundle budget grants it on top of the template's own, and
 * qa/plugin-budget.test.mjs holds the plugin's client code to it. */
function validatePluginBudget(manifest) {
  const budget = manifest.budget;
  if (budget === undefined) return;
  const bytes = (value) => Number.isInteger(value) && value > 0;
  if (
    !budget ||
    typeof budget !== "object" ||
    Array.isArray(budget) ||
    Object.keys(budget).some(
      (key) => !["jsGzipBytes", "cssGzipBytes"].includes(key),
    ) ||
    !bytes(budget.jsGzipBytes) ||
    !bytes(budget.cssGzipBytes) ||
    !manifest.slots?.length ||
    !manifest.entry
  )
    throw new Error(
      `${manifest.id}: budget needs positive whole jsGzipBytes and cssGzipBytes, and a slot entry it applies to`,
    );
}

/** Kinds of site a template makes, for the gallery; `personal` by default. */
export const TEMPLATE_CATEGORIES = Object.freeze(["personal", "store"]);

/** Single-segment paths a template page may not take: core routes own them. */
export const RESERVED_PAGE_PATHS = Object.freeze(["api", "blogs", "tools"]);

/** Optional views (a 404 page) and the extra pages a template contributes. */
function validateTemplateExtras(manifest, directory) {
  const file = (name) =>
    typeof name === "string" &&
    entryPattern.test(name) &&
    fs
      .statSync(path.join(directory, manifest.id, name), {
        throwIfNoEntry: false,
      })
      ?.isFile();
  for (const view of Object.keys(points.optionalViews))
    if (manifest.entries?.[view] !== undefined && !file(manifest.entries[view]))
      throw new Error(`${manifest.id}: ${view} entry is missing or invalid`);
  // Gallery metadata: what kind of site it is and a picture of it.
  if (
    manifest.category !== undefined &&
    !TEMPLATE_CATEGORIES.includes(manifest.category)
  )
    throw new Error(
      `${manifest.id}: category must be one of ${TEMPLATE_CATEGORIES.join(", ")}`,
    );
  if (
    manifest.preview !== undefined &&
    !(
      typeof manifest.preview === "string" &&
      /^[a-z0-9][a-z0-9-]*\.(?:webp|png|jpg)$/.test(manifest.preview) &&
      fs
        .statSync(path.join(directory, manifest.id, manifest.preview), {
          throwIfNoEntry: false,
        })
        ?.isFile()
    )
  )
    throw new Error(
      `${manifest.id}: preview must name an existing .webp, .png or .jpg in the template directory`,
    );
  const known = new Set([
    ...Object.keys(points.views),
    ...Object.keys(points.optionalViews),
  ]);
  for (const view of Object.keys(manifest.entries ?? {}))
    if (!known.has(view))
      throw new Error(`${manifest.id}: unknown view ${view}`);
  if (manifest.pages === undefined) return;
  const fields = new Set(["id", "entry", "path", "pathOption", "requires"]);
  if (
    !Array.isArray(manifest.pages) ||
    manifest.pages.some(
      (page) =>
        !page ||
        typeof page !== "object" ||
        Object.keys(page).some((key) => !fields.has(key)) ||
        !idPattern.test(page.id ?? "") ||
        !file(page.entry) ||
        !pagePathPattern.test(page.path ?? "") ||
        RESERVED_PAGE_PATHS.includes(page.path) ||
        (page.pathOption !== undefined &&
          !/^[a-z][a-zA-Z0-9]*$/.test(page.pathOption)) ||
        (page.requires !== undefined &&
          !/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/.test(page.requires)),
    ) ||
    new Set(manifest.pages.map((page) => page.id)).size !==
      manifest.pages.length
  )
    throw new Error(
      `${manifest.id}: pages need unique ids, an existing .tsx entry and a lowercase path outside ${RESERVED_PAGE_PATHS.join(", ")}; pathOption names a template option, requires a dotted profile path`,
    );
}

/** Whether the profile has something at a dotted path (a non-empty value). */
function profileHas(profile, dotted) {
  const value = profileValue(profile, dotted);
  return Array.isArray(value)
    ? value.length > 0
    : value !== undefined && value !== null && value !== "";
}

/** The pages the selected template adds, at their resolved paths. An author
 * may rename a page through the option its manifest names in `pathOption`; a
 * page whose `requires` path is empty in the profile is not published. */
export function templatePages(resolved) {
  const pages = (resolved.template.pages ?? [])
    .filter(
      (page) => !page.requires || profileHas(resolved.profile, page.requires),
    )
    .map((page) => {
      const chosen = page.pathOption && resolved.options[page.pathOption];
      const path = typeof chosen === "string" && chosen ? chosen : page.path;
      if (!pagePathPattern.test(path) || RESERVED_PAGE_PATHS.includes(path))
        throw new Error(
          `${resolved.template.id}: page ${page.id} cannot use the path ${path}`,
        );
      return { ...page, path, href: `/${path}` };
    });
  if (new Set(pages.map((page) => page.path)).size !== pages.length)
    throw new Error(`${resolved.template.id}: two pages share one path`);
  return pages;
}

/** Catalogs contain trusted local source, never executable paths from a profile. */
export function loadCatalog(root = implementationRoot) {
  const read = (kind) => {
    const directory = path.join(root, "src", kind);
    let directories;
    try {
      directories = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (kind === "plugins" && error.code === "ENOENT") return [];
      throw error;
    }
    return directories
      .filter((item) => item.isDirectory() && !item.name.startsWith("_"))
      .map((item) => {
        const filename = path.join(directory, item.name, "manifest.json");
        const manifest = JSON.parse(fs.readFileSync(filename, "utf8"));
        // Variants of one design share a schema file kept in an underscored
        // directory of the same catalog, which is never itself an extension.
        if (typeof manifest.optionsSchema === "string") {
          const shared = path.resolve(
            directory,
            item.name,
            manifest.optionsSchema,
          );
          if (
            !/^_[a-z][a-z0-9-]*$/.test(
              path.relative(directory, path.dirname(shared)),
            ) ||
            !shared.endsWith(".schema.json")
          )
            throw new Error(
              `${item.name}: a shared optionsSchema must be a .schema.json file in an underscored directory of src/${kind}`,
            );
          manifest.optionsSchema = JSON.parse(fs.readFileSync(shared, "utf8"));
        }
        if (!idPattern.test(manifest.id) || manifest.id !== item.name)
          throw new Error(`Invalid ${kind} id in ${filename}`);
        if (manifest.apiVersion !== API_VERSION)
          throw new Error(
            `${manifest.id}: unsupported extension API ${manifest.apiVersion}`,
          );
        if (!/^\d+\.\d+\.\d+$/.test(manifest.version) || !manifest.name?.trim())
          throw new Error(
            `${manifest.id}: name and semantic version are required`,
          );
        // Optional localised gallery text: { "zh": { "name", "description" } }.
        if (
          manifest.translations !== undefined &&
          (typeof manifest.translations !== "object" ||
            Array.isArray(manifest.translations) ||
            Object.entries(manifest.translations).some(
              ([language, text]) =>
                !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language) ||
                !text ||
                typeof text !== "object" ||
                Object.entries(text).some(
                  ([key, value]) =>
                    !["name", "description"].includes(key) ||
                    typeof value !== "string" ||
                    !value.trim(),
                ),
            ))
        )
          throw new Error(
            `${manifest.id}: translations map a language code to a name and description`,
          );
        if (kind === "plugins") {
          validatePluginPage(manifest, directory);
          validatePluginAction(manifest, directory);
          validatePluginBudget(manifest);
        } else validateTemplateExtras(manifest, directory);
        const entries =
          kind === "templates"
            ? Object.keys(points.views).map((view) => manifest.entries?.[view])
            : // A plugin that only contributes a page has no slot component.
              manifest.slots?.length || manifest.entry !== undefined
              ? [manifest.entry]
              : [];
        if (
          entries.some(
            (entry) =>
              typeof entry !== "string" ||
              !entryPattern.test(entry) ||
              !fs
                .statSync(path.join(directory, item.name, entry), {
                  throwIfNoEntry: false,
                })
                ?.isFile(),
          )
        )
          throw new Error(
            `${manifest.id}: missing or invalid entry; templates require separate entries for ${Object.keys(points.views).join(", ")}`,
          );
        if (
          !Array.isArray(manifest.slots) ||
          new Set(manifest.slots).size !== manifest.slots.length ||
          manifest.slots.some((slot) => !SLOTS.includes(slot)) ||
          (kind === "plugins" && !manifest.slots.length && !manifest.page)
        )
          throw new Error(
            `${manifest.id}: invalid slots${kind === "plugins" ? "; a plugin needs a slot, a page, or both" : ""}`,
          );
        if (
          kind === "templates" &&
          (!Array.isArray(manifest.sections) ||
            manifest.sections.some((section) => !idPattern.test(section)))
        )
          throw new Error(`${manifest.id}: invalid section ids`);
        if (
          manifest.requires !== undefined &&
          (kind !== "templates" ||
            !Array.isArray(manifest.requires) ||
            manifest.requires.some((block) => !OPTIONAL_BLOCKS.includes(block)))
        )
          throw new Error(
            `${manifest.id}: requires may only list ${OPTIONAL_BLOCKS.join(", ")}`,
          );
        if (!manifest.optionsSchema || manifest.optionsSchema.type !== "object")
          throw new Error(
            `${manifest.id}: optionsSchema must describe an object`,
          );
        if (
          manifest.generateOptions !== undefined &&
          typeof manifest.generateOptions !== "boolean"
        )
          throw new Error(`${manifest.id}: generateOptions must be a boolean`);
        optionValidators.set(
          manifest,
          optionsValidator(manifest.optionsSchema),
        );
        networkFromOptions(manifest, {});
        for (const [directive, origins] of Object.entries(
          manifest.network ?? {},
        )) {
          if (
            ![
              "script-src",
              "connect-src",
              "frame-src",
              "img-src",
              "media-src",
            ].includes(directive) ||
            !Array.isArray(origins)
          )
            throw new Error(`${manifest.id}: invalid network declaration`);
          for (const origin of origins) {
            const url = new URL(origin);
            if (url.protocol !== "https:" || url.origin !== origin)
              throw new Error(
                `${manifest.id}: network sources must be exact HTTPS origins`,
              );
          }
        }
        return manifest;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  };
  return { templates: read("templates"), plugins: read("plugins") };
}

export function validateExtensionOptions(manifest, options) {
  const validate =
    optionValidators.get(manifest) ?? optionsValidator(manifest.optionsSchema);
  if (!validate(options)) {
    const problems = validate.errors.map((error) => {
      const where = error.instancePath.slice(1).replaceAll("/", ".");
      const name =
        error.params?.propertyName ?? error.params?.additionalProperty;
      return `  - ${where || "options"}${name ? ` "${name}"` : ""}: ${error.message}`;
    });
    throw new Error(
      `${manifest.id} options are not valid:\n${[...new Set(problems)].join("\n")}\nSet them in portfolio.json or pass --options <file.json> to the CLI; ${manifest.id}'s manifest.json lists the accepted fields.`,
    );
  }
}

/** Publication insists on the optional profile blocks the selected template
 * renders. Resolving extensions alone does not: it also serves partial configs. */
export function requireProfileBlocks(config, template) {
  const missing = (template.requires ?? []).filter(
    (block) => profileValue(config, block) === undefined,
  );
  if (missing.length)
    throw new Error(
      `${template.id} needs ${missing.map((block) => `"${block}"`).join(", ")} in portfolio.json. Add ${missing.length > 1 ? "those blocks" : "that block"}, or select a template that does not use ${missing.length > 1 ? "them" : "it"}.`,
    );
}

/** One resolver is used by publication, the CLI, security headers and QA. */
export function resolveExtensions(config, catalog = loadCatalog()) {
  const id = config.template?.id ?? "classic";
  const template = catalog.templates.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  const options = config.template?.settings?.[id] ?? {};
  validateExtensionOptions(template, options);
  networkFromOptions(template, options);
  const plugins = [];
  for (const [pluginId, selection] of Object.entries(config.plugins ?? {})) {
    // Retained disabled settings are checked when enabled, but never published.
    if (!selection.enabled) continue;
    const manifest = catalog.plugins.find((item) => item.id === pluginId);
    if (!manifest) throw new Error(`Unknown plugin: ${pluginId}`);
    validateExtensionOptions(manifest, selection.options ?? {});
    networkFromOptions(manifest, selection.options ?? {});
    const slot = selection.slot ?? manifest.slots[0] ?? null;
    if (
      slot === null
        ? selection.slot !== undefined
        : !manifest.slots.includes(slot) || !template.slots.includes(slot)
    )
      throw new Error(`${pluginId}: slot ${slot} is not supported by ${id}`);
    plugins.push({
      id: pluginId,
      slot,
      options: selection.options ?? {},
      manifest,
    });
  }
  const pages = new Map();
  for (const plugin of plugins) {
    const page = plugin.manifest.page;
    if (!page) continue;
    if (pages.has(page.path))
      throw new Error(
        `${plugin.id}: page path ${page.path} is already used by ${pages.get(page.path)}`,
      );
    pages.set(page.path, plugin.id);
  }
  return { template, options, plugins, profile: config };
}

/** Routes of the pages that enabled plugins contribute. */
export function pluginPageRoutes(resolved) {
  return resolved.plugins
    .filter((plugin) => plugin.manifest.page)
    .map((plugin) => `${PLUGIN_PAGE_PREFIX}/${plugin.manifest.page.path}`);
}

export function extensionSources(config, catalog) {
  const resolved = resolveExtensions(config, catalog);
  return resolvedNetwork(resolved);
}

function resolvedNetwork(resolved) {
  const network = {};
  for (const item of [
    { manifest: resolved.template, options: resolved.options },
    ...resolved.plugins,
  ])
    for (const declarations of [
      item.manifest.network ?? {},
      networkFromOptions(item.manifest, item.options),
    ])
      for (const [directive, origins] of Object.entries(declarations))
        network[directive] = [
          ...new Set([...(network[directive] ?? []), ...origins]),
        ].sort();
  return network;
}

const viewTarget = (filename) =>
  `src/portfolio/template-${filename}.generated.ts`;
const slotTarget = (filename) =>
  `src/portfolio/plugins-${filename}.generated.tsx`;
/** Every file a template or plugin selection rewrites. The branch policy reads
 * this list, so a new view or slot is profile-owned the moment it is declared. */
const PAGES_TARGET = "src/portfolio/plugin-pages.generated.tsx";
const PAGE_LINKS_TARGET = "src/portfolio/plugin-page-links.generated.tsx";
export const SELECTION_OUTPUTS = Object.freeze([
  "src/portfolio/security.generated.json",
  "src/portfolio/template.generated.ts",
  ...Object.values(points.views).map(viewTarget),
  ...Object.values(points.slots).map(slotTarget),
  PAGES_TARGET,
  PAGE_LINKS_TARGET,
  ...Object.values(points.optionalViews).map(viewTarget),
  "src/portfolio/template-pages.generated.tsx",
]);

/** Optional views fall back to the core's own implementation. */
const DEFAULT_VIEWS = Object.freeze({
  NotFound: "@/components/system/not-found-view",
});

/** The selected template's extra pages, each with its metadata function. */
function templatePageOutput(resolved) {
  const pages = templatePages(resolved);
  const importOf = (page) =>
    JSON.stringify(
      `@/templates/${resolved.template.id}/${page.entry.replace(/\.tsx$/, "")}`,
    );
  return {
    target: "src/portfolio/template-pages.generated.tsx",
    contents: `// Generated template page entries; imports only the selected template's pages.\nimport 'server-only';\nimport type { TemplatePageEntry } from '@/core/contracts';\n${pages.map((page, i) => `import Page${i}, { describe as describe${i} } from ${importOf(page)};`).join("\n")}${pages.length ? "\n" : ""}export const templatePages: TemplatePageEntry[] = [${pages.map((page, i) => `\n  { id: ${JSON.stringify(page.id)}, path: ${JSON.stringify(page.path)}, href: ${JSON.stringify(page.href)}, Page: Page${i}, describe: describe${i} },`).join("")}${pages.length ? "\n" : ""}];\n`,
  };
}

/** The page route imports page components; menus import only titles and icons,
 * so a layout never pulls a page implementation into its module graph. */
function pageOutputs(plugins) {
  const paged = plugins.filter((plugin) => plugin.manifest.page);
  const importPath = (plugin, file) =>
    JSON.stringify(`@/plugins/${plugin.id}/${file.replace(/\.tsx$/, "")}`);
  const href = (plugin) => `${PLUGIN_PAGE_PREFIX}/${plugin.manifest.page.path}`;
  const describe = (plugin) => {
    const { title, description } = plugin.manifest.page;
    return `id: ${JSON.stringify(plugin.id)}, path: ${JSON.stringify(plugin.manifest.page.path)}, href: ${JSON.stringify(href(plugin))}, title: ${JSON.stringify(title)}${description ? `, description: ${JSON.stringify(description)}` : ""}`;
  };
  return [
    {
      target: PAGES_TARGET,
      contents: `// Generated plugin page entries; imports only enabled plugin pages.\nimport 'server-only';\nimport type { PluginPageEntry } from '@/core/contracts';\n${paged.map((plugin, i) => `import Page${i} from ${importPath(plugin, plugin.manifest.page.entry)};`).join("\n")}${paged.length ? "\n" : ""}export const pluginPages: PluginPageEntry[] = [${paged.map((plugin, i) => `\n  { ${describe(plugin)}, name: ${JSON.stringify(plugin.manifest.name)}, Page: Page${i}, options: ${JSON.stringify(plugin.options)} },`).join("")}${paged.length ? "\n" : ""}];\n`,
    },
    {
      target: PAGE_LINKS_TARGET,
      contents: menuLinks(plugins, describe, importPath),
    },
  ];
}

/** Menu entries: plugin pages (kind "page") and plugin actions (kind
 * "action", linking to `#<hash>`), with their icons. */
function menuLinks(plugins, describePage, importPath) {
  const links = [];
  for (const plugin of plugins) {
    const { page, action } = plugin.manifest;
    if (page)
      links.push({
        fields: `${describePage(plugin)}, kind: "page"`,
        icon: page.icon && importPath(plugin, page.icon),
      });
    if (action)
      links.push({
        fields: `id: ${JSON.stringify(plugin.id)}, path: ${JSON.stringify(action.hash)}, href: ${JSON.stringify(`#${action.hash}`)}, title: ${JSON.stringify(action.title)}${action.description ? `, description: ${JSON.stringify(action.description)}` : ""}, kind: "action"`,
        icon: action.icon && importPath(plugin, action.icon),
      });
  }
  const imports = links
    .map((link, i) => (link.icon ? `import Icon${i} from ${link.icon};` : ""))
    .filter(Boolean);
  return `// Generated plugin page and action links for menus; no implementation is imported.\nimport 'server-only';\nimport type { PluginPageLink } from '@/core/contracts';\n${imports.join("\n")}${imports.length ? "\n" : ""}export const pluginPageLinks: PluginPageLink[] = [${links.map((link, i) => `\n  { ${link.fields}${link.icon ? `, icon: <Icon${i} />` : ""} },`).join("")}${links.length ? "\n" : ""}];\n`;
}

export function extensionOutputs(resolved) {
  const { template, options, plugins } = resolved;
  const entry = (kind, manifest, filename = manifest.entry) =>
    `@/${kind}/${manifest.id}/${filename.replace(/\.tsx$/, "")}`;
  return [
    {
      target: "src/portfolio/security.generated.json",
      contents: JSON.stringify(resolvedNetwork(resolved), null, 2) + "\n",
    },
    {
      target: "src/portfolio/template.generated.ts",
      contents: `// Generated configuration only; never import view implementations here.\nimport 'server-only';\nexport const templateId = ${JSON.stringify(template.id)};\nexport const templateOptions = ${JSON.stringify(options)};\nexport const templateCategory: ${TEMPLATE_CATEGORIES.map((category) => JSON.stringify(category)).join(" | ")} = ${JSON.stringify(template.category ?? "personal")};\n`,
    },
    ...Object.entries(points.views).map(([view, filename]) => ({
      target: viewTarget(filename),
      contents: `// Generated route entry.\nimport 'server-only';\nimport View from ${JSON.stringify(entry("templates", template, template.entries[view]))};\nimport type { TemplateModule } from '@/core/contracts';\nconst ActiveView: TemplateModule[${JSON.stringify(view)}] = View;\nexport default ActiveView;\n`,
    })),
    ...Object.entries(points.slots).map(([slot, filename]) => {
      const selected = plugins.filter((plugin) => plugin.slot === slot);
      return {
        target: slotTarget(filename),
        contents: `// Generated slot entry; imports only plugins for this slot.\nimport 'server-only';\nimport type { PluginContext } from '@/core/contracts';\n${selected.length ? "import { PluginBoundary } from '@/core/plugin-boundary';\n" : ""}${selected.map((plugin, i) => `import Plugin${i} from ${JSON.stringify(entry("plugins", plugin.manifest))};`).join("\n")}\nexport default function PluginSlot(${selected.length ? "{ context }" : "_props"}: { context: PluginContext }) {\n${selected.length ? "" : "  void _props;\n"}  return ${selected.length ? `<>${selected.map((plugin, i) => `<PluginBoundary key={${JSON.stringify(plugin.id)} + ":" + (context.article?.id ?? "site")} name={${JSON.stringify(plugin.manifest.name)}}><Plugin${i} options={${JSON.stringify(plugin.options)}} context={context} /></PluginBoundary>`).join("")}</>` : "null"};\n}\n`,
      };
    }),
    ...pageOutputs(plugins),
    ...Object.entries(points.optionalViews).map(([view, filename]) => ({
      target: viewTarget(filename),
      contents: `// Generated route entry; the core's view when the template has none.\nimport 'server-only';\nimport View from ${JSON.stringify(template.entries[view] ? entry("templates", template, template.entries[view]) : DEFAULT_VIEWS[view])};\nimport type { TemplateModule } from '@/core/contracts';\nconst ActiveView: NonNullable<TemplateModule[${JSON.stringify(view)}]> = View;\nexport default ActiveView;\n`,
    })),
    templatePageOutput(resolved),
  ];
}
