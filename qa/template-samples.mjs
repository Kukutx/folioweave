import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../src/core/extensions.mjs";
import { startPreview } from "../scripts/template-preview.mjs";

// Templates of another category than the profile's own are never rendered by
// the site under test, so their checks would never run. Each store template
// with a sample is served here, in a disposable preview sandbox, with the demo
// profile filled from that sample, and held to the same functionality and
// quality suites a shop's own profile meets.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// A sandbox has no Git or deployment identity of its own. The CI variables
// name the real checkout's branch (on a pull request into personal, the
// production site), and the sandbox's content build must not be judged by
// them; extension-browser.mjs clears the same ones for its sandbox.
for (const name of [
  "BOUNDARY_TARGET",
  "BOUNDARY_SHARED_BASE",
  "GITHUB_BASE_REF",
  "GITHUB_REF_NAME",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL",
])
  delete process.env[name];
const templates = [];
for (const template of loadCatalog(root).templates) {
  if ((template.category ?? "personal") !== "store") continue;
  const sample = path.join(root, "src/templates", template.id, "sample.json");
  if (await fs.stat(sample).catch(() => null))
    templates.push({ id: template.id, sample });
}
if (!templates.length) {
  console.log("SKIP template samples: no store template carries a sample.");
  process.exit(0);
}

function run(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "qa", script)], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} failed (${code})`)),
    );
  });
}

const failures = [];
for (const template of templates) {
  const preview = await startPreview({
    template: template.id,
    profile: "demo",
    fills: [template.sample],
    quiet: true,
  });
  try {
    const base = await preview.ready;
    const profile = path.join(
      root,
      ".generated",
      `template-preview-${template.id}`,
      "portfolio.json",
    );
    console.log(`\nTemplate sample ${template.id}: ${base}`);
    for (const script of ["functionality.mjs", "quality.mjs"])
      await run(script, { BASE_URL: base, QA_PROFILE_PATH: profile }).catch(
        (error) => failures.push(`${template.id}: ${error.message}`),
      );
  } finally {
    await preview.stop();
  }
}
if (failures.length) {
  console.error(`Template samples failed: ${failures.join("; ")}`);
  process.exitCode = 1;
} else console.log(`PASS template samples: ${templates.map((t) => t.id).join(", ")}`);
