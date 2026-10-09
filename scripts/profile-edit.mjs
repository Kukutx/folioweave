import fs from "node:fs/promises";
import path from "node:path";
import {
  prepareContent,
  publishContent,
  assertProjectPublicationAllowed,
} from "./content-build.mjs";
import {
  assertProjectLease,
  readOptional,
  withProjectWriteLock,
} from "./project-lock.mjs";

/** Validate first; failed publication restores exactly the prior author config. */
export async function updateProfile(
  root,
  transform,
  { dryRun = false, expectedSource, publicationOptions, lease } = {},
) {
  const update = async (lease) => {
    assertProjectLease(root, lease);
    const filename = path.join(root, "portfolio.json");
    const previous = await fs.readFile(filename, "utf8");
    if (expectedSource !== undefined && previous !== expectedSource)
      throw new Error(
        "The profile changed while configuring it. Retry with the current file.",
      );
    const candidate = await transform(JSON.parse(previous));
    const prepared = await prepareContent(root, candidate);
    assertProjectPublicationAllowed(prepared, root, publicationOptions);
    if (dryRun) return { candidate, prepared };
    if ((await fs.readFile(filename, "utf8")) !== previous)
      throw new Error(
        "The profile changed while configuring it. Retry with the current file.",
      );
    const next = JSON.stringify(candidate, null, 2) + "\n";
    const journal = path.join(root, ".generated/profile-update.json");
    const staged = path.join(root, ".generated/profile-next.json");
    await fs.writeFile(journal, JSON.stringify({ previous, next }, null, 2), {
      flag: "wx",
    });
    try {
      await fs.writeFile(staged, next);
      if ((await fs.readFile(filename, "utf8")) !== previous)
        throw new Error(
          "The profile changed while configuring it. Retry with the current file.",
        );
      await fs.rename(staged, filename);
      await publishContent(prepared, root, {
        ...publicationOptions,
        lease,
        profileSource: next,
      });
    } catch (error) {
      // Never overwrite an author's concurrent edit during rollback.
      if ((await readOptional(filename)) === next) {
        await fs.writeFile(staged, previous);
        await fs.rename(staged, filename);
      }
      await fs.rm(staged, { force: true });
      await fs.unlink(journal);
      throw error;
    }
    await fs.unlink(journal);
    return { candidate, prepared };
  };
  return lease ? update(lease) : withProjectWriteLock(root, update);
}
