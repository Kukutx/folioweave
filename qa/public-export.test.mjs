import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function walk(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(absolute)));
    else result.push(absolute);
  }
  return result;
}

test(
  "public export is a clean-history canonical snapshot",
  { skip: !existsSync(path.join(root, ".git")) },
  async () => {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "folioweave-public-export-"),
  );
  const destination = path.join(parent, "snapshot");
  try {
    execFileSync(
      process.execPath,
      [
        path.join(root, "scripts", "export-public.mjs"),
        destination,
        "--ref",
        "HEAD",
      ],
      { cwd: root, stdio: "pipe" },
    );

    const policy = JSON.parse(
      await fs.readFile(
        path.join(destination, "governance", "branch-policy.json"),
        "utf8",
      ),
    );
    const portfolio = JSON.parse(
      await fs.readFile(path.join(destination, policy.profileConfig), "utf8"),
    );
    const demo = JSON.parse(
      await fs.readFile(path.join(destination, policy.demoProfile), "utf8"),
    );
    assert.deepEqual(
      portfolio,
      demo,
      "public export must use the canonical demo profile",
    );

    const files = (await walk(destination)).map((file) =>
      path.relative(destination, file).replaceAll("\\\\", "/"),
    );
    assert.equal(
      files.some((file) => file === ".git" || file.startsWith(".git/")),
      false,
    );
    assert.equal(
      files.some((file) => file === ".vercel" || file.startsWith(".vercel/")),
      false,
    );
    assert.equal(files.some((file) => file.startsWith(".generated/")), false);
    assert.equal(files.some((file) => file.startsWith("qa/screens/")), false);
    assert.equal(
      files.some((file) => file.startsWith("qa/baselines/personal/")),
      false,
    );

    const allowed = new Set(policy.sharedExceptions);
    const leaked = files.filter(
      (file) =>
        policy.personalOnlyPrefixes.some((prefix) => file.startsWith(prefix)) &&
        !allowed.has(file),
    );
    assert.deepEqual(
      leaked,
      [],
      `personal-only files leaked: ${leaked.join(", ")}`,
    );

    await fs.copyFile(
      path.join(root, "scripts", "branch-boundary-check.mjs"),
      path.join(destination, "scripts", "branch-boundary-check.mjs"),
    );
    execFileSync(
      process.execPath,
      [path.join(destination, "scripts", "branch-boundary-check.mjs")],
      { cwd: destination, stdio: "pipe" },
    );
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
  },
);
