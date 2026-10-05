import fs from "node:fs/promises";
import path from "node:path";

/**
 * A surviving lock blocks every later build on purpose; say who holds it and
 * what is safe to do, instead of surfacing a bare EEXIST.
 */
async function describeHeldLock(lockPath) {
  const owner = await fs
    .readFile(lockPath, "utf8")
    .then(JSON.parse)
    .catch(() => null);
  let running = false;
  // A lock this process holds itself was kept on purpose after a failed
  // rollback; waiting would never release it.
  if (Number.isInteger(owner?.pid) && owner.pid !== process.pid)
    try {
      process.kill(owner.pid, 0);
      running = true;
    } catch (error) {
      // EPERM means the process exists but belongs to someone else.
      running = error.code === "EPERM";
    }
  if (running)
    return `A content build is already running (pid ${owner.pid}, started ${owner.startedAt}). Wait for it to finish.`;
  const journal =
    owner?.transaction &&
    (await fs.access(path.join(owner.transaction, "journal.json")).then(
      () => true,
      () => false,
    ));
  return [
    `A previous content build left ${lockPath}${owner?.pid ? ` (pid ${owner.pid}, started ${owner.startedAt})` : ""}.`,
    journal
      ? `It stopped while replacing outputs: recover from ${owner.transaction} as described in docs/ARCHITECTURE.md, then remove the lock.`
      : "It stopped before any output was replaced: remove the lock and build again.",
  ].join(" ");
}

/** Commit a prepared set with rollback. Never use this for author-owned files. */
export async function commitGeneratedOutputs(root, outputs) {
  root = path.resolve(root);
  const generated = path.join(root, ".generated");
  await fs.mkdir(generated, { recursive: true });
  const lockPath = path.join(generated, "content.lock");
  const lock = await fs.open(lockPath, "wx").catch(async (error) => {
    if (error.code !== "EEXIST") throw error;
    throw Object.assign(
      new Error(await describeHeldLock(lockPath), { cause: error }),
      { code: "EEXIST" },
    );
  });
  let transaction;
  const journal = [];
  let recoverable = true;
  try {
    transaction = await fs.mkdtemp(
      path.join(generated, "content-transaction-"),
    );
    await lock.writeFile(
      JSON.stringify({
        pid: process.pid,
        transaction,
        startedAt: new Date().toISOString(),
      }),
    );
    // All writes and copies finish before any current artifact is replaced.
    for (const [index, output] of outputs.entries()) {
      const target = path.resolve(root, output.target);
      const relative = path.relative(root, target).replaceAll("\\", "/");
      const allowed =
        relative === "public/portfolio" ||
        relative === ".generated/publication.json" ||
        /^src\/blog\/[\w-]+\.generated\.ts$/.test(relative) ||
        /^src\/portfolio\/(?:[\w-]+\.generated\.ts|portfolio-validator\.(?:cjs|d\.cts))$/.test(
          relative,
        );
      if (!target.startsWith(`${root}${path.sep}`) || !allowed)
        throw new Error(`Unsafe generated target: ${target}`);
      const staged = path.join(transaction, `next-${index}`);
      const backup = path.join(transaction, `previous-${index}`);
      if (output.files) {
        await fs.mkdir(staged);
        for (const [relative, bytes] of output.files) {
          const destination = path.resolve(staged, relative);
          if (!destination.startsWith(`${staged}${path.sep}`))
            throw new Error("Unsafe published asset destination");
          await fs.mkdir(path.dirname(destination), { recursive: true });
          if (!Buffer.isBuffer(bytes))
            throw new Error(
              "Published assets require validated byte snapshots",
            );
          await fs.writeFile(destination, bytes);
        }
      } else await fs.writeFile(staged, output.contents, "utf8");
      journal.push({
        target,
        staged,
        backup,
        replaced: false,
        backedUp: false,
      });
    }
    await fs.writeFile(
      path.join(transaction, "journal.json"),
      JSON.stringify(
        journal.map(({ target, staged, backup }) => ({
          target,
          staged,
          backup,
        })),
        null,
        2,
      ),
    );
    for (const item of journal) {
      await fs.mkdir(path.dirname(item.target), { recursive: true });
      try {
        await fs.rename(item.target, item.backup);
        item.backedUp = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await fs.rename(item.staged, item.target);
      item.replaced = true;
    }
  } catch (error) {
    for (const item of journal.toReversed()) {
      try {
        if (item.replaced) await fs.rename(item.target, item.staged);
        if (item.backedUp) await fs.rename(item.backup, item.target);
      } catch {
        recoverable = false;
      }
    }
    if (!recoverable)
      throw new Error(`Output rollback needs recovery from ${transaction}`, {
        cause: error,
      });
    throw error;
  } finally {
    await lock.close();
    // An incomplete rollback must block later writers until explicit recovery.
    if (recoverable) await fs.unlink(lockPath);
    if (transaction && recoverable) {
      if (
        path.dirname(transaction) !== generated ||
        !path.basename(transaction).startsWith("content-transaction-")
      )
        throw new Error("Unsafe transaction cleanup");
      await fs.rm(transaction, { recursive: true });
    }
  }
}
