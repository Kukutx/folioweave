import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { qaTempRoot } from "./temp-directory.mjs";
import path from "node:path";
import {
  hasPublicationGuard,
  pageRoute,
  validateRouteContract,
} from "../scripts/route-contract.mjs";

const source = (body) =>
  `import { requirePublishedRoute } from "@/portfolio/route-guard"; export default function Page() { ${body} }`;
test("guard must be the unconditional first statement, with the correct import and path", () => {
  assert.equal(
    hasPublicationGuard(
      source('requirePublishedRoute("/demo"); return null;'),
      "/demo",
    ),
    true,
  );
  for (const body of [
    '// requirePublishedRoute("/demo");\nreturn null;',
    'if (false) requirePublishedRoute("/demo");',
    'return null; requirePublishedRoute("/demo");',
    'requirePublishedRoute("/other");',
  ])
    assert.equal(hasPublicationGuard(source(body), "/demo"), false);
  assert.equal(
    hasPublicationGuard(
      source('requirePublishedRoute("/demo");').replace(
        "@/portfolio/route-guard",
        "./fake",
      ),
      "/demo",
    ),
    false,
  );
});
test("route groups normalize, private folders are excluded, unsupported public conventions fail closed", () => {
  assert.equal(pageRoute("(site)/demo/page.tsx"), "/demo");
  assert.equal(pageRoute("_internal/demo/page.tsx"), null);
  assert.throws(
    () => pageRoute("@modal/(.)demo/page.tsx"),
    /explicit publication policy/,
  );
});
test("bidirectional contract rejects missing registration, guard, page, and custom blog registration", async (t) => {
  const root = await fs.mkdtemp(path.join(qaTempRoot, "folioweave-routes-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (
    name,
    text = "export default function Page() { return null; }",
  ) => {
    const file = path.join(root, "src/app", name, "page.tsx");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
  };
  for (const route of ["", "blogs", "blogs/[slug]", "blogs/tag/[tag]"])
    await write(route);
  await validateRouteContract(root, [], []);
  await assert.rejects(
    validateRouteContract(root, [], [{ slug: "forgotten" }]),
    /Custom blog/,
  );
  await assert.rejects(
    validateRouteContract(root, [{ path: "/missing", demoOnly: true }], []),
    /page missing/,
  );
  await write("(demo)/demo");
  await assert.rejects(validateRouteContract(root, [], []), /Unclassified/);
  const routes = [{ path: "/demo", demoOnly: true }];
  await assert.rejects(validateRouteContract(root, routes, []), /must begin/);
  await write(
    "(demo)/demo",
    source('requirePublishedRoute("/demo"); return null;'),
  );
  await validateRouteContract(root, routes, []);
  // Examples live in their group and nothing else does.
  await assert.rejects(
    validateRouteContract(root, [{ path: "/demo", demoOnly: false }], []),
    /not an example route/,
  );
  await write(
    "(site)/stray",
    source('requirePublishedRoute("/stray"); return null;'),
  );
  await assert.rejects(
    validateRouteContract(
      root,
      [...routes, { path: "/stray", demoOnly: true }],
      [],
    ),
    /must live under src\/app\/\(demo\)/,
  );
  await validateRouteContract(
    root,
    [...routes, { path: "/stray", demoOnly: false }],
    [],
  );
});
