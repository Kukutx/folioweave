import fs from "node:fs/promises";
import path from "node:path";

/** Commit a prepared set with rollback. Never use this for author-owned files. */
export async function commitGeneratedOutputs(root, outputs) {
  root = path.resolve(root);
  const generated = path.join(root, ".generated");
  await fs.mkdir(generated, { recursive: true });
  const lockPath = path.join(generated, "content.lock");
  const lock = await fs.open(lockPath, "wx");
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
        relative === "src/blog/posts.generated.ts" ||
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
