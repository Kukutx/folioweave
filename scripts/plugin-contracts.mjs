import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "json-schema-to-typescript";
import { format } from "prettier";
import {
  loadCatalog,
  validateExtensionOptions,
} from "../src/core/extensions.mjs";

export function schemaDefaults(schema) {
  if (schema.type !== "object") return schema.default;
  const defaults = {};
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    const value = schemaDefaults(child);
    if (
      value !== undefined &&
      (child.type !== "object" ||
        child.default !== undefined ||
        Object.keys(value).length)
    )
      defaults[key] = value;
  }
  return { ...defaults, ...schema.default };
}

export async function preparePluginContracts(root) {
  const outputs = [];
  for (const manifest of loadCatalog(root).plugins.filter(
    (item) => item.generateOptions,
  )) {
    const schema = manifest.optionsSchema;
    const name = schema.title;
    if (!/^[A-Z][A-Za-z0-9]*Options$/.test(name ?? ""))
      throw new Error(
        `${manifest.id}: optionsSchema.title must name an Options type`,
      );
    const defaults = schemaDefaults(schema);
    const optionalSchema = structuredClone(schema);
    // Validate defaults without requiring authored fields such as the playlist.
    delete optionalSchema.required;
    validateExtensionOptions(
      { ...manifest, optionsSchema: optionalSchema },
      defaults,
    );
    const themeAccents = schema.properties.theme?.["x-accents"];
    if (themeAccents)
      for (const theme of schema.properties.theme.enum) {
        validateExtensionOptions(
          { ...manifest, optionsSchema: optionalSchema },
          { ...defaults, theme, accent: themeAccents[theme] },
        );
        if (!themeAccents[theme])
          throw new Error(`${manifest.id}: missing accent for ${theme}`);
      }
    const types = await compile(schema, name, {
      bannerComment:
        "// Generated from manifest.json by scripts/plugin-contracts.mjs. Do not edit.",
      style: { singleQuote: false },
    });
    const contents = await format(
      `${types}\nexport const optionDefaults = ${JSON.stringify(defaults)} satisfies Partial<${name}>;\n${themeAccents ? `export const themeAccents = ${JSON.stringify(themeAccents)};\n` : ""}`,
      { parser: "typescript" },
    );
    outputs.push({
      target: `src/plugins/${manifest.id}/options.generated.ts`,
      contents,
    });
    if (manifest.id === "music")
      outputs.push({
        target: "docs/design/music-player-defaults.js",
        contents: await format(
          `// Generated sample data from the music manifest. Do not edit.\nglobalThis.musicConfiguration = ${JSON.stringify({ defaults, themeAccents })};\n`,
          { parser: "babel" },
        ),
      });
  }
  return outputs;
}

export async function checkPluginContracts(root) {
  const outputs = await preparePluginContracts(root);
  const stale = [];
  for (const output of outputs) {
    // Sample files are optional in downstream sites; runtime contracts are not.
    if (
      output.target.startsWith("docs/") &&
      !(await fs.stat(path.join(root, "docs/design")).catch(() => null))
    )
      continue;
    const current = await fs
      .readFile(path.join(root, output.target), "utf8")
      .catch(() => "");
    if (
      current.replaceAll("\r\n", "\n") !==
      output.contents.replaceAll("\r\n", "\n")
    )
      stale.push(output.target);
  }
  if (stale.length)
    throw new Error(
      `Plugin contracts are stale: ${stale.join(", ")}. Run npm run plugins:generate.`,
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const root = path.resolve(import.meta.dirname, "..");
  if (process.argv.includes("--write")) {
    for (const { target, contents } of await preparePluginContracts(root)) {
      if (
        target.startsWith("docs/") &&
        !(await fs.stat(path.join(root, "docs/design")).catch(() => null))
      )
        continue;
      await fs.writeFile(path.join(root, target), contents);
    }
    console.log("Plugin contracts generated.");
  } else {
    await checkPluginContracts(root);
    console.log("Plugin contracts are current.");
  }
}
