import fs from "node:fs/promises";
import path from "node:path";
import { prepareContent, checkGeneratedContent } from "./content-build.mjs";
import { validateRouteContract } from "./route-contract.mjs";

const root = path.resolve(import.meta.dirname, "..");
const prepared = await prepareContent(root);
await checkGeneratedContent(prepared, root);
const demo = JSON.parse(
  await fs.readFile(path.join(root, "governance/demo-portfolio.json"), "utf8"),
);
await prepareContent(root, demo);
const custom = [
  ...JSON.parse(
    await fs.readFile(path.join(root, "src/blog/custom-posts.json"), "utf8"),
  ),
  ...JSON.parse(
    await fs.readFile(path.join(root, "src/demo/custom-posts.json"), "utf8"),
  ),
];
const routes = JSON.parse(
  await fs.readFile(path.join(root, "src/portfolio/routes.json"), "utf8"),
);
await validateRouteContract(root, routes, custom);
console.log(
  `Content contract OK — personal/demo profiles, generated files, ${prepared.routes.length} routes and ${Object.keys(prepared.media).length} published assets verified.`,
);
