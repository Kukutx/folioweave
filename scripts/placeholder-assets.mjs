import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { readOptional, withProjectWriteLock } from "./project-lock.mjs";

/** Never overwrite author assets; remove only our unchanged additions on failure. */
export async function withPlaceholderAssets(root, initials, publish) {
  return withProjectWriteLock(root, async (lease) => {
    initials = initials
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
    const portrait = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1440"><rect width="1200" height="1440" fill="#e9e9e9"/><circle cx="600" cy="570" r="230" fill="#c9c9c9"/><rect x="250" y="850" width="700" height="420" rx="210" fill="#c9c9c9"/><text x="600" y="1320" text-anchor="middle" font-family="Arial,sans-serif" font-size="72" fill="#777">${initials}</text></svg>`;
    const socialPreview = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f3f3f3"/><text x="600" y="330" text-anchor="middle" font-family="Arial,sans-serif" font-size="128" font-weight="700" fill="#222">${initials}</text></svg>`;
    const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#f3f3f3"/><text x="256" y="300" text-anchor="middle" font-family="Arial,sans-serif" font-size="156" font-weight="700" fill="#222">${initials}</text></svg>`;
    const directory = path.join(root, "content/assets/portfolio/profile");
    await fs.mkdir(directory, { recursive: true });
    const created = [];
    const assets = {};
    try {
      for (const [name, contents] of Object.entries({
        portrait,
        socialPreview,
        icon,
      })) {
        const hash = createHash("sha256")
          .update(contents)
          .digest("hex")
          .slice(0, 16);
        const basename = name + "-placeholder-" + hash + ".svg";
        const filename = path.join(directory, basename);
        try {
          await fs.writeFile(filename, contents, { flag: "wx" });
          created.push({ filename, contents });
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
          if ((await readOptional(filename)) !== contents)
            throw new Error(
              "Placeholder path contains author changes: " + filename,
            );
        }
        assets[name] = "/portfolio/profile/" + basename;
      }
      return await publish(assets, lease);
    } catch (error) {
      // Failed profile recovery may still reference these assets. Keep them
      // with the journal and held project lock for manual recovery.
      if (
        (await readOptional(
          path.join(root, ".generated/profile-update.json"),
        )) !== null
      )
        throw error;
      for (const { filename, contents } of created)
        if ((await readOptional(filename)) === contents)
          await fs.unlink(filename);
      throw error;
    }
  });
}
