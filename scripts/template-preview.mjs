// Preview any template with any profile, without touching the author's files.
//
//   npm run preview:template -- <template-id> [--profile author|demo|<file>]
//                               [--merge <file.json>]... [--fill <file.json>]...
//                               [--port <n>]
//
// --merge overlays a file (it wins); --fill only adds the blocks and this
// template's settings that the profile lacks (the profile wins).
//   npm run preview:template -- --clean <template-id>
//
// A sandbox under .generated/template-preview-<id>/ links the real source
// (templates, plugins, components, styles…) so edits show up live, and owns a
// private copy of everything a content build writes: src/portfolio, src/blog,
// public/portfolio, .generated and portfolio.json. It then runs the normal
// content build there and a development server. Nothing is written to the
// repository's own profile or generated files.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { watch as fsWatch } from "node:fs";
import { prepareContent, publishContent } from "./content-build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generated = path.join(root, ".generated");
/** Published output a content build replaces. */
const OWNED_PUBLIC = new Set(["portfolio"]);
const COPIED_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "portfolio.schema.json",
];
const LINKED_DIRECTORIES = ["node_modules", "content", "governance"];

const link = (target, at) =>
  fs.symlink(target, at, process.platform === "win32" ? "junction" : "dir");

function sandboxOf(id) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Invalid id: ${id}`);
  return path.join(generated, `template-preview-${id}`);
}

const LOCK = "preview.lock";

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** The process serving a sandbox, while it is still running. */
async function owner(directory) {
  const lock = await fs
    .readFile(path.join(directory, LOCK), "utf8")
    .catch(() => null);
  const pid = lock && Number(JSON.parse(lock).pid);
  return pid && pid !== process.pid && alive(pid) ? pid : null;
}

/** Unlink every link first, so removal can never follow one into the repo.
 * A sandbox another live process is serving (Studio, another preview) is
 * never touched: its preview would break mid-use. */
async function removeSandbox(directory) {
  if (path.dirname(directory) !== generated)
    throw new Error(`Refusing to remove ${directory}`);
  const pid = await owner(directory);
  if (pid)
    throw new Error(
      `${path.basename(directory)} is in use by process ${pid}; stop that preview first.`,
    );
  const unlinkLinks = async (dir) => {
    const entries = await fs
      .readdir(dir, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      const at = path.join(dir, entry.name);
      if (entry.isSymbolicLink() || (await isJunction(at))) await fs.unlink(at);
      else if (entry.isDirectory() && entry.name !== ".next")
        await unlinkLinks(at);
    }
  };
  await unlinkLinks(directory);
  await fs.rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 300,
  });
}

async function isJunction(at) {
  try {
    const stat = await fs.lstat(at);
    if (stat.isSymbolicLink()) return true;
    // Windows reports junctions as directories; readlink tells them apart.
    await fs.readlink(at);
    return true;
  } catch {
    return false;
  }
}

function deepMerge(base, overlay) {
  if (
    !overlay ||
    typeof overlay !== "object" ||
    Array.isArray(overlay) ||
    !base ||
    typeof base !== "object" ||
    Array.isArray(base)
  )
    return overlay;
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay))
    result[key] = key in base ? deepMerge(base[key], value) : value;
  return result;
}

async function freePort(preferred) {
  const tryPort = (port) =>
    new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(null));
      server.listen(port, "127.0.0.1", () => {
        const { port: chosen } = server.address();
        server.close(() => resolve(chosen));
      });
    });
  return (preferred && (await tryPort(preferred))) || tryPort(0);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export function parseArguments(argv) {
  const options = { merges: [], fills: [], profile: "author" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === "--profile") options.profile = value();
    else if (arg === "--merge") options.merges.push(value());
    else if (arg === "--fill") options.fills.push(value());
    else if (arg === "--port") options.port = Number(value());
    else if (arg === "--clean") options.clean = value();
    else if (arg === "--prepare-only") options.prepareOnly = true;
    else if (!arg.startsWith("--") && !options.template) options.template = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.template && !options.clean)
    throw new Error(
      "Name a template, for example: npm run preview:template -- pond",
    );
  return options;
}

/** Build the sandbox and its content; returns its directory. */
export async function prepareSandbox({
  template,
  profile = "author",
  merges = [],
  fills = [],
}) {
  const directory = sandboxOf(template);
  await fs.mkdir(generated, { recursive: true });
  await removeSandbox(directory);
  await fs.mkdir(directory);
  for (const file of COPIED_FILES)
    await fs.copyFile(path.join(root, file), path.join(directory, file));
  for (const name of LINKED_DIRECTORIES)
    await link(path.join(root, name), path.join(directory, name));
  // Source is copied, not linked: the development server stalls on source
  // reached through links. `syncSource` keeps the copy current.
  await fs.cp(path.join(root, "src"), path.join(directory, "src"), {
    recursive: true,
  });
  await fs.mkdir(path.join(directory, "public"));
  for (const entry of await fs.readdir(path.join(root, "public"), {
    withFileTypes: true,
  })) {
    if (OWNED_PUBLIC.has(entry.name)) continue;
    const from = path.join(root, "public", entry.name);
    const to = path.join(directory, "public", entry.name);
    if (entry.isDirectory()) await link(from, to);
    else await fs.copyFile(from, to);
  }

  const source =
    profile === "author"
      ? path.join(root, "portfolio.json")
      : profile === "demo"
        ? path.join(root, "governance/demo-portfolio.json")
        : path.resolve(profile);
  let config = await readJson(source);
  for (const file of merges)
    config = deepMerge(config, await readJson(path.resolve(file)));
  config.template = {
    ...config.template,
    id: template,
    settings: config.template?.settings ?? {},
  };
  // A fill only supplies what the profile lacks: whole top-level blocks, and
  // this template's settings when the author has none yet.
  for (const file of fills) {
    const sample = await readJson(path.resolve(file));
    for (const [key, value] of Object.entries(sample))
      if (key !== "template" && config[key] === undefined) config[key] = value;
    const settings = sample.template?.settings?.[template];
    if (settings && config.template.settings[template] === undefined)
      config.template.settings[template] = settings;
  }
  // Only enabled plugins whose slots the template offers can come along.
  await fs.writeFile(
    path.join(directory, "portfolio.json"),
    JSON.stringify(config, null, 2) + "\n",
  );
  const prepared = await prepareContent(directory);
  await publishContent(prepared, directory);
  return directory;
}

/** Mirror source edits into the sandbox. Generated files stay the sandbox's
 * own; a manifest or schema change rebuilds the sandbox's generated content. */
export function syncSource(directory, rebuild) {
  const pending = new Set();
  let timer;
  let rebuildNeeded = false;
  const flush = async () => {
    const names = [...pending];
    pending.clear();
    for (const name of names) {
      const from = path.join(root, "src", name);
      const to = path.join(directory, "src", name);
      const stat = await fs.stat(from).catch(() => null);
      if (!stat) await fs.rm(to, { force: true, recursive: true });
      else if (stat.isFile()) {
        await fs.mkdir(path.dirname(to), { recursive: true });
        await fs.copyFile(from, to);
      }
    }
    if (rebuildNeeded) {
      rebuildNeeded = false;
      await rebuild().catch((error) =>
        console.error(`[preview] content rebuild failed: ${error.message}`),
      );
    }
  };
  const watcher = fsWatch(
    path.join(root, "src"),
    { recursive: true },
    (_event, name) => {
      if (!name || name.includes(".generated.")) return;
      pending.add(name);
      if (/(?:^|[\\/])manifest\.json$|\.schema\.json$/.test(name))
        rebuildNeeded = true;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), 120);
    },
  );
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}

/** Start a preview server on a prepared sandbox. `stop()` ends the server
 * and removes the sandbox; `ready` resolves once the home page answers. */
export async function startPreview({
  template,
  port,
  quiet = false,
  ...options
}) {
  const directory = await prepareSandbox({ template, ...options });
  // Claim the sandbox for this process until it stops serving it.
  await fs.writeFile(
    path.join(directory, LOCK),
    JSON.stringify({ pid: process.pid }),
  );
  const chosen = await freePort(port);
  const next = path.join(root, "node_modules/next/dist/bin/next");
  // Webpack, as the fixture suite uses for its sandboxes.
  const child = spawn(
    process.execPath,
    [next, "dev", "--webpack", "-p", String(chosen), "-H", "127.0.0.1"],
    {
      cwd: directory,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: [
        "ignore",
        quiet ? "ignore" : "inherit",
        quiet ? "ignore" : "inherit",
      ],
    },
  );
  const stopSync = syncSource(directory, async () => {
    await publishContent(await prepareContent(directory), directory);
  });
  const url = `http://127.0.0.1:${chosen}`;
  let stopped;
  const stop = () =>
    (stopped ??= (async () => {
      stopSync();
      if (child.exitCode === null) {
        if (process.platform === "win32")
          spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            stdio: "ignore",
          });
        else child.kill("SIGTERM");
        await new Promise((resolve) =>
          child.exitCode !== null ? resolve() : child.once("exit", resolve),
        );
      }
      // Windows can hold a just-closed directory briefly; a failed removal
      // is not remembered, so the next stop() tries again.
      await removeSandbox(directory).catch((error) => {
        stopped = undefined;
        throw error;
      });
    })());
  const ready = (async () => {
    for (let attempt = 0; attempt < 240; attempt++) {
      if (child.exitCode !== null)
        throw new Error("The preview server stopped");
      const response = await fetch(url, {
        signal: AbortSignal.timeout(120000),
      }).catch(() => null);
      if (response) return url;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("The preview server did not answer");
  })();
  return { template, url, child, ready, stop };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.clean) {
    await removeSandbox(sandboxOf(options.clean));
    console.log(`Removed the ${options.clean} preview sandbox.`);
    return;
  }
  if (options.prepareOnly) {
    console.log(`Sandbox ready: ${await prepareSandbox(options)}`);
    return;
  }
  const preview = await startPreview(options);
  console.log(
    `
Previewing ${options.template} at ${preview.url}
Stop with Ctrl+C; the sandbox is removed then.
`,
  );
  const stop = async () => {
    await preview.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  preview.child.on("exit", () => void stop());
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await main();
