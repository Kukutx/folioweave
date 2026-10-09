import fs from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { loadCatalog } from "../src/core/extensions.mjs";

/** A fresh snapshot per preparation; no module-level caches in the dev watcher. */
export async function createProjectContext(root) {
  root = path.resolve(root);
  const read = async (name) =>
    JSON.parse(await fs.readFile(path.join(root, name), "utf8"));
  const [schema, routes] = await Promise.all([
    read("portfolio.schema.json"),
    read("src/portfolio/routes.json"),
  ]);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
    code: { source: true },
  });
  return {
    root,
    schema,
    routes,
    catalog: loadCatalog(root),
    ajv,
    validate: ajv.compile(schema),
  };
}
