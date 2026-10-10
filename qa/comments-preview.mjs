import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
export async function startCommentsPreview({ production = false } = {}) {
  const generated = path.join(root, ".generated");
  await fs.mkdir(generated, { recursive: true });
  const directory = await fs.mkdtemp(path.join(generated, "comments-preview-"));
  let child;
  let output = "";
  async function stop() {
    if (child && child.exitCode === null) {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else child.kill("SIGTERM");
      await new Promise((resolve) =>
        child.exitCode !== null ? resolve() : child.once("exit", resolve),
      );
    }
    if (
      path.dirname(path.resolve(directory)) !== generated ||
      !path.basename(directory).startsWith("comments-preview-")
    )
      throw new Error("Unsafe preview cleanup");
    await fs.rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 250,
    });
  }
  try {
    await fs.mkdir(path.join(directory, "app/service/[...path]"), {
      recursive: true,
    });
    await fs.symlink(
      path.join(root, "node_modules"),
      path.join(directory, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await fs.symlink(
      path.join(root, "src"),
      path.join(directory, "src"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await fs.writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
    );
    await fs.writeFile(
      path.join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "react-jsx",
          allowImportingTsExtensions: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./src/*"] },
        },
        include: [
          "app/**/*.ts",
          "app/**/*.tsx",
          "next-env.d.ts",
          ".next/types/**/*.ts",
        ],
        exclude: ["node_modules"],
      }),
    );
    await fs.writeFile(
      path.join(directory, "next.config.mjs"),
      `export default ${JSON.stringify({ devIndicators: false, poweredByHeader: false, outputFileTracingRoot: root, experimental: { cpus: 2 } })};`,
    );
    await fs.writeFile(
      path.join(directory, "app/layout.tsx"),
      'export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}',
    );
    await fs.copyFile(
      path.join(root, "qa/fixtures/comments-preview.tsx"),
      path.join(directory, "app/page.tsx"),
    );
    await fs.copyFile(
      path.join(root, "qa/fixtures/comments-preview.css"),
      path.join(directory, "app/preview.css"),
    );
    await fs.copyFile(
      path.join(root, "qa/fixtures/comments-service.ts"),
      path.join(directory, "app/service/[...path]/route.ts"),
    );
    const next = path.join(root, "node_modules/next/dist/bin/next");
    const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
    if (production)
      await new Promise((resolve, reject) => {
        const build = spawn(process.execPath, [next, "build", "--webpack"], {
          cwd: directory,
          env,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let log = "";
        build.stdout.on("data", (bytes) => {
          log = (log + bytes).slice(-12000);
        });
        build.stderr.on("data", (bytes) => {
          log = (log + bytes).slice(-12000);
        });
        build.once("error", reject);
        build.once("exit", (code) =>
          code ? reject(new Error(log)) : resolve(),
        );
      });
    const port = await new Promise((resolve) => {
      const server = net.createServer();
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
    const url = `http://127.0.0.1:${port}`;
    child = spawn(
      process.execPath,
      [
        next,
        production ? "start" : "dev",
        ...(production ? [] : ["--webpack"]),
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: directory,
        env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", (bytes) => {
      output = (output + bytes).slice(-12000);
    });
    child.stderr.on("data", (bytes) => {
      output = (output + bytes).slice(-12000);
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(output);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);
      if (response?.ok) return { url, directory, stop };
      if (response && response.status >= 500)
        throw new Error(`Preview compilation failed: ${output}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Comments preview did not start: ${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const preview = await startCommentsPreview();
  console.log(`COMMENTS_PREVIEW_URL=${preview.url}`);
  console.log(
    `Independent preview with local demo comments. No template or profile is activated.`,
  );
  let stopping = false;
  const close = async () => {
    if (stopping) return;
    stopping = true;
    await preview.stop();
    process.exitCode = 0;
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
