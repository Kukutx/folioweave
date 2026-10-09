import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import points from "./extension-points.json" with { type: "json" };

export const API_VERSION = 1;
export const SLOTS = Object.keys(points.slots);
/** Profile blocks the shared schema leaves optional; a template that renders
 * one names it under "requires" and publication insists on it for that template. */
export const OPTIONAL_BLOCKS = Object.freeze([
  "photography",
  "footerBook",
  "interlude",
]);
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

function optionValues(value, segments) {
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
          typeof selector !== "string" ||
          !/^[a-zA-Z][a-zA-Z0-9]*(?:\.(?:\*|[a-zA-Z][a-zA-Z0-9]*))*$/.test(
            selector,
          ),
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
        const entries =
          kind === "templates"
            ? Object.keys(points.views).map((view) => manifest.entries?.[view])
            : [manifest.entry];
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
          manifest.slots.some((slot) => !SLOTS.includes(slot))
        )
          throw new Error(`${manifest.id}: invalid slots`);
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
    (block) => config[block] === undefined,
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
    const slot = selection.slot ?? manifest.slots[0];
    if (!manifest.slots.includes(slot) || !template.slots.includes(slot))
      throw new Error(`${pluginId}: slot ${slot} is not supported by ${id}`);
    plugins.push({
      id: pluginId,
      slot,
      options: selection.options ?? {},
      manifest,
    });
  }
  return { template, options, plugins };
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
export const SELECTION_OUTPUTS = Object.freeze([
  "src/portfolio/security.generated.json",
  "src/portfolio/template.generated.ts",
  ...Object.values(points.views).map(viewTarget),
  ...Object.values(points.slots).map(slotTarget),
]);

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
      contents: `// Generated configuration only; never import view implementations here.\nimport 'server-only';\nexport const templateId = ${JSON.stringify(template.id)};\nexport const templateOptions = ${JSON.stringify(options)};\n`,
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
  ];
}
