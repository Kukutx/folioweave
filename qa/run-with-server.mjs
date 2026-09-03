import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { cleanupPlaywrightProcesses } from "./chrome.mjs";

const scripts = process.argv.slice(2);
if (!scripts.length) {
  console.error("Usage: node qa/run-with-server.mjs <npm-script> [...]");
  process.exit(2);
}

try {
  await fs.access(path.resolve(".next/BUILD_ID"));
} catch {
  console.error("Missing .next production build. Run `npm run build` first.");
  process.exit(2);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function runScript(script, env) {
  return new Promise((resolve, reject) => {
    const npmCli =
      process.env.npm_execpath ||
      path.resolve(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
    const child = spawn(process.execPath, [npmCli, "run", script], {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed (${code ?? signal ?? "unknown"})`));
    });
  });
}

function stopTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const nextBin = path.resolve("node_modules/next/dist/bin/next");
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
const collect = (chunk) => {
  const text = String(chunk);
  output = (output + text).slice(-20_000);
  process.stdout.write(text);
};
server.stdout.on("data", collect);
server.stderr.on("data", collect);

try {
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next server exited early (${server.exitCode}).\n${output}`);
    }
    try {
      const response = await fetch(base, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        ready = true;
        break;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Timed out waiting for ${base}.\n${output}`);

  const env = {
    ...process.env,
    BASE_URL: base,
    NEXT_URL: base,
  };
  console.log(`\nQA server ready: ${base}\n`);
  cleanupPlaywrightProcesses();
  for (const script of scripts) {
    await runScript(script, env);
    cleanupPlaywrightProcesses();
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
} finally {
  cleanupPlaywrightProcesses();
  stopTree(server);
}
