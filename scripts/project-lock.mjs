import fs from "node:fs/promises";
import path from "node:path";

const leases = new WeakMap();
export function assertProjectLease(root, lease) {
  if (!lease || leases.get(lease) !== path.resolve(root))
    throw new Error("Invalid project write lease");
}

/** Serializes profile commands and publication, separately from artifact rollback. */
export async function withProjectWriteLock(root, callback) {
  root = path.resolve(root);
  await fs.mkdir(path.join(root, ".generated"), { recursive: true });
  const filename = path.join(root, ".generated/project.lock");
  const handle = await fs.open(filename, "wx").catch(async (error) => {
    if (error.code !== "EEXIST") throw error;
    const owner = await fs
      .readFile(filename, "utf8")
      .catch(() => "unknown owner");
    throw Object.assign(
      new Error(
        `Project update locked: ${owner}. Wait for the writer; after a crash inspect .generated/profile-update.json and the content transaction before removing project.lock.`,
      ),
      { code: "EEXIST" },
    );
  });
  const lease = {};
  leases.set(lease, root);
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    return await callback(lease);
  } finally {
    leases.delete(lease);
    await handle.close();
    // A profile journal means recovery has not completed. Fail closed.
    const recovery = await fs
      .access(path.join(root, ".generated/profile-update.json"))
      .then(
        () => true,
        () => false,
      );
    if (!recovery) await fs.unlink(filename);
  }
}

export async function readOptional(filename) {
  return fs.readFile(filename, "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}
