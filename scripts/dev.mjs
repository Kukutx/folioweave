import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { prepareContent, publishContent } from "./content-build.mjs";
import { RESUME_SOURCE } from "./resume-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const watchedInputs = [
  {
    relativePath: "src/templates",
    recursive: true,
    accepts: (name) => name.endsWith("manifest.json"),
  },
  {
    relativePath: "src/plugins",
    recursive: true,
    accepts: (name) => name.endsWith("manifest.json"),
  },
  {
    relativePath: ".",
    recursive: false,
    accepts: (name) =>
      ["portfolio.json", "portfolio.schema.json"].includes(name),
  },
  { relativePath: "content/blogs", recursive: true },
  { relativePath: "content/assets/portfolio", recursive: true },
  {
    relativePath: "src/blog",
    recursive: false,
    accepts: (name) => name === "custom-posts.json",
  },
  {
    relativePath: "src/demo",
    recursive: false,
    accepts: (name) => name === "custom-posts.json",
  },
  {
    relativePath: "src/portfolio",
    recursive: false,
    accepts: (name) => name === "routes.json",
  },
];

let debounceTimer = null;
let rebuilding = false;
let rebuildQueued = false;
let stopped = false;

async function rebuild(reason) {
  if (rebuilding) {
    rebuildQueued = true;
    return;
  }
  rebuilding = true;
  try {
    const prepared = await prepareContent(root);
    await publishContent(prepared, root);
    console.log(
      `[content] ${reason}: ${prepared.routes.length} routes, ${Object.keys(prepared.media).length} published assets`,
    );
    return true;
  } catch (error) {
    console.error(`[content] rebuild failed; keeping the last valid output.`);
    console.error(error instanceof Error ? error.message : error);
    return false;
  } finally {
    rebuilding = false;
    if (rebuildQueued && !stopped) {
      rebuildQueued = false;
      await rebuild("queued change");
    }
  }
}

function schedule(relativePath) {
  if (stopped) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void rebuild(`changed ${relativePath}`);
  }, 120);
}

if (!(await rebuild("initial build"))) process.exit(1);

// The resume renders in a browser, so it is rebuilt on demand rather than with
// every content change. Its new PDF/preview then flow through the asset watcher.
let resumeTimer = null;
let resumeBuilding = false;
let resumeQueued = false;
async function rebuildResume() {
  if (stopped) return;
  if (resumeBuilding) {
    resumeQueued = true;
    return;
  }
  resumeBuilding = true;
  try {
    const { buildResume } = await import("./resume-build.mjs");
    const { status, targets } = await buildResume(root);
    if (status === "built")
      console.log(`[resume] rebuilt ${targets.pdf.asset} and its preview`);
  } catch (error) {
    console.error("[resume] build failed; keeping the last generated files.");
    console.error(error instanceof Error ? error.message : error);
  } finally {
    resumeBuilding = false;
    if (resumeQueued && !stopped) {
      resumeQueued = false;
      await rebuildResume();
    }
  }
}
const resumeDirectory = path.join(root, path.dirname(RESUME_SOURCE));
const resumeWatcher = fs.existsSync(resumeDirectory)
  ? fs.watch(resumeDirectory, (_eventType, fileName) => {
      if (fileName?.toString() !== path.basename(RESUME_SOURCE)) return;
      if (!fs.existsSync(path.join(root, RESUME_SOURCE))) return;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => void rebuildResume(), 300);
    })
  : null;

const watchers = watchedInputs.map(({ relativePath, recursive, accepts }) => {
  const target = path.join(root, relativePath);
  return fs.watch(target, { recursive }, (_eventType, fileName) => {
    const name = fileName?.toString().replaceAll("\\", "/") ?? "";
    if (accepts && name && !accepts(name)) return;
    const changed =
      relativePath === "."
        ? name || "portfolio authoring files"
        : name
          ? `${relativePath}/${name}`
          : relativePath;
    schedule(changed);
  });
});

const child = spawn(
  process.execPath,
  [nextBin, "dev", ...process.argv.slice(2)],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
);

function shutdown(signal) {
  if (stopped) return;
  stopped = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeWatcher?.close();
  for (const watcher of watchers) watcher.close();
  if (child.exitCode === null) child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  shutdown(signal === "SIGTERM" ? "SIGTERM" : "SIGINT");
  if (code != null) process.exitCode = code;
  else if (signal) process.exitCode = 1;
});
