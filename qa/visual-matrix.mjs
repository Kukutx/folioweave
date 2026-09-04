import { spawnSync } from "node:child_process";

const routes = [
  "/",
  "/blogs",
  "/blogs/clipt",
  "/brink",
  "/brink/privacy",
  "/case-studies",
  "/clipt",
  "/clipt-privacypolicy",
  "/district",
  "/flipfact",
  "/habee-privacypolicy",
  "/notchshelf-privacypolicy",
];
const viewports = ["desktop", "mobile"];
const failures = [];
let passed = 0;

for (const viewport of viewports) {
  for (const route of routes) {
    let ok = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      console.log(`\n=== ${viewport} ${route} (attempt ${attempt}) ===`);
      const result = spawnSync(process.execPath, ["qa/visual-routes.mjs", viewport], {
        cwd: process.cwd(),
        env: { ...process.env, VISUAL_ROUTES: route },
        encoding: "utf8",
        stdio: "inherit",
      });
      if (result.status === 0) {
        ok = true;
        break;
      }
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (ok) passed += 1;
    else failures.push({ viewport, route });
  }
}

const summary = {
  checks: viewports.length * routes.length,
  passed,
  failed: failures.length,
  failures,
};
console.log("\nVISUAL ROUTE SUMMARY");
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
