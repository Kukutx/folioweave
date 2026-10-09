#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { demoOrigin, demoProjects } from "./demo-targets.mjs";

// A demo project on Vercel is connected to this repository and builds a demo
// profile in place of the checkout's own. This runs first in every Vercel
// build and does nothing unless the project names a demo with FOLIO_DEMO.
const name = process.env.FOLIO_DEMO;
if (!name) process.exit(0);

const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!Object.hasOwn(demoProjects, name))
  fail(
    `FOLIO_DEMO must be one of ${Object.keys(demoProjects).join(", ")}; got ${name}.`,
  );
// It rewrites portfolio.json, so it is honoured only in a host's disposable
// checkout and never in a working tree someone edits.
if (process.env.VERCEL !== "1")
  fail(
    "FOLIO_DEMO replaces portfolio.json and is honoured only inside a Vercel build. Use npm run demo:deploy to publish a demo from a working tree.",
  );

const root = path.resolve(import.meta.dirname, "..");
const origin = demoOrigin(name);
if (name === "classic") {
  const policy = JSON.parse(
    await fs.readFile(path.join(root, "governance/branch-policy.json"), "utf8"),
  );
  const profile = JSON.parse(
    await fs.readFile(path.join(root, policy.demoProfile), "utf8"),
  );
  profile.site.origin = origin;
  profile.$schema = "./portfolio.schema.json";
  await fs.writeFile(
    path.join(root, policy.profileConfig),
    JSON.stringify(profile, null, 2) + "\n",
  );
} else {
  const { stageRefractDemo } = await import("../qa/refract-fixture.mjs");
  await stageRefractDemo(root, { style: name, origin });
}
console.log(`Staged the ${name} demo profile for ${origin}.`);
